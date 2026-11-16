import * as T from './vendor/three.js';
import { FILLED, seededRandom } from './stages.js';
import { FEATURE_FOODS } from './feature-courses.js';

export const material = (color, roughness = .75) => new T.MeshStandardMaterial({ color, roughness });
export const ball = new T.SphereGeometry(1, 32, 20);
const detailBall = new T.SphereGeometry(1, 16, 10);
const round = new T.CylinderGeometry(1, 1, 1, 32);
const box = new T.BoxGeometry(1, 1, 1);

export function mesh(parent, geometry, surface, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const part = new T.Mesh(geometry, surface);
  part.position.set(x, y, z);
  part.scale.set(sx, sy, sz);
  parent.add(part);
  return part;
}

export const ellipsoid = (parent, surface, x,y,z,sx,sy,sz) =>
  mesh(parent,Math.max(sx,sy,sz)<.39 ? detailBall : ball,surface,x,y,z,sx,sy,sz);
export const block = (parent, surface, x,y,z,sx,sy,sz) => mesh(parent, box, surface, x,y,z,sx,sy,sz);
export const cylinder = (parent, surface, x,y,z,sx,sy,sz) => mesh(parent, round, surface, x,y,z,sx,sy,sz);

export function tube(parent, surface, points, radius, steps = 14) {
  const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  return mesh(parent, new T.TubeGeometry(path, steps, radius, 7, false), surface);
}

export function batchMeshes(land,windEntries) {
  land.updateWorldMatrix(true,true);
  const groups=new Map();
  land.traverse(node=>{
    if(!node.isMesh || node.isInstancedMesh || node.material.transparent) return;
    const key=[node.geometry.id,node.material.id,node.castShadow,node.receiveShadow].join('/');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(node);
  });
  const fromIsland=land.matrixWorld.clone().invert();
  for(const group of groups.values()){
    if(group.length<2) continue;
    const first=group[0];
    const pack=new T.InstancedMesh(first.geometry,first.material,group.length);
    pack.castShadow=first.castShadow;
    pack.receiveShadow=first.receiveShadow;
    group.forEach((part,index)=>{
      const local=new T.Matrix4().multiplyMatrices(fromIsland,part.parent.matrixWorld);
      pack.setMatrixAt(index,new T.Matrix4().multiplyMatrices(local,part.matrix));
      const wind=windEntries?.get(part);
      if(wind) {
        Object.assign(wind,{ pack,index,local });
        pack.instanceMatrix.setUsage(T.DynamicDrawUsage);
      }
      part.removeFromParent();
    });
    pack.computeBoundingSphere();
    pack.boundingSphere.radius+=.35;
    land.add(pack);
  }
}

function rolledShape(shape, depth, bevel) {
  return new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 16, steps: 1 });
}

function toastShape() {
  const shape = new T.Shape();
  shape.moveTo(-.69,-.76);
  shape.quadraticCurveTo(-.82,-.76,-.83,-.60);
  shape.lineTo(-.83,.29);
  shape.bezierCurveTo(-1.07,.46,-.99,.84,-.68,.88);
  shape.quadraticCurveTo(-.36,.98,0,.82);
  shape.quadraticCurveTo(.36,.98,.68,.88);
  shape.bezierCurveTo(.99,.84,1.07,.46,.83,.29);
  shape.lineTo(.83,-.60);
  shape.quadraticCurveTo(.82,-.76,.69,-.76);
  shape.closePath();
  return shape;
}

function makeToast(art) {
  const root = new T.Group();
  const shape = toastShape();
  const crust = new T.MeshStandardMaterial({
    color:0xffdab0, map:art.crust, bumpMap:art.crust, bumpScale:.052, roughness:.79,
  });
  const crumb = new T.MeshStandardMaterial({
    color:0xffeed2, map:art.crumb, bumpMap:art.crumb, bumpScale:.052, roughness:.91,
  });
  const crustShape = rolledShape(shape, .26, .085);
  const shell=mesh(root, crustShape, crust, 0,.085,0);
  shell.rotation.x = -Math.PI / 2;
  shell.castShadow = true;
  const face = new T.ShapeGeometry(shape, 32);
  const uv = face.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.95 + .5, uv.getY(i) / 1.95 + .5);
  mesh(root, face, crumb, 0,.424,0,.962,.962,1).rotation.x = -Math.PI / 2;
  return root;
}

function ruffle(radius, height, color, seed, bumps = 8) {
  const positions = [0, height * .12, 0], colors = [], faces = [];
  const random = seededRandom(seed);
  const base = new T.Color(color);
  colors.push(base.r,base.g,base.b);
  const count = 60, rings = 7;
  for (let ring = 1; ring <= rings; ring++) {
    const scale = ring / rings;
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      const edge = 1 + .08 * Math.sin(angle * bumps) + .044 * Math.cos(angle * 21);
      const r = radius * scale * T.MathUtils.lerp(1, edge, scale);
      const y = height * (.16 + scale ** 2 * (.44 + .43 * Math.sin(angle * bumps + scale * 3) + .12 * Math.sin(angle * 22)));
      positions.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
      const tint = base.clone().multiplyScalar(.66 + scale * .22 + random() * .21 + .08 * Math.cos(angle * 13 + scale * 7));
      colors.push(tint.r, tint.g, tint.b);
      const index = 1 + (ring - 1) * count + i;
      const next = i === count - 1 ? index - count + 1 : index + 1;
      if (ring === 1) faces.push(0,next,index);
      else faces.push(index-count,next,index, index-count,next-count,next);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.setIndex(faces);
  geo.computeVertexNormals();
  return geo;
}

const mats = {
  tomato: new T.MeshPhysicalMaterial({
    color:0xe43a26,roughness:.39,clearcoat:.44,clearcoatRoughness:.29,
  }), flesh: material(0xf86e45,.58), seed: material(0xffc67f,.71),
  lettuce: material(0x80b44c,.8), vine: material(0x49752b),
  patty: material(0x70331f,.87), grill: material(0x3d2118,.9), crumbs: material(0x94573a,.9),
  egg: material(0xfff5db,.56),
  yolk: new T.MeshPhysicalMaterial({
    color:0xffa922,roughness:.36,clearcoat:.48,clearcoatRoughness:.28,
  }),
  cheese: material(0xffb934,.64), cheeseHole: material(0xe38a15,.82),
  pickle: material(0x699229,.65), pickleCore: material(0xb4cb54,.6),
  chili: new T.MeshPhysicalMaterial({
    color:0xe02931,roughness:.42,clearcoat:.48,clearcoatRoughness:.29,
  }), stem: material(0x458344,.78),
  gold: new T.MeshStandardMaterial({ color: 0xffbf33, roughness:.31, metalness:.31 }),
  goldLight: material(0xffe093,.38),
  oldFish: material(0x7f9c88,.60), fishBelly: material(0xb7bca1,.66),
  fishFin: material(0x426b68,.76), fishEye: material(0x38464d,.70),
  mould: material(0xbbae66,.85), spores: material(0x537f6f,.86),
  pinWood: material(0xe3a365,.52), pinGrip: material(0xbf4a42,.57),
  pinBand: material(0x8f5848,.77),
  star: new T.MeshStandardMaterial({ color:0xfec650, roughness:.33, metalness:.26, emissive:0xb86a14, emissiveIntensity:.30 }),
};
const leafy = new T.MeshStandardMaterial({ vertexColors:true, side:T.DoubleSide, roughness:.84 });
const lettuceGeo = ruffle(1, .30, 0x91cc49, 882);
const chiliBody = new T.LatheGeometry([
  new T.Vector2(0,-.6),new T.Vector2(.09,-.55),new T.Vector2(.19,-.34),new T.Vector2(.27,.02),new T.Vector2(.31,.40),new T.Vector2(.23,.58),new T.Vector2(0,.66),
], 28);
for (let i=0, p=chiliBody.attributes.position; i<p.count; i++) {
  p.setX(i, p.getX(i) + .60 * (p.getY(i) - .44) ** 2);
}
chiliBody.computeVertexNormals();

function foodModel(kind, sliced) {
  const root = new T.Group();
  if (kind === 'tomato') {
    if (!sliced) {
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * .4;
        ellipsoid(root,mats.tomato,Math.cos(angle)*.15,.52,Math.sin(angle)*.15,.62,.51,.63);
      }
      for (let i=0;i<5;i++) {
        const a = i * Math.PI * .4;
        ellipsoid(root,mats.vine,Math.cos(a)*.17,.99,Math.sin(a)*.17,.26,.038,.066).rotation.y = -a;
      }
      tube(root,mats.vine,[[0,.96,0],[.025,1.13,0],[.15,1.2,0]],.043);
    } else {
      cylinder(root,mats.tomato,0,.09,0,.89,.17,.86);
      cylinder(root,mats.flesh,0,.179,0,.77,.017,.74);

    }
  } else if (kind === 'lettuce') {
    mesh(root,lettuceGeo,leafy,0,0,0,1,sliced?.62:1.1,1);
    if (!sliced) {
      for(let i=0;i<5;i++) {
        const a=i*Math.PI*.4;
        const leaf=mesh(root,lettuceGeo,leafy,Math.cos(a)*.22,.38,Math.sin(a)*.22,.56,1.1,.50);
        leaf.rotation.set(Math.cos(a)*.8,a,Math.sin(a)*.8);
      }
      ellipsoid(root,mats.lettuce,0,.35,0,.43,.50,.40);
    }
  } else if (kind === 'patty') {
    ellipsoid(root,mats.patty,0,.14,0,.86,.17,.80);
    for (let i=-2;i<=2 && !sliced;i++) ellipsoid(root,mats.grill,i*.24,.298- Math.abs(i)*.012,0,.034,.023,.62-Math.abs(i)*.085).rotation.y=-.22;
    const random = seededRandom(78);
    for (let i=0;i<16 && !sliced;i++) {
      const a=i*Math.PI/8;
      ellipsoid(root,mats.crumbs,Math.cos(a)*.79,.12+random()*.085,Math.sin(a)*.75,.033+random()*.032,.036,.043);
    }
  } else if (kind === 'egg') {
    const shape = new T.Shape();
    for (let i=0;i<=32;i++) {
      const a=i*Math.PI/16;
      const r=.67+.09*Math.sin(a*3)+.06*Math.cos(a*5);
      if (!i) shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);
      else shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);
    }
    shape.closePath();
    mesh(root,rolledShape(shape,.075,.048),mats.egg,0,.045,0).rotation.x=-Math.PI/2;
    ellipsoid(root,mats.yolk,.06,.13,-.06,.31,.12,.29);
    if (!sliced) ellipsoid(root,mats.egg,-.041,.225,-.117,.069,.023,.036);
  } else if (kind === 'cheese' || kind === 'mould') {
    const shape=new T.Shape();
    shape.moveTo(-.76,-.72);
    shape.lineTo(.71,-.76);
    shape.quadraticCurveTo(.78,-.74,.78,-.64);
    shape.lineTo(.79,.64);
    shape.quadraticCurveTo(.78,.72,.70,.73);
    shape.lineTo(-.67,.80);
    shape.quadraticCurveTo(-.78,.80,-.78,.67);
    shape.lineTo(-.81,-.61);
    shape.closePath();
    const mouldy=kind==='mould';
    mesh(root,rolledShape(shape,.071,.036),mouldy?mats.mould:mats.cheese,0,.04,0).rotation.set(-Math.PI/2,0,.11);
    if(mouldy) for(const [x,z,r] of [[-.45,.35,.19],[.11,.17,.12],[-.33,-.48,.15],[.42,-.25,.24],[.54,.49,.10]]) {
      ellipsoid(root,mats.spores,x,.154,z,r,.018,r*.82);
    }
    if (!sliced && !mouldy) for (const [x,z,r] of [[-.36,-.38,.12],[.29,.35,.13],[-.39,.29,.08],[.33,-.39,.09],[.02,.07,.07]]) ellipsoid(root,mats.cheeseHole,x,.151,z,r,.012,r*.82);
  } else if (kind === 'pickle') {
    for (const i of [-1,0,1]) {
      const x=i*.46,z=i*i*.16;
      cylinder(root,mats.pickle,x,.08,z,.33,.15,.29);
      cylinder(root,mats.pickleCore,x,.162,z,.28,.024,.23);
      for(let j=0;j<4 && !sliced;j++) ellipsoid(root,mats.seed,x+.13*Math.cos(j*Math.PI/2),.18,z+.11*Math.sin(j*Math.PI/2),.046,.013,.031);
    }
  } else if (kind === 'coin') {
    const coin = cylinder(root,mats.gold,0,.59,0,.40,.15,.40);
    coin.rotation.x=Math.PI/2;
    mesh(root,new T.TorusGeometry(.31,.026,8,28),mats.goldLight,0,.59,.076);
    mesh(root,new T.TorusGeometry(.31,.026,8,28),mats.goldLight,0,.59,-.076);
    block(root,mats.goldLight,0,.59,.085,.069,.27,.039).rotation.z=.14;
  } else if (kind === 'golden') {
    const shape = new T.Shape();
    for (let i=0;i<10;i++) {
      const a=Math.PI*.5+i*Math.PI*.2, r=i%2?.30:.59;
      if(i) shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      else shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);
    }
    shape.closePath();
    mesh(root,rolledShape(shape,.14,.061),mats.star,0,.74,-.07);
    mesh(root,rolledShape(shape,.016,.025),mats.goldLight,0,.74,.09,.65,.65,1);
    mesh(root,rolledShape(shape,.016,.025),mats.goldLight,0,.74,-.106,.65,.65,1);
  } else if (kind === 'chili') {
    if(sliced) {
      for(const [x,z,r] of [[-.47,.15,.33],[.17,-.19,.30],[.41,.33,.25]]) {
        cylinder(root,mats.chili,x,.055,z,r,.11,r*.80);
        ellipsoid(root,mats.flesh,x,.113,z,r*.68,.014,r*.53);
      }
    } else {
      const pepper=mesh(root,chiliBody,mats.chili,0,.53,0,1,1,1);
      pepper.rotation.z=-.87;
      const stem=tube(root,mats.stem,[[0,.52,0],[0,.70,0],[.15,.79,0]],.067);
      stem.rotation.z=-.87;
      stem.position.set(0,.53,0);
    }
  } else if (kind === 'fish') {
    const y=sliced?.081:.60;
    ellipsoid(root,mats.oldFish,.055,y,0,.67,sliced?.11:.285,.26);
    ellipsoid(root,mats.fishBelly,.12,y-.035,.19,.51,sliced?.06:.15,.095);
    const tail=new T.Shape();
    tail.moveTo(-.50,.03);
    tail.lineTo(-.98,.31);
    tail.quadraticCurveTo(-1.01,.0,-.98,-.29);
    tail.lineTo(-.5,-.04);
    tail.closePath();
    const fin=mesh(root,rolledShape(tail,.062,.034),mats.fishFin,0,y,-.02);
    if(sliced) fin.rotation.x=-Math.PI/2;
    if(!sliced) {
      ellipsoid(root,mats.fishFin,-.15,.84,-.08,.24,.19,.12).rotation.z=.38;
      for(const side of [-1,1]) {
        const z=side*.245;
        ellipsoid(root,mats.egg,.42,.68,z,.122,.119,.049);
        for(const turn of [-.78,.78]) {
          block(root,mats.fishEye,.42,.68,z+side*.04,.136,.035,.017).rotation.z=turn;
        }
        for(let i=0;i<3;i++) ellipsoid(root,mats.fishFin,.25-i*.16,.55,z,.033,.085,.024).rotation.z=.27;
      }
    }
  } else if (kind === 'pin') {
    cylinder(root,mats.pinWood,0,.38,0,.34,1.24,.34).rotation.z=Math.PI/2;
    for(const side of [-1,1]) {
      cylinder(root,mats.pinBand,side*.53,.38,0,.35,.14,.35).rotation.z=Math.PI/2;
      cylinder(root,mats.pinGrip,side*.77,.38,0,.126,.38,.126).rotation.z=Math.PI/2;
      ellipsoid(root,mats.pinGrip,side*.96,.38,0,.11,.13,.13);
    }
    for(let i=0;i<6;i++){
      const angle=i*Math.PI/3;
      const stripe=cylinder(root,mats.crumbs,0,.38+Math.cos(angle)*.336,Math.sin(angle)*.336,.021,.93,.022);
      stripe.rotation.z=Math.PI/2;
    }
  }
  if (!sliced && ['patty','egg','cheese','pickle','mould'].includes(kind)) {
    root.rotation.x=.17;
    root.position.y=.26;
  }
  return root;
}

export function makeFoodLibrary(art) {
  const pickup = {}, layers = {};
  const toast = makeToast(art);
  for (const kind of Object.keys(FILLED)) {
    if(FEATURE_FOODS[kind]) continue;
    pickup[kind] = foodModel(kind, false);
    layers[kind] = foodModel(kind, true);
  }
  pickup.coin=foodModel('coin',false);
  pickup.pin=foodModel('pin',false);
  pickup.golden=foodModel('golden',false);
  return { toast, pickup, layers };
}

function mouthShape() {
  const shape = new T.Shape();
  shape.moveTo(-1.03,.42);
  shape.bezierCurveTo(-.58,.62,.61,.62,1.05,.42);
  shape.bezierCurveTo(1.36,.24,1.07,-.55,.67,-.7);
  shape.bezierCurveTo(.32,-.88,-.32,-.88,-.67,-.7);
  shape.bezierCurveTo(-1.08,-.55,-1.36,.24,-1.03,.42);
  shape.closePath();
  return shape;
}

export function makeChef() {
  const root = new T.Group();
  root.name = 'Chef';
  const skin=material(0xffbb84,.78), cheeks=material(0xf4a47b,.85), ear=material(0xe98561), whites=material(0xfff7e6,.42);
  const brows=material(0x56322b,.75), iris=material(0x3c716a,.36), pupil=material(0x192725,.35);
  const lip=material(0xec7770,.72), tongue=material(0xe65c72,.77);
  const dark=material(0x762d3d,.91);
  const cavity=new T.MeshStandardMaterial({vertexColors:true,roughness:.86});
  const hat=material(0xfff6d8,.87), hatshade=material(0xffe4b3,.84);
  const suit=material(0x287b74,.85), band=material(0xea6a4b,.86);
  const satin=material(0xffbd62,.51), freckles=material(0xc66c49,.89), pleat=material(0xffedc6,.80);
  ellipsoid(root,suit,0,.21,-1.04,3.43,1.6,1.93).castShadow=true;
  ellipsoid(root,pleat,0,-.04,.62,1.73,.65,.53);
  ellipsoid(root,band,-.37,.27,1.53,.45,.28,.25).rotation.z=.26;
  ellipsoid(root,band,.37,.27,1.53,.45,.28,.25).rotation.z=-.26;
  ellipsoid(root,satin,0,.25,1.77,.17,.20,.11);
  const scarf=cylinder(root,band,0,.17,.10,2.32,.48,1.90);
  scarf.rotation.z=.035;
  const face=ellipsoid(root,skin,0,3.12,-.20,2.56,3.10,1.79);
  face.castShadow=true;
  face.receiveShadow=true;
  ellipsoid(root,skin,0,1.15,.18,2.08,1.44,1.58);
  const eyes=[], eyebrows=[], gazes=[], hands=[], blush=[];
  for (const side of [-1,1]) {
    ellipsoid(root,skin,side*2.44,2.79,-.12,.50,.66,.48).rotation.z=-side*.22;
    ellipsoid(root,ear,side*2.58,2.77,.255,.21,.34,.135).rotation.z=-side*.22;
    blush.push(ellipsoid(root,cheeks,side*1.59,2.64,1.20,.51,.40,.28));
    for (let i=0;i<5;i++) {
      const px=1.36+i*.12;
      const py=2.62+Math.sin(i*1.85)*.095;
      ellipsoid(root,freckles,side*px,py,1.46-Math.abs(i-2)*.023,.021+i%2*.011,.022,.017);
    }
    const eye=new T.Group();
    eye.position.set(side*.94,3.61,1.23);
    eye.rotation.y=side*.12;
    root.add(eye);
    ellipsoid(eye,whites,0,0,0,.61,.76,.35);
    const gaze=new T.Group();
    eye.add(gaze);
    ellipsoid(gaze,iris,-side*.035,-.11,.283,.293,.361,.126);
    ellipsoid(gaze,pupil,-side*.037,-.115,.378,.186,.257,.059);
    ellipsoid(gaze,whites,-.082,-.02,.426,.062,.076,.036);
    ellipsoid(gaze,whites,.081,-.17,.424,.029,.034,.021);
    gazes.push(gaze);
    eyes.push(eye);
    const brow=ellipsoid(root,brows,side*.90,4.58,1.25,.60,.154,.20);
    brow.rotation.z=-side*.16;
    eyebrows.push(brow);
    const hand=new T.Group();
    hand.position.set(side*2.30,.32,.10);
    root.add(hand);
    ellipsoid(hand,suit,0,-.13,-.12,.51,1.08,.52).rotation.z=-side*.24;
    ellipsoid(hand,hat,side*.13,.38,.02,.50,.29,.42);
    ellipsoid(hand,satin,side*.26,.38,.425,.11,.105,.047);
    ellipsoid(hand,skin,side*.16,.82,.08,.48,.48,.30);
    ellipsoid(hand,cheeks,side*.16,.78,.32,.32,.24,.08);
    for(let i=0;i<4;i++){
      const finger=ellipsoid(hand,skin,side*(.16+(i-1.5)*.22),1.22-i*.04,.08,.145,.35-i*.025,.166);
      finger.rotation.z=side*(1.2-i)*.15;
    }
    ellipsoid(hand,skin,-side*.26,.87,.17,.16,.29,.19).rotation.z=side*.43;
    hands.push(hand);
  }
  const nose=ellipsoid(root,skin,0,3.25,1.85,.389,.65,.465);
  nose.rotation.x=-.25;
  ellipsoid(root,cheeks,0,2.95,2.02,.34,.22,.28);
  const mouth=new T.Group();
  mouth.position.set(0,1.47,1.62);
  root.add(mouth);
  const shape=mouthShape();
  mesh(mouth,rolledShape(shape,.105,.11),lip,0,0,0,1.43,1.3,1);
  const cavityShape=rolledShape(shape,.03,.045);
  const holes=cavityShape.attributes.position;
  const pigment=[];
  const depthColor=new T.Color(0x3e1829), edgeColor=new T.Color(0x803746);
  for (let i=0;i<holes.count;i++) {
    const variation=T.MathUtils.smoothstep(Math.hypot(holes.getX(i)*.64,holes.getY(i)),.35,.88);
    const shade=depthColor.clone().lerp(edgeColor,variation);
    pigment.push(shade.r,shade.g,shade.b);
  }
  cavityShape.setAttribute('color',new T.Float32BufferAttribute(pigment,3));
  mesh(mouth,cavityShape,cavity,0,-.013,.206,1.28,1.1,1);
  ellipsoid(mouth,tongue,0,-.54,.278,.73,.215,.092);
  ellipsoid(mouth,dark,0,-.49,.373,.023,.074,.009);
  for (let i=-2;i<=2;i++) {
    const tooth=ellipsoid(mouth,whites,i*.31,.441-Math.abs(i)*.021,.279+(2-Math.abs(i))*.019,.182,.143,.100);
    tooth.rotation.z=i*.08;
  }
  const toque=new T.Group();
  toque.name='Chef hat';
  root.add(toque);
  cylinder(toque,hatshade,0,5.28,-.28,2.15,.50,1.71);
  cylinder(toque,hat,0,5.65,-.31,2.12,.67,1.68);
  for (const [x,y,z,sx,sy,sz] of [
    [-1.5,6.04,-.27,1.13,.91,1.40],[-.69,6.47,-.35,1.27,1.04,1.50],
    [.42,6.55,-.47,1.34,1.15,1.63],[1.50,6.15,-.37,1.14,.87,1.4],
  ]) ellipsoid(toque,hat,x,y,z,sx,sy,sz).castShadow=true;
  cylinder(toque,band,0,5.14,-.27,2.13,.13,1.71);
  for (let i=-4;i<=4;i++) {
    if(i===0) continue;
    const px=i*.37;
    const pz=Math.sqrt(1-(px/2.15)**2)*1.71-.29;
    ellipsoid(toque,pleat,px,5.54,pz,.029,.25,.041).rotation.z=i*.036;
  }
  ellipsoid(toque,whites,0,5.22,1.45,.30,.268,.06);
  ellipsoid(toque,band,0,5.22,1.51,.196,.166,.048);
  return { root, eyes, mouth, eyebrows, gazes, hands, toque, skin, cheeks, blush };
}
