import * as T from './vendor/three.js';
import { block,cylinder,ellipsoid,material,mesh,tube,batchMeshes } from './models.js';
import { FEATURE_FOODS } from './feature-courses.js';

const surfaces=new Map();
function sugar(color,roughness=.67) {
  const key=color+'/'+roughness;
  if(!surfaces.has(key))surfaces.set(key,material(color,roughness));
  return surfaces.get(key);
}
const cream=sugar(0xffefd5), syrup=sugar(0x985124,.39), jam=sugar(0xd93752,.36);
const bread=sugar(0xdca162), butter=sugar(0xffc45d), chip=sugar(0xf0ba58);
const red=sugar(0xe97154), white=sugar(0xfff0db), spice=sugar(0xea472f,.48);
const pale=sugar(0xc8c49b), green=sugar(0x729248), purple=sugar(0xad83b3);
const pink=sugar(0xef9cad), chocolate=sugar(0x5f3629,.53);
const steel=new T.MeshStandardMaterial({color:0xd1cad1,metalness:.58,roughness:.34});
const smallRing=new T.TorusGeometry(1,.18,9,30);
const stone=new T.IcosahedronGeometry(1,1);
const cupGeometry=new T.CylinderGeometry(.86,.65,1,25);
const orbGeometry=new T.SphereGeometry(1,22,14);
const confettiRand=(index)=>Math.sin(index*97.13)*.5+.5;

function flatRing(node,surface,x,y,z,radius,depth=radius) {
  const ring=mesh(node,smallRing,surface,x,y,z,radius,depth,radius);
  ring.rotation.x=-Math.PI/2;
  return ring;
}

function pastryShape(parent,outline,tint,height,level=.065,bevel=.056) {
  const shape=new T.Shape();
  outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
  shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{
    depth:height,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,steps:1,curveSegments:12,
  });
  const pastry=mesh(parent,geometry,tint,0,level,0);
  pastry.rotation.x=-Math.PI/2;
  return pastry;
}

function spot(node,surface,x,y,z,scale) {
  return ellipsoid(node,surface,x,y,z,scale,.047,scale*.82);
}

function glaze(node,base,inside,top=.37,wide=.80) {
  cylinder(node,base,0,top*.46,0,wide,top*.92,wide);
  cylinder(node,inside,0,top-.021,0,wide*.83,.078,wide*.83);
  flatRing(node,base,0,top,0,wide*.92,.142);
}

function hotCapsule(node,tint) {
  const tip=ellipsoid(node,tint,.28,.21,0,.54,.17,.29);
  tip.rotation.z=-.21;
  ellipsoid(node,spice,-.27,.32,0,.43,.26,.37).rotation.z=-.11;
  ellipsoid(node,sugar(0x6a8a4b),-.64,.52,.02,.13,.22,.13).rotation.z=.59;
}

function cup(node,dish,contents,height=.69,radius=.52) {
  mesh(node,cupGeometry,dish,0,height*.50,0,radius,height,radius);
  cylinder(node,contents,0,height,.0,radius*.835,.072,radius*.835);
  flatRing(node,dish,0,height,0,radius*.81,.087);
}

const builds={
  pumpkinPasty(node) {
    const boundary=[[-.79,-.34],[.79,-.34]];
    for(let i=0;i<=12;i++){
      const a=i*Math.PI/12;
      boundary.push([Math.cos(a)*.79,-.35+Math.sin(a)*.84]);
    }
    pastryShape(node,boundary,bread,.38);
    ellipsoid(node,sugar(0xe6aa61),0,.43,-.02,.69,.14,.34);
    for(let i=0;i<13;i++){
      const a=i*Math.PI/12;
      ellipsoid(node,chip,Math.cos(a)*.81,.34,.36-Math.sin(a)*.85,.090,.074,.10);
    }
  },
  treacleTart(node) {
    glaze(node,bread,syrup,.34,.77);
    for(const angle of [-.58,.68]) for(let i=-2;i<=2;i++){
      block(node,chip,i*.21,.385,0,.044,.047,1.18-Math.abs(i)*.14).rotation.y=angle;
    }
  },
  chocolateFrog(node) {
    ellipsoid(node,chocolate,0,.25,-.11,.53,.24,.50);
    ellipsoid(node,chocolate,0,.33,.36,.38,.23,.27);
    for(const side of [-1,1]){
      ellipsoid(node,chocolate,side*.46,.19,-.15,.27,.18,.37).rotation.y=side*.42;
      ellipsoid(node,syrup,side*.29,.13,.48,.12,.09,.21);
      ellipsoid(node,chocolate,side*.20,.52,.39,.13,.115,.13);
      ellipsoid(node,sugar(0x422222),side*.20,.53,.50,.052,.05,.039);
    }
  },
  butterbeerFudge(node) {
    for(const [x,z,y] of [[-.35,.16,.24],[.32,.19,.22],[.02,-.34,.38]]){
      const cube=block(node,sugar(0xdba565),x,y,z,.53,.43,.56);
      cube.rotation.y=x*.75;
      block(node,cream,x,y+.17,z,.54,.105,.57).rotation.y=cube.rotation.y;
      spot(node,syrup,x+.11,y+.243,z-.09,.05);
    }
  },
  dragonPepper(node) {
    hotCapsule(node,sugar(0xff9534,.42));
    for(let i=0;i<4;i++)spot(node,butter,-.35+i*.12,.55-i*.048,.08,.048);
  },
  bogeyBean(node) {
    ellipsoid(node,green,0,.34,0,.64,.32,.41).rotation.z=.16;
    ellipsoid(node,pale,.24,.48,.10,.30,.13,.25).rotation.z=.16;
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      spot(node,sugar(0x527244),Math.cos(a)*.41,.507,Math.sin(a)*.24,.061);
    }
  },
  cheesePizza(node) {
    pastryShape(node,[[-.77,.58],[.77,.58],[.05,-.71]],bread,.18);
    pastryShape(node,[[-.61,.48],[.63,.48],[.06,-.55]],butter,.028,.278,.028);
    ellipsoid(node,sugar(0xbf733c),0,.246,-.57,.75,.115,.108);
    for(let i=0;i<7;i++){
      spot(node,chip,Math.sin(i*4.1)*.39,.326,-.38+i*.107,.048+confettiRand(i)*.041);
    }
  },
  sundae(node) {
    const glass=sugar(0x9dd4db,.27);
    cup(node,glass,pink,.47,.49);
    ellipsoid(node,cream,0,.64,0,.46,.34,.43);
    ellipsoid(node,pink,-.25,.64,.12,.27,.25,.24);
    ellipsoid(node,white,0,.94,0,.30,.16,.30);
    ellipsoid(node,jam,.065,1.1,.075,.12,.12,.11);
  },
  moviePopcorn(node) {
    const carton=mesh(node,new T.CylinderGeometry(.59,.39,.79,4),red,0,.405,0,1,1,1);
    carton.rotation.y=Math.PI*.25;
    for(const side of [-1,1])for(const x of [-.18,0,.18]){
      block(node,cream,x,.41,side*.336,.10,.70,.030).rotation.x=side*.18;
    }
    for(let i=0;i<11;i++){
      const a=i*2.4, r=.12+(i%3)*.15;
      ellipsoid(node,i%3?cream:butter,Math.cos(a)*r,.79+confettiRand(i)*.23,Math.sin(a)*r,.15,.14,.15);
    }
  },
  macaroni(node) {
    glaze(node,sugar(0x7baaca),sugar(0xfcc65c),.21,.67);
    for(let i=0;i<8;i++){
      const a=i*2.4, r=.14+i*.047;
      const pasta=flatRing(node,i%3?butter:chip,Math.cos(a)*r,.30,Math.sin(a)*r,.132,.20);
      pasta.rotation.z=a;
      pasta.rotation.x-=.25;
    }
  },
  hotWing(node) {
    ellipsoid(node,red,-.26,.27,.06,.49,.27,.33).rotation.y=-.37;
    ellipsoid(node,spice,-.10,.33,.10,.41,.23,.25).rotation.y=-.22;
    ellipsoid(node,cream,.38,.21,-.12,.35,.085,.096).rotation.y=.31;
    ellipsoid(node,cream,.64,.225,-.19,.14,.105,.115);
  },
  spoiledEggnog(node) {
    const mug=sugar(0xcbd4b8,.44);
    cup(node,mug,pale,.69,.52);
    flatRing(node,mug,.48,.39,0,.29,.15).rotation.set(0,0,0);
    block(node,syrup,-.20,.82,.04,.075,.46,.083).rotation.z=.39;
    for(let i=0;i<5;i++)spot(node,green,(i-2)*.13,.745,Math.sin(i*2.5)*.19,.073);
  },
  giantPancake(node) {
    for(let i=0;i<3;i++){
      const r=.89-i*.045;
      ellipsoid(node,bread,Math.sin(i)*.041,.12+i*.159,0,r,.12,r*.82);
      ellipsoid(node,chip,0,.174+i*.159,.0,r*.95,.071,r*.79);
    }
    ellipsoid(node,syrup,.19,.505,.0,.55,.072,.45);
    block(node,butter,-.11,.585,.05,.36,.091,.27).rotation.y=.30;
  },
  mapleBacon(node) {
    for(let row=0;row<2;row++){
      const z=row*.36-.17;
      const path=Array.from({length:9},(_,i)=>[(i-4)*.191,.23+Math.sin(i*1.2+row)*.103,z]);
      tube(node,red,path,.139,21);
      tube(node,cream,path.map(([x,y,z])=>[x,y+.088,z+.05]),.061,21);
      tube(node,syrup,path.map(([x,y,z])=>[x,y+.102,z-.067]),.043,21);
    }
  },
  hashBrown(node) {
    pastryShape(node,[[-.72,.42],[.59,.56],[.74,.25],[.46,-.59],[-.55,-.39]],bread,.24);
    for(let i=0;i<16;i++){
      const x=(confettiRand(i)-.5)*1.19,z=(confettiRand(i+35)-.5)*.74;
      block(node,i%4?chip:syrup,x,.328,z,.16,.060,.075).rotation.y=i*2.13;
    }
  },
  sausage(node) {
    for(const side of [-1,1]){
      ellipsoid(node,sugar(0xa46242,.51),0,.22,side*.27,.76,.23,.22).rotation.y=side*.18;
      for(let i=-2;i<=2;i++)block(node,syrup,i*.19,.409,side*.27,.047,.020,.26).rotation.y=side*.18-.53;
    }
  },
  hotBiscuit(node) {
    ellipsoid(node,bread,0,.24,0,.67,.22,.56);
    ellipsoid(node,spice,.05,.42,.0,.61,.082,.52);
    ellipsoid(node,chip,-.02,.55,-.05,.66,.17,.55).rotation.z=.15;
    ellipsoid(node,spice,.34,.32,.43,.18,.16,.095);
    for(let i=0;i<7;i++)spot(node,cream,Math.cos(i*2.4)*.53,.65,Math.sin(i*2.4)*.34,.047);
  },
  sourMilk(node) {
    cylinder(node,pale,0,.36,0,.40,.66,.40);
    ellipsoid(node,pale,0,.68,0,.40,.22,.40);
    cylinder(node,cream,0,.86,0,.22,.25,.22);
    cylinder(node,purple,0,1.02,0,.24,.113,.24);
    block(node,green,0,.45,.388,.57,.30,.034);
  },
  scousePie(node) {
    glaze(node,sugar(0xc48354),bread,.52,.73);
    ellipsoid(node,sugar(0xe2a56b),0,.53,0,.68,.15,.67);
    for(let i=-1;i<=1;i++){
      const cut=ellipsoid(node,syrup,i*.19,.672,0,.049,.020,.199);
      cut.rotation.y=-.39;
    }
    cylinder(node,steel,0,.05,0,.734,.093,.734);
  },
  saltPepperChips(node) {
    block(node,red,0,.17,0,1.22,.25,.91);
    for(let i=0;i<12;i++){
      const x=(confettiRand(i)-.5)*.99,z=(confettiRand(i+133)-.5)*.68,y=.32+confettiRand(i+49)*.31;
      const fry=block(node,i%3?chip:butter,x,y,z,.17,.27,.62);
      fry.rotation.set(i*.49,i*2.4,.51);
      if(i%3===0) spot(node,green,x,y+.17,z,.06);
      if(i%4===0) spot(node,spice,x+.09,y+.16,z+.076,.044);
    }
  },
  butteredBarm(node) {
    ellipsoid(node,bread,0,.23,0,.72,.26,.64);
    ellipsoid(node,butter,.10,.42,0,.63,.062,.58);
    ellipsoid(node,sugar(0xeac08c),0,.56,-.01,.73,.27,.65);
    for (let i=0;i<8;i++)spot(node,cream,Math.cos(i*2.4)*.44,.785,Math.sin(i*2.4)*.36,.047);
  },
  jamDoughnut(node) {
    ellipsoid(node,chip,0,.31,0,.67,.30,.59);
    ellipsoid(node,pink,0,.50,0,.56,.13,.51);
    ellipsoid(node,jam,.18,.503,.51,.17,.10,.12);
    for(let i=0;i<11;i++)spot(node,cream,Math.cos(i*2.4)*.47,.57,Math.sin(i*2.4)*.41,.035);
  },
  hotCroquette(node) {
    ellipsoid(node,bread,0,.24,0,.77,.256,.36).rotation.y=-.19;
    ellipsoid(node,spice,.31,.376,.032,.35,.133,.28);
    for(let i=0;i<9;i++)spot(node,chip,(i-4)*.143,.448,Math.sin(i*2.4)*.21,.043);
  },
  spoiledPrawn(node) {
    const shell=mesh(node,new T.TorusGeometry(.43,.19,14,31,Math.PI*1.38),purple,0,.43,0,1,1,1);
    shell.rotation.set(-.33,.20,-.40);
    for(let i=0;i<6;i++){
      const a=.13+i*.68;
      ellipsoid(node,i%2?green:pale,Math.cos(a)*.43,.46+Math.sin(a)*.34,.176,.094,.13,.039).rotation.z=a;
    }
    ellipsoid(node,purple,-.59,.52,.04,.21,.105,.107).rotation.z=-.64;
  },
  dinoNugget(node) {
    pastryShape(node,[[-.77,-.11],[-.50,-.18],[-.42,.14],[-.27,.32],[-.04,.16],[.23,.25],
      [.36,.61],[.55,.68],[.69,.54],[.55,.40],[.49,.11],[.34,-.01],[.27,-.47],
      [.10,-.47],[.08,-.16],[-.23,-.16],[-.30,-.47],[-.47,-.43],[-.43,-.11]],bread,.23);
    for(let i=0;i<8;i++)spot(node,chip,(i-4)*.10,.315,Math.sin(i*1.6)*.18,.041);
  },
  amberJelly(node) {
    block(node,sugar(0xe99e32,.37),0,.40,0,.86,.73,.84).rotation.y=.33;
    block(node,butter,0,.787,0,.86,.054,.84).rotation.y=.33;
    ellipsoid(node,chocolate,.0,.827,0,.067,.019,.12);
    for(const side of [-1,1])ellipsoid(node,syrup,side*.109,.83,0,.067,.015,.102).rotation.y=side*.52;
  },
  fossilCookie(node) {
    glaze(node,sugar(0xc68b51),sugar(0xd5a972),.235,.68);
    const fossil=Array.from({length:22},(_,i)=>{
      const radius=.025+i*.020;
      return [Math.cos(i*.51)*radius,.281,Math.sin(i*.51)*radius];
    });
    tube(node,syrup,fossil,.030,30);
  },
  dinosaurEgg(node) {
    ellipsoid(node,sugar(0xddd1a9),0,.60,0,.48,.70,.46);
    ellipsoid(node,green,0,.16,0,.56,.13,.52);
    for(let i=0;i<11;i++){
      const a=i*2.40,y=.31+i*.069;
      const r=.48*Math.sqrt(1-((y-.60)/.73)**2);
      const patch=ellipsoid(node,i%3?pale:bread,Math.cos(a)*r,y,Math.sin(a)*r,.070,.067,.042);
      patch.rotation.y=-a;
    }
  },
  volcanicChilli(node) {
    hotCapsule(node,chocolate);
    mesh(node,stone,spice,.21,.29,.03,.44,.23,.30).rotation.set(.17,.28,.41);
    ellipsoid(node,sugar(0xf88a28),.52,.245,.03,.24,.16,.21).rotation.z=-.39;
  },
  rottenJungleFruit(node) {
    ellipsoid(node,purple,0,.29,0,.70,.32,.55);
    ellipsoid(node,pale,.09,.46,.00,.57,.15,.46);
    for(let i=0;i<8;i++){
      const r=.28+confettiRand(i)*.13;
      spot(node,i%3?green:sugar(0x6f5f83),Math.cos(i*2.4)*r,.606,Math.sin(i*2.4)*r,.063);
    }
    ellipsoid(node,green,-.51,.54,.05,.18,.21,.13).rotation.z=.54;
  },
  clocktowerWaffle(node) {
    block(node,bread,0,.16,0,1.32,.26,1.19).rotation.y=.12;
    block(node,syrup,0,.30,0,1.25,.06,1.12).rotation.y=.12;
    for(let i=-2;i<=2;i++){
      block(node,butter,i*.25,.338,0,.075,.068,1.14).rotation.y=.12;
      block(node,chip,0,.340,i*.22,1.27,.073,.071).rotation.y=.12;
    }
    block(node,cream,.07,.405,-.04,.046,.064,.64).rotation.y=-.33;
    block(node,jam,.01,.423,.14,.36,.050,.049).rotation.y=-.44;
  },
  cherryPie(node) {
    const wedge=[[-.65,.48],[.66,.48],[.06,-.66]];
    pastryShape(node,wedge,bread,.13);
    pastryShape(node,[[-.58,.44],[.56,.44],[.06,-.54]],jam,.18,.244,.052);
    ellipsoid(node,bread,0,.44,-.455,.65,.119,.105);
    for(let i=0;i<5;i++){
      const y=i*.142-.32;
      block(node,chip,.01,.49,y,1.08-i*.169,.067,.067).rotation.y=-.30;
      ellipsoid(node,jam,(i-2)*.15,.448,-.23,.105,.087,.098);
    }
  },
  onionRings(node) {
    flatRing(node,bread,-.25,.22,.05,.43,.61).rotation.x=-1.31;
    flatRing(node,chip,.23,.29,.04,.49,.64).rotation.x=-1.79;
    flatRing(node,bread,-.04,.49,-.13,.37,.52).rotation.x=-1.75;
  },
  rootBeerFloat(node) {
    const glass=sugar(0xaeb2bf,.39);
    cup(node,syrup,syrup,.68,.48);
    flatRing(node,glass,0,.087,0,.39,.10);
    ellipsoid(node,cream,0,.78,.0,.49,.30,.448);
    ellipsoid(node,white,.0,.96,.06,.26,.178,.25);
    block(node,red,.23,.98,-.13,.07,.52,.079).rotation.z=-.33;
  },
  fluxDog(node) {
    ellipsoid(node,chip,0,.26,0,.77,.25,.49);
    ellipsoid(node,red,0,.47,.03,.81,.24,.28);
    tube(node,butter,Array.from({length:10},(_,i)=>[(i-4.5)*.147,.653,Math.sin(i*Math.PI*.72)*.128]),.049,22);
    for(let i=0;i<5;i++)spot(node,spice,(i-2)*.21,.60,.21,.065);
  },
  sourMilkshake(node) {
    cup(node,purple,pale,.77,.46);
    ellipsoid(node,pale,0,.81,0,.43,.16,.41);
    flatRing(node,cream,0,.42,0,.35,.10);
    for(let i=0;i<6;i++){
      const a=i*2.39;
      spot(node,green,Math.cos(a)*.29,.933,Math.sin(a)*.28,.072);
    }
    block(node,pink,.195,.99,-.144,.082,.55,.081).rotation.z=-.25;
  },
};

function obstacleModel(type) {
  const root=new T.Group();
  const cyan=new T.MeshStandardMaterial({color:0x7dd7fb,emissive:0x4a8de8,emissiveIntensity:.92,roughness:.42});
  switch(type){
    case 'spell':
      mesh(root,orbGeometry,sugar(0xb964cf,.29),0,.59,0,.37,.37,.37);
      for(const spin of [-.60,.62]){
        const ring=mesh(root,smallRing,cyan,0,.59,0,.57,.57,.57);
        ring.rotation.set(.57,spin,spin*2.6);
      }
      break;
    case 'paint':
      cylinder(root,steel,0,.54,0,.36,.78,.36);
      cylinder(root,spice,0,.46,0,.376,.20,.376);
      cylinder(root,cream,0,.91,0,.38,.08,.38);
      tube(root,steel,[[-.36,.74,0],[-.20,1.12,.014],[.17,1.13,.018],[.36,.74,0]],.027);
      break;
    case 'spatula':
      block(root,steel,-.35,.39,0,.58,.12,.42);
      block(root,steel,.11,.39,.0,.39,.081,.121);
      ellipsoid(root,red,.44,.397,.0,.39,.135,.133);
      for(let i=-1;i<=1;i++)block(root,syrup,-.34+i*.145,.455,0,.041,.018,.29);
      break;
    case 'football':
      mesh(root,orbGeometry,white,0,.51,0,.48,.48,.48);
      {
        const pentagon=new T.CircleGeometry(.13,5);
        const patch=sugar(0x41383d);
        for(const [yaw,pitch] of [[0,.39],[1.41,.11],[2.79,.45],[4.05,.24],[5.31,-.39],[.63,-.63]]){
          const pivot=new T.Group();
          root.add(pivot);
          pivot.rotation.set(pitch,yaw,.11);
          pivot.position.y=.51;
          const meshPart=mesh(pivot,pentagon,patch,0,0,.469);
          meshPart.rotation.z=.15;
        }
      }
      break;
    case 'boulder':
      mesh(root,stone,sugar(0x8f8d67),0,.52,0,.54,.52,.60).rotation.set(.34,.87,.04);
      mesh(root,stone,sugar(0xb2a477),.18,.66,.32,.21,.24,.20).rotation.set(.67,.23,.76);
      break;
    case 'flux':
      mesh(root,stone,steel,0,.48,0,.39,.45,.38).rotation.y=.43;
      for(const side of [-1,1]){
        const glow=mesh(root,smallRing,cyan,side*.22,.50,0,.37,.37,.37);
        glow.rotation.y=Math.PI*.50;
      }
      break;
  }
  return root;
}

export function makeFeatureFood(theme) {
  const pickups={}, layers={};
  const bounds=new T.Box3();
  for(const key of [...theme.foods,theme.hot,theme.spoiled]){
    const model=new T.Group();
    builds[key](model);
    batchMeshes(model);
    pickups[key]=model;
    const sliced=model.clone(true);
    bounds.setFromObject(model);
    const scale=FEATURE_FOODS[key].height/(bounds.max.y-bounds.min.y);
    sliced.scale.y=scale;
    sliced.position.y=-bounds.min.y*scale;
    const root=new T.Group();
    root.add(sliced);
    layers[key]=root;
  }
  return {pickups,layers,obstacle:obstacleModel(theme.obstacle)};
}
