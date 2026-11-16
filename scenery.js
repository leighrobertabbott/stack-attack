import * as T from './vendor/three.js';
import { ball, mesh, block, ellipsoid, cylinder, material, tube, batchMeshes } from './models.js';
import { pathX, pathY, pathWidth, seededRandom } from './stages.js';
import { makeStageWorld } from './stage-worlds.js';
import { makeFeatureWorld } from './feature-worlds.js';

const rgba = (hex) => new T.Color(hex);
const vTemp = new T.Object3D();
const markGeo = new T.BoxGeometry(1,1,1);
const cliffGeometry = new T.IcosahedronGeometry(1, 1);
const bouquetGeometry = new T.IcosahedronGeometry(1, 1);

export function createAtmosphere(scene, art) {
  const sky = new T.Mesh(new T.SphereGeometry(450,40,22), new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: {
      top: {value:new T.Color()}, horizon: {value:new T.Color()},
      paintedSky: {value:art.sky}, artMix: {value:0}, grade: {value:0}, portrait: {value:0}, daylight:{value:1},
    },
    vertexShader:`
      varying vec3 direction;
      void main(){
        direction=normalize(position);
        gl_Position=projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader:`
      varying vec3 direction;
      uniform vec3 top;
      uniform vec3 horizon;
      uniform sampler2D paintedSky;
      uniform float artMix;
      uniform float grade;
      uniform float portrait;
      uniform float daylight;

      void main(){
        vec3 dir=normalize(direction);
        float elevation=atan(dir.y,length(dir.xz));
        float azimuth=atan(dir.x,-dir.z);
        float height=pow(smoothstep(-.08,.74,dir.y),.70);
        vec3 base=mix(horizon,top,height);
        vec2 artUV=vec2(.50+azimuth*mix(.53,1.18,portrait),.225+elevation*1.49);
        vec3 painted=texture2D(paintedSky,clamp(artUV,.001,.999)).rgb;
        float reducedBlue=smoothstep(.06,.46,painted.b-painted.r);
        vec3 tint=mix(horizon,top,reducedBlue);
        painted=mix(painted,mix(painted*.54,tint,.61),grade);
        float framing=1.-smoothstep(.91,1.26,abs(azimuth));
        vec3 rgb=mix(base,painted,artMix*framing*smoothstep(-.09,.09,dir.y));
        float sun=max(0.,dot(dir,normalize(vec3(-.62,.32,-1.))));
        rgb+=(vec3(.46,.31,.14)*pow(sun,23.)+vec3(.7,.5,.28)*pow(sun,280.))*daylight;
        gl_FragColor=vec4(rgb,1.);
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder=-20;
  sky.frustumCulled=false;
  scene.add(sky);
  const water = new T.Mesh(new T.PlaneGeometry(1350,1350),new T.ShaderMaterial({
    uniforms:{
      t:{value:0}, deep:{value:new T.Color()}, shallow:{value:new T.Color()},
      horizon:{value:new T.Color()}, glints:{value:art.caustic}, textureMix:{value:0},daylight:{value:1},
      ground:{value:new T.Color()},terrain:{value:0},dust:{value:art.rock},
    },
    vertexShader:`
      varying vec3 world;
      void main(){
        world=(modelMatrix * vec4(position,1.0)).xyz;
        gl_Position=projectionMatrix * viewMatrix * vec4(world,1.0);
      }`,
    fragmentShader:`
      uniform float t;
      uniform vec3 deep;
      uniform vec3 shallow;
      uniform vec3 horizon;
      uniform sampler2D glints;
      uniform float textureMix;
      uniform float daylight;
      uniform float terrain;
      uniform vec3 ground;
      uniform sampler2D dust;
      varying vec3 world;

      void main(){
        vec2 p=world.xz;
        vec3 sight=normalize(cameraPosition-world);
        float d=length(world-cameraPosition);
        if(terrain>.5) {
          float grain=texture2D(dust,p*.132).r;
          float body=.93+.15*grain+.08*sin(p.x*.21+p.y*.13);
          if(terrain<1.5||terrain>2.5&&terrain<3.5) {
            vec2 cell=fract(p*.37);
            vec2 edge=min(cell,1.-cell);
            body*=mix(.62,1.,smoothstep(.005,.022,min(edge.x,edge.y)));
            body*=1.-.12*mod(floor(p.x*.37)+floor(p.y*.37),2.);
          } else if(terrain>3.5&&terrain<4.5) {
            body*=.92+.154*mod(floor(p.y*.16),2.);
          }
          vec3 tone=mix(ground*body,horizon,smoothstep(25.,180.,d)*.92);
          gl_FragColor=vec4(tone,1.);
          #include <colorspace_fragment>
          return;
        }
        float swellA=dot(p,vec2(.47,.63))+t*.73+sin(p.y*.21)*1.35;
        float swellB=dot(p,vec2(-.85,.38))-t*.61+sin(p.x*.31)*.76;
        float swellC=dot(p,vec2(.53,1.24))+t*.85+sin(p.x*.47-p.y*.12)*1.6;
        float capillary=dot(p,vec2(2.1,.67))+t*1.86+sin(p.y*.43)*.92;
        vec3 normal=normalize(vec3(
          .075*cos(swellA)-.064*cos(swellB)+.061*cos(swellC)+.043*cos(capillary),1.,
          .069*cos(swellA)+.063*cos(swellB)+.10*cos(swellC)+.026*cos(capillary)));
        float facing=clamp(dot(sight,normal),0.,1.);
        float fresnel=pow(1.-facing,4.25);
        float shoal=sin(p.x*.105+p.y*.056+1.2)+.64*cos(p.y*.061-p.x*.073);
        float light=clamp(.5+shoal*.29+cos(swellA)*.074+sin(swellB)*.033,0.,1.);
        vec3 colour=mix(deep,shallow,light);
        vec2 uv=p*.112+normal.xz*.30+vec2(-.015,.018)*t;
        float pattern=texture2D(glints,uv).g;
        float caustic=smoothstep(.29,.86,pattern)*textureMix*light*light*exp(-d*.033);
        colour+=vec3(.079,.27,.20)*caustic;
        float reflectedSun=max(0.,dot(reflect(-normalize(vec3(-.62,.32,-1.)),normal),sight));
        colour=mix(colour,horizon,fresnel*.34);
        float flash=.53+.47*smoothstep(-.2,.9,sin(p.x*2.2+p.y*1.27+t*1.35)*sin(p.y*1.61-p.x*.97));
        colour+=vec3(.61,.50,.31)*pow(reflectedSun,75.)*.60*flash*exp(-d*.004)*daylight;
        colour+=vec3(.23,.41,.35)*pow(reflectedSun,18.)*.19*daylight;
        float lace=sin(p.y*2.66+sin(p.x*1.31+t*.82)*1.43-t*.72+cos(p.y*.50+p.x*.25)*1.7);
        float cut=sin(p.x*.94-p.y*.37+t*.21);
        colour+=vec3(.065,.18,.15)*smoothstep(.92,.998,lace)*smoothstep(.41,.98,cut)*exp(-d*.043);
        colour=mix(colour,horizon,smoothstep(28.,250.,d)*.88);
        gl_FragColor=vec4(colour,1.);
        #include <colorspace_fragment>
      }`,
  }));
  water.rotation.x=-Math.PI/2;
  water.position.y=-1.23;
  water.renderOrder=-10;
  scene.add(water);
  const fog=new T.FogExp2('#b8eee8',.0064);
  scene.fog=fog;
  let artOpacity=0;
  let activeSky=art.sky;
  return {
    tint(theme) {
      activeSky=art[theme.skyArt]??art.sky;
      artOpacity=activeSky.userData.loaded?1:0;
      sky.material.uniforms.paintedSky.value=activeSky;
      const sun=theme.world==='harbor'?.19:1;
      sky.material.uniforms.daylight.value=sun;
      water.material.uniforms.daylight.value=sun;
      sky.material.uniforms.top.value.set(theme.sky);
      sky.material.uniforms.horizon.value.set(theme.horizon);
      sky.material.uniforms.grade.value=theme.grade??0;
      water.material.uniforms.shallow.value.set(theme.shallow);
      water.material.uniforms.deep.value.set(theme.deep);
      water.material.uniforms.horizon.value.set(theme.horizon);
      const terrain={stone:1,snow:2,ceramic:3,brick:4,fossil:5,asphalt:6};
      water.material.uniforms.terrain.value=terrain[theme.deck]??0;
      water.material.uniforms.ground.value.set(theme.ground??'#329788');
      water.material.uniforms.dust.value=theme.deck==='snow'||theme.deck==='asphalt'?art.sand:art.rock;
      water.position.y=theme.ground?-.46:-1.23;
      fog.density=theme.fog??.0064;
      fog.color.set(theme.horizon);
    },
    tick(time,camera) {
      artOpacity=Math.min(1,artOpacity+(activeSky.userData.loaded ? .055 : 0));
      sky.material.uniforms.artMix.value=artOpacity;
      sky.material.uniforms.portrait.value=1-T.MathUtils.smoothstep(camera.aspect,.76,1.35);
      water.material.uniforms.t.value=time;
      water.material.uniforms.textureMix.value=Number(Boolean(art.caustic.userData.loaded));
      sky.position.copy(camera.position);
      water.position.z=camera.position.z-90;
    },
  };
}

function instanced(parent, list, instanceMaterial, geometry = markGeo) {
  const batch=new T.InstancedMesh(geometry,instanceMaterial,list.length);
  list.forEach((part,i)=>{
    const [x,y,z,sx,sy,sz,color,angle=0,pitch=0]=part;
    vTemp.position.set(x,y,z);
    vTemp.scale.set(sx,sy,sz);
    vTemp.rotation.set(pitch,angle,0,'YXZ');
    vTemp.updateMatrix();
    batch.setMatrixAt(i,vTemp.matrix);
    batch.setColorAt(i,new T.Color(color));
  });
  parent.add(batch);
  return batch;
}

function signTexture(label, sub, tint = '#f7c279') {
  const canvas=Object.assign(document.createElement('canvas'),{width:512,height:256});
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#9c5e41';
  ctx.fillRect(0,0,512,256);
  ctx.fillStyle=tint;
  ctx.fillRect(11,11,490,234);
  ctx.strokeStyle='#9c5e41';
  ctx.lineWidth=3;
  ctx.strokeRect(25,24,462,208);
  ctx.fillStyle='#663f32';
  ctx.textAlign='center';
  ctx.font='900 64px system-ui';
  ctx.fillText(label,256,125,425);
  ctx.font='800 30px system-ui';
  ctx.fillText(sub,256,183,420);
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  return texture;
}

function leafFanGeometry(length,width,rise) {
  const vertices=[],colors=[],uvs=[],indices=[];
  const segments=24, across=6, row=across+1;
  for(let i=0;i<=segments;i++){
    const t=i/segments;
    const belly=Math.sin(t*Math.PI)**.78;
    for(let j=0;j<=across;j++){
      const u=j/across*2-1;
      const fingers=1+.13*Math.sin(i*3.25+j*.33)*Math.abs(u)**3;
      const wide=width*belly*(1-.31*t)*fingers;
      const x=wide*u+.12*Math.sin(t*2.7);
      const y=rise*Math.sin(t*Math.PI)-.81*t*t-.27*belly*Math.abs(u)**1.2;
      vertices.push(x,y,length*t);
      uvs.push(j/across,t);
      const light=.56+.38*belly+.11*(1-Math.abs(u));
      colors.push(light,Math.min(1,light+.085),light*.82);
      if(i===0 || j===0) continue;
      const b=i*row+j;
      indices.push(b-row-1,b-1,b-row,b-row,b-1,b);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function coastGeometry(sx,sz,edge) {
  const positions=[], tint=[], uvs=[], faces=[];
  const profile=[
    [.001,.30],[.23,.30],[.52,.24],[.73,.11],[.85,-.12],[.95,-.44],[1.012,-.83],
    [1.066,-1.21],[1.13,-1.53],[1.18,-1.86],
  ];
  const sand=new T.Color(0xffe5bb), wet=new T.Color(0xab9471);
  const arcs=60;
  for (const [i,[r,level]] of profile.entries()) {
    for (let j=0;j<=arcs;j++) {
      const a=j/arcs*Math.PI*2, orbital=edge(a);
      const x=Math.cos(a)*r*orbital, z=Math.sin(a)*r*orbital;
      const y=level+Math.sin(a*3.0+r*3)*.19*r+Math.cos(a*7.0+r)*.072*r;
      positions.push(x*sx,y,z*sz);
      uvs.push(x*sx*.64,z*sz*.64);
      const shade=sand.clone().lerp(wet,T.MathUtils.smoothstep(-y,.14,1.31));
      shade.multiplyScalar(.95+.055*Math.sin(a*9.3+r*8));
      tint.push(shade.r,shade.g,shade.b);
      if (i===0 || j===0) continue;
      const d=i*(arcs+1)+j, b=d-1, a0=b-arcs-1, c=d-arcs-1;
      faces.push(a0,c,b,b,c,d);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(tint,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geo.setIndex(faces);
  geo.computeVertexNormals();
  return geo;
}

export function makeCourse(stage, preview, art) {
  const root=new T.Group();
  const random=seededRandom(stage.seed);
  const theme=stage.theme;
  const length=preview?37:stage.length;
  const stageWorld=theme.foods?makeFeatureWorld(stage,root,art):makeStageWorld(stage,root,art);
  const resources=new Set();
  const windy=[], floating=[], birds=[], pennants=[], islands=[], sails=[];
  const windMatrix=new T.Matrix4();
  const windEntries=new WeakMap();
  const own=(asset)=>{resources.add(asset);return asset;};
  const surface=(color,rough)=>own(material(color,rough));
  const sharedWhite=surface(0xffffff,.91);
  const deckWood=surface(0xffffff,.72);
  const pavement=['snow','asphalt'].includes(theme.deck)?art.sand:art.rock;
  deckWood.map=theme.deck?pavement:art.wood;
  deckWood.bumpMap=deckWood.map;
  deckWood.bumpScale=theme.deck==='ceramic'?.024:.075;
  if(theme.deck==='ceramic')deckWood.roughness=.47;
  const timber=surface(0xb96b41);
  const red=surface(theme.trim);
  const vanilla=surface(0xffecd0);
  const leafColors=[theme.leaf??0x4f9f61,0x7dae68,0x9dcc67,0x699967].map(color=>
    own(new T.MeshStandardMaterial({color,map:art.palmLeaf,vertexColors:true,side:T.DoubleSide,roughness:.83})));
  const shrubs=[0x4a9f5a,0x72b963,0xa1c968].map(color=>surface(color,.87));
  const coast=own(new T.MeshStandardMaterial({ color:0xffffff,map:art.sand,bumpMap:art.sand,bumpScale:.045,vertexColors:true,roughness:.97 }));
  const coastSide=surface(0xe0a36f);
  const bark=own(new T.MeshStandardMaterial({color:0xeac19b,map:art.palmBark,bumpMap:art.palmBark,bumpScale:.09,roughness:.95}));
  const darkRock=own(new T.MeshStandardMaterial({color:0x9eab97,map:art.rock,roughness:.95}));
  const lightRock=own(new T.MeshStandardMaterial({color:0xd1c8a8,map:art.rock,roughness:.92}));
  const coconut=surface(0x9d6346);
  const paintedTeal=surface(0x328b87,.58);
  const brass=new T.MeshStandardMaterial({color:0xffbd5b,metalness:.51,roughness:.38});
  own(brass);
  const foamPrototype=own(new T.RingGeometry(.87,1.38,72,5));
  const foamSurface=own(new T.ShaderMaterial({
    transparent:true,
    depthWrite:false,
    uniforms:{ t:{value:0} },
    vertexShader:`
      attribute vec2 edgeSample;
      varying vec2 shore;
      varying vec3 world;
      void main(){
        shore=edgeSample;
        world=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
      }`,
    fragmentShader:`
      uniform float t;
      varying vec2 shore;
      varying vec3 world;
      void main(){
        float theta=atan(shore.y,shore.x);
        float r=length(shore);
        float tide=.026*sin(t*1.47+theta*3.)+.016*cos(theta*13.+t);
        float edge=1.078+.021*sin(theta*7.)+.012*cos(theta*19.);
        float waterline=r-edge;
        float main=max(0.,1.-abs(waterline-tide)*35.);
        float second=max(0.,1.-abs(waterline-.11-tide*1.64)*27.);
        float grain=sin(theta*61.+r*216.+t*5.3)*cos(theta*44.-r*132.);
        float broken=.44+.56*smoothstep(-.4,.8,sin(theta*11.+t*1.2));
        float fall=exp(-.010*length(world-cameraPosition));
        float alpha=(main*.73+second*.35)*broken*fall*(.7+grain*.27);
        gl_FragColor=vec4(.75,1.,.94,alpha);
        #include <colorspace_fragment>
      }`,
  }));
  const theLeaf=own(leafFanGeometry(3.1,.54,1.0));
  const trunkGeometry=own(new T.TubeGeometry(
    new T.CatmullRomCurve3([[0,0,0],[.18,1.45,0],[.52,3.05,.14],[.67,4.78,.28]].map(point=>new T.Vector3(...point))),
    17,.174,10,false,
  ));
  const deck=[],rail=[],pilings=[],plankGrain=[], accents=[], paving=[];
  const boards=[theme.sand,rgba(theme.sand).lerp(rgba(theme.plank),.31),rgba(theme.sand).lerp(rgba('#fff6cf'),.28)];

  const step=theme.lift?1.75:2.20;
  for(let s=-20,index=0;s<length+1;s+=step,index++) {
    const dx=(pathX(stage,s+.15)-pathX(stage,s-.15))/.3;
    const dy=(pathY(stage,s+.15)-pathY(stage,s-.15))/.3;
    const heading=-Math.atan(dx), pitch=Math.atan(dy/Math.hypot(1,dx));
    const x=pathX(stage,s), y=pathY(stage,s), width=pathWidth(stage,s);
    const boardLength=(step+.015)*Math.hypot(1,dx,dy);
    const edge=width*.5;
    deck.push([x,y-.18,-s,width,.35,boardLength-.038,boards[Math.floor(random()*3)],heading,pitch]);
    if(theme.deck==='brick'||theme.deck==='ceramic'||theme.deck==='stone'){
      const count=theme.deck==='ceramic'?5:theme.deck==='brick'?7:4;
      for(let tile=0;tile<count;tile++){
        const across=((tile+.5)/count-.5)*width;
        const tone=theme.deck==='ceramic'?((tile+index)%2?0xd7a391:0xffe3b7):
          rgba(theme.sand).lerp(rgba(theme.plank),.22+(tile+index)%3*.17);
        paving.push([x+across*Math.cos(heading),y+.011,-s-across*Math.sin(heading),width/count-.038,.038,boardLength-.057,tone,heading,pitch]);
      }
    }
    for(const side of [-1,1]){
      const rimX=x+side*edge*Math.cos(heading),rimZ=-s-side*edge*Math.sin(heading);
      rail.push([rimX,y-.025,rimZ,.25,.30,boardLength,theme.plank,heading,pitch]);
      const stripe=theme.deck==='asphalt'?0x90cbfb:theme.deck==='snow'?0xf4f1ff:0xffedbd;
      rail.push([x+side*(edge-.20)*Math.cos(heading),y+.013,-s-side*(edge-.20)*Math.sin(heading),.10,.031,boardLength,stripe,heading,pitch]);
      if(index%3===0) {
        const leg=y+1.54;
        pilings.push([rimX-side*.37,(y-1.54)*.5,-s,.33,leg,.36,0x9d644e,heading]);
        accents.push([rimX-side*.11,y+.32,rimZ,.19,.64,.19,0xffecd0,heading]);
        accents.push([rimX-side*.11,y+.61,rimZ,.25,.16,.26,theme.trim,heading]);
      }
    }
    for(let i=0;i<7;i++){
      const across=(random()-.5)*(width-.8), along=(random()-.5)*(step-.4);
      plankGrain.push([x+across*Math.cos(heading)+along*Math.sin(heading),y+.003-along*Math.sin(pitch),-s+along*Math.cos(heading)-across*Math.sin(heading),
        .12+random()*.8,.008,.008+random()*.01,rgba(theme.sand).lerp(rgba(theme.plank),.32),heading,pitch]);
    }
  }
  instanced(root,deck,deckWood).receiveShadow=true;
  if(paving.length)instanced(root,paving,theme.deck==='ceramic'?sharedWhite:deckWood).receiveShadow=true;
  instanced(root,rail,sharedWhite).receiveShadow=true;
  instanced(root,accents,sharedWhite).castShadow=true;
  instanced(root,plankGrain,sharedWhite);
  if(pilings.length) instanced(root,pilings,sharedWhite);

  const platformX=pathX(stage,length);
  const finishZ=-length;
  block(root,timber,platformX,-.33,finishZ-2.2,10.8,.62,9.4).receiveShadow=true;
  block(root,vanilla,platformX,-.037,finishZ-2.2,10.8,.13,9.3).receiveShadow=true;
  const finish=[];
  for(let z=0;z<8;z++){
    for(let x=0;x<10;x++) {
      const color=(x+z)%2 ? (z<3 ? 0xa56645 : 0xd99562) : 0xffefc7;
      finish.push([platformX-4.95+x*1.10,.041,finishZ+1.65-z*.85,1.10,.029,.85,color]);
    }
  }
  instanced(root,finish,sharedWhite).receiveShadow=true;
  const cloth=[theme.trim,0xffd47f,0x74d5b2,0xffe8ba].map(color=>
    own(new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:.85})));
  const flagGeo=own(new T.BufferGeometry());
  flagGeo.setAttribute('position',new T.Float32BufferAttribute([
    -.29,0,0, .29,0,0, .07,-.59,.105, -.12,-.25,.065, .14,-.25,.12
  ],3));
  flagGeo.setIndex([0,1,4,0,4,3,3,4,2]);
  flagGeo.computeVertexNormals();
  const plate=new T.CircleGeometry(.80,37);
  own(plate);
  const plateIcon=own(new T.MeshStandardMaterial({
    map:art.sandwich,transparent:true,alphaTest:.16,roughness:.77,depthWrite:true,
  }));
  const signCaption=own(signTexture('ORDER UP','TIDAL DINER','#ffdb94'));
  const signFace=own(new T.MeshStandardMaterial({map:signCaption,roughness:.75}));
  const signPlane=own(new T.PlaneGeometry(1.98,.99));
  for (const side of [-1,1]) {
    const x=platformX+side*4.42,z=finishZ-1.45;
    const post=cylinder(root,paintedTeal,x,1.57,z,.23,3.15,.23);
    post.castShadow=true;
    cylinder(root,brass,x,.16,z,.35,.20,.35);
    cylinder(root,brass,x,3.12,z,.27,.16,.27);
    for(let n=0;n<6;n++) cylinder(root,n%2?red:vanilla,x,.57+n*.33,z,.239,.22,.239);
    ellipsoid(root,brass,x,3.33,z,.19,.23,.19);
    const backX=platformX+side*5.42,backZ=finishZ-5.6;
    cylinder(root,paintedTeal,backX,2.24,backZ,.18,4.49,.18);
    ellipsoid(root,brass,backX,4.53,backZ,.20,.23,.20);
    const ropePoints=[];
    for(let i=0;i<=8;i++){
      const t=i/8;
      const fx=T.MathUtils.lerp(x,backX,t), fz=T.MathUtils.lerp(z,backZ,t);
      const y=T.MathUtils.lerp(3.16,4.43,t)-.44*Math.sin(Math.PI*t);
      ropePoints.push([fx,y,fz]);
      if(i%2===0 || i===8) continue;
      const flag=mesh(root,flagGeo,cloth[(i+side+4)%cloth.length],fx,y,fz);
      pennants.push({ flag, phase:i+side,yaw:side*.75 });
    }
    own(tube(root,timber,ropePoints,.028,18).geometry);
    if(side<0){
      block(root,timber,x-side*.07,2.01,z+.16,2.08,1.11,.18).rotation.z=.037;
      mesh(root,signPlane,signFace,x-side*.07,2.01,z+.255).rotation.z=.037;
    } else {
      const plaque=cylinder(root,paintedTeal,x,2.02,z+.245,.99,.21,.99);
      plaque.rotation.x=Math.PI/2;
      const ring=own(new T.TorusGeometry(.88,.043,8,40));
      mesh(root,ring,brass,x,2.02,z+.369);
      mesh(root,plate,plateIcon,x,2.02,z+.375);
    }
  }

  function palm(parent,x,y,z,height,lean) {
    const crown=new T.Group();
    root.add(crown);
    crown.position.set(x,y,z);
    crown.scale.setScalar(height/5);
    crown.rotation.y=lean;
    mesh(crown,trunkGeometry,bark);
    for(let i=1;i<=7;i++) {
      const t=i/8;
      const stripe=cylinder(crown,coastSide,.70*t,t*4.78,.28*t,.181,.047,.181);
      stripe.rotation.z=-.13;
    }
    const turn=random()*.65;
    for(let i=0;i<8;i++){
      const frond=mesh(crown,theLeaf,leafColors[i%4],.67,4.79,.28,1,1, .76+random()*.34);
      frond.rotation.y=i*Math.PI/4+turn;
      frond.rotation.x=(random()-.48)*.32;
      const wind={frond,pitch:frond.rotation.x,phase:random()*6,z};
      windEntries.set(frond,wind);
      windy.push(wind);
    }
    for(let i=0;i<3;i++) ellipsoid(crown,coconut,.64+i*.14,4.65,.19+i*.10,.22,.20,.24);
    parent.attach(crown);
  }

  function island(x,z,sx,sz,features) {
    const land=new T.Group();
    land.position.set(x,0,z);
    root.add(land);
    islands.push(land);
    const drift=random()*5.8;
    const edge=(heading)=>1+.12*Math.sin(heading*3+drift)+.057*Math.cos(heading*5-drift)+.028*Math.sin(heading*9+drift);
    mesh(land,own(coastGeometry(sx,sz,edge)),coast).receiveShadow=true;
    const foamGeometry=own(foamPrototype.clone());
    const p=foamGeometry.attributes.position;
    const samples=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i), y=p.getY(i), shape=edge(Math.atan2(-y,x));
      samples.push(x,y);
      p.setXY(i,x*shape,y*shape);
    }
    foamGeometry.setAttribute('edgeSample',new T.Float32BufferAttribute(samples,2));
    const foam=mesh(land,foamGeometry,foamSurface,0,-1.216,0,sx,sz,1);
    foam.rotation.x=-Math.PI/2;
    foam.renderOrder=1;
    for(let k=0;k<7;k++){
      const a=k*Math.PI*2/7+random()*.66;
      const rim=.50+random()*.49;
      const horizontal=.54+random()*.82;
      const rock=mesh(land,cliffGeometry,k%3?darkRock:lightRock,Math.cos(a)*sx*rim,-.32+.43*(1-rim),Math.sin(a)*sz*rim,horizontal,.32+random()*.57,.53+random()*.76);
      rock.rotation.set(random(),random()*3,random());
    }
    for(let j=0;j<features;j++){
      const dx=(random()-.50)*sx*1.04,dz=(random()-.50)*sz*1.05;
      palm(land,x+dx,.16,z+dz,3.5+random()*3.45,random()*6);
      for(let k=0;k<4;k++){
        const a=k*1.82+random()*.44;
        const rad=.33+random()*.59;
        mesh(land,bouquetGeometry,shrubs[k%shrubs.length],dx+Math.cos(a)*rad,.08,dz+Math.sin(a)*rad,.47,.28+random()*.30,.43);
      }
    }
    return land;
  }

  function umbrella(land,x,z,scale) {
    const root=new T.Group();
    land.add(root);
    root.position.set(x,-.17,z);
    root.scale.setScalar(scale);
    cylinder(root,timber,0,1.09,0,.054,2.18,.054);
    for(let i=0;i<10;i++){
      const canopy=own(new T.ConeGeometry(1.36,.57,12,1,true,i*Math.PI/5,Math.PI/5));
      mesh(root,canopy,i%2?vanilla:red,0,2.00,0).castShadow=true;
    }
    ellipsoid(root,red,0,2.31,0,.13,.1,.13);
    block(root,vanilla,.78,.23,.15,.62,.065,1.1).rotation.y=-.37;
    block(root,red,.78,.26,.15,.51,.043,.86).rotation.y=-.37;
  }

  if(theme.world==='shore') {
    const near=island(11.7,-24.2,4.85,3.85,3);
    umbrella(near,-.6,1.0,1.0);
    umbrella(near,1,-.65,.77);
    const far=island(-17,-40,7.80,5.55,4);
    const nearLeft=island(-12.2,-13.4,3.10,2.16,1);
    umbrella(nearLeft,.10,0,.78);

    // The lighthouse gives the shore a recognizable silhouette at a distance.
    const tower=new T.Group();
    far.add(tower);
    tower.position.set(-1.9,-.22,-.9);
    for(let i=0;i<6;i++) {
      mesh(tower,own(new T.CylinderGeometry(1.02-i*.08,1.1-i*.08,.77,16)),i%2?red:vanilla,0,i*.77+.39,0);
    }
    cylinder(tower,vanilla,0,4.66,0,.82,.17,.82);
    cylinder(tower,surface(0x91c7b9),0,4.99,0,.52,.52,.52);
    mesh(tower,own(new T.ConeGeometry(.88,.63,16)),red,0,5.55,0);
    cylinder(tower,red,0,5.94,0,.044,.23,.044);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      cylinder(tower,timber,Math.cos(a)*.56,4.99,Math.sin(a)*.56,.032,.57,.032);
    }
    const right=island(20,-52,7.6,4.7,4);
    umbrella(right,-2,1,.89);
    for(let i=0;i<(preview?3:9);i++){
      const side=i%2?1:-1;
      island(side*(15+random()*16),-66-i*14,5+random()*9,3+random()*4,2+(i%2));
    }

    const canvasSail=own(new T.MeshStandardMaterial({
      color:0xffedca,side:T.DoubleSide,roughness:.91,
    }));
    const sailShape=own(new T.BufferGeometry());
    sailShape.setAttribute('position',new T.Float32BufferAttribute([
      0,.25,.035, 0,2.5,.02, .40,1.52,-.19, .92,.67,-.36, 1.26,.25,-.49,
    ],3));
    sailShape.setIndex([0,2,1,0,3,2,0,4,3]);
    sailShape.computeVertexNormals();
    for (const [i,z] of [-23,-57,-96,-136,-188].entries()) {
      if(preview && i>2) break;
      const sailboat=new T.Group();
      const breeze=i*2.3;
      const x=(i%2?1:-1)*(22+i%3*4);
      sailboat.scale.setScalar(.81+random()*.34);
      root.add(sailboat);
      ellipsoid(sailboat,paintedTeal,0,.13,0,.51,.25,1.13);
      ellipsoid(sailboat,vanilla,0,.20,0,.48,.10,1.13);
      cylinder(sailboat,timber,-.09,1.24,0,.047,2.34,.047);
      mesh(sailboat,sailShape,canvasSail,-.14,.22,0).rotation.y=-.73;
      mesh(sailboat,sailShape,cloth[0],-.036,.39,.073,.67,.63,.61).rotation.y=2.7;
      sails.push({ sailboat,x,z,breeze });
    }

  }

  const wingtip=surface(0x586f77,.82);
  const orange=surface(0xe99a49,.77);
  for (let i=0;i<(theme.world==='shore'?4:theme.world==='reef'?2:0);i++) {
    const body=new T.Group();
    root.add(body);
    body.scale.setScalar(i<2?.92:.64);
    const wings=[];
    ellipsoid(body,vanilla,0,0,0,.22,.19,.44);
    ellipsoid(body,vanilla,0,.13,.29,.18,.19,.19);
    ellipsoid(body,orange,0,.10,.48,.09,.055,.17);
    for (const side of [-1,1]) {
      const wing=new T.Group();
      wing.position.x=side*.12;
      body.add(wing);
      ellipsoid(wing,vanilla,side*.34,.026,-.025,.47,.060,.20).rotation.y=-side*.18;
      ellipsoid(wing,wingtip,side*.66,.022,-.097,.20,.041,.12).rotation.y=-side*.36;
      wings.push(wing);
    }
    birds.push({ body, wings, phase:i*1.64, height:8+i*.78 });
  }

  const signPane=own(new T.PlaneGeometry(2.65,1.33));
  const signMap=own(signTexture(theme.world==='shore'?'TIDAL':theme.name.toUpperCase(),theme.world==='shore'?'DINER  →':theme.title?.toUpperCase()??'TIDAL DINER',theme.accent));
  const signMat=own(new T.MeshStandardMaterial({ map:signMap, roughness:.9,side:T.DoubleSide }));
  const sign = new T.Group();
  sign.position.set(pathX(stage,15.6)+pathWidth(stage,15.6)*.5+1.50,pathY(stage,15.6)-.48,-15.6);
  sign.rotation.y=-.21;
  root.add(sign);
  block(sign,timber,-.89,.87,0,.12,2.43,.15);
  block(sign,timber,.89,.87,0,.12,2.43,.15);
  mesh(sign,signPane,signMat,0,2.02,.093);

  for(let k=0;k<(theme.world==='shore'?5:0);k++) {
    const z=-8.9-k*13.8, side=k%2?-1:1;
    const float=new T.Group();
    float.position.set(side*(5.4+random()*3.5),-.96,z);
    root.add(float);
    floating.push({ node:float, phase:k*1.8 });
    mesh(float,own(new T.TorusGeometry(.46,.118,9,24)),k%2?vanilla:red).rotation.x=-Math.PI/2;
    ellipsoid(float,vanilla,0,.03,0,.26,.14,.26);
    cylinder(float,red,0,.20,0,.034,.32,.034);
  }

  for(const island of islands) batchMeshes(island,windEntries);

  return {
    root,
    length,
    tick(time,cameraZ) {
      foamSurface.uniforms.t.value=time;
      stageWorld.tick(time,cameraZ);
      for (const {flag,phase,yaw} of pennants) {
        flag.rotation.set(.34*Math.sin(time*5.4+phase),yaw+.29*Math.cos(time*3.8+phase),.15*Math.sin(time*3.2+phase));
      }
      for(const island of islands) {
        const travel=cameraZ-island.position.z;
        island.visible=travel>-24 && travel<139;
      }
      for (const {frond,pitch,phase,z,pack,index,local} of windy) {
        if (Math.abs(z-cameraZ)>=100) continue;
        frond.rotation.x=pitch+Math.sin(time*2.2+phase)*.15;
        if (pack) {
          frond.updateMatrix();
          pack.setMatrixAt(index,windMatrix.multiplyMatrices(local,frond.matrix));
          pack.instanceMatrix.needsUpdate=true;
        }
      }
      for (const {sailboat,x,z,breeze} of sails) {
        sailboat.position.set(x+.95*Math.sin(time*.35+breeze),-1.20+.10*Math.sin(time*1.6+breeze),z+2.8*Math.cos(time*.31+breeze));
        sailboat.rotation.set(Math.sin(time*1.35+breeze)*.075,breeze+.21*Math.cos(time*.73),Math.cos(time*1.08+breeze)*.086);
      }
      for (const {node,phase} of floating) {
        node.position.y=-.98+Math.sin(time*1.7+phase)*.14;
        node.rotation.z=Math.sin(time*2+phase)*.17;
      }
      for (const {body,wings,phase,height} of birds) {
        const direction=time*.36+phase;
        body.position.set(Math.cos(direction)*24,height+Math.sin(direction*2.9)*1.6,cameraZ-49+Math.sin(direction)*13);
        body.rotation.y=Math.atan2(-24*Math.sin(direction),13*Math.cos(direction));
        body.rotation.z=Math.cos(direction)*.11;
        const flap=.10+Math.sin(time*7.7+phase)*.46;
        wings[0].rotation.z=-flap;
        wings[1].rotation.z=flap;
      }
    },
    dispose() {
      root.removeFromParent();
      stageWorld.dispose();
      for (const resource of resources) resource.dispose();
      root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
    },
  };
}
