import * as T from './vendor/three.js';
import { block,cylinder,ellipsoid,material,mesh,tube,batchMeshes } from './models.js';
import { pathX,pathY,pathWidth,seededRandom } from './stages.js';

export function makeFeatureWorld(stage,parent,art) {
  const {theme,length}=stage;
  const random=seededRandom(stage.seed^0xc71503fd);
  const root=new T.Group();
  parent.add(root);
  const resources=new Set();
  const animated=[];
  const scenery=[];
  const own=(asset)=>{resources.add(asset);return asset;};
  const matt=(color,roughness)=>own(material(color,roughness));
  const glow=(color,emissive=color,energy=.8)=>own(new T.MeshStandardMaterial({
    color,emissive,emissiveIntensity:energy,roughness:.57,
  }));
  const white=matt(0xf6e7d8);
  const brass=matt(0xc29b61,.41);
  const slate=matt(0x42435a);
  const stone=own(new T.MeshStandardMaterial({color:0x9a868a,map:art.rock,roughness:.94}));
  const group=(x,y,z,angle=0)=>{
    const node=new T.Group();
    node.position.set(x,y,z);
    node.rotation.y=angle;
    root.add(node);
    scenery.push(node);
    return node;
  };
  const around=(at,side,extra=0)=>pathX(stage,at)+side*(pathWidth(stage,at)*.5+extra);
  const cord=(node,surface,points,radius,segments=12)=>own(tube(node,surface,points,radius,segments).geometry);
  const signGeo=own(new T.PlaneGeometry(1,1));
  const signs=new Map();
  function sign(node,text,x,y,z,width,height,background='#392f45',ink='#fff0c5') {
    const key=[text,background,ink].join('/');
    if(!signs.has(key)){
      const canvas=Object.assign(document.createElement('canvas'),{width:640,height:180});
      const ctx=canvas.getContext('2d');
      ctx.fillStyle=background;
      ctx.fillRect(0,0,640,180);
      ctx.strokeStyle=ink;
      ctx.lineWidth=7;
      ctx.strokeRect(14,14,612,152);
      ctx.fillStyle=ink;
      ctx.textAlign='center';
      ctx.font='900 80px system-ui';
      ctx.fillText(text,320,117,566);
      const map=own(new T.CanvasTexture(canvas));
      map.colorSpace=T.SRGBColorSpace;
      const label=own(new T.MeshStandardMaterial({
        map,emissiveMap:map,emissive:0xffffff,emissiveIntensity:.29,roughness:.82,
      }));
      signs.set(key,label);
    }
    mesh(node,signGeo,signs.get(key),x,y,z,width,height,1);
  }

  function roof(node,surface,x,y,z,width,depth,rise) {
    const cross=new T.Shape();
    cross.moveTo(-width*.50,0);
    cross.lineTo(width*.50,0);
    cross.lineTo(0,rise);
    cross.closePath();
    const form=own(new T.ExtrudeGeometry(cross,{depth,bevelEnabled:false}));
    mesh(node,form,surface,x,y,z-depth*.5);
  }

  if(theme.world==='wizard'){
    const wall=own(new T.MeshStandardMaterial({color:0x817399,map:art.rock,roughness:.90}));
    const windowGlass=glow(0xb16eb8,0x5a50c3,.72);
    const candlelight=glow(0xffdd90,0xffb13e,1.65);
    const timber=matt(0x7f4a42,.83);
    const cloaks=[0x8d3c51,0x344e71,0x8d662e,0x42625c].map(c=>matt(c));
    const candleGeo=own(new T.CylinderGeometry(.13,.105,.63,12));
    const candles=[];
    const dessert=matt(0xb98b56);
    for(let at=9,i=0;at<length+15;at+=12.6,i++){
      const floor=pathY(stage,at);
      const x=pathX(stage,at), w=pathWidth(stage,at)*.52+1.32;
      const portal=group(x,floor,-at);
      for(const side of [-1,1]){
        block(portal,slate,side*w,1.08,0,1.50,2.25,1.36);
        block(portal,wall,side*w,3.74,0,1.11,6.32,1.10);
        for(const slide of [-.36,.36]){
          cylinder(portal,stone,side*w+slide,3.56,.50,.131,6.30,.145);
        }
        block(portal,wall,side*w,6.62,0,1.55,.44,1.46);
        block(portal,cloaks[(i+(side>0?1:0))%4],side*(w-.52),4.35,.61,.63,2.18,.072);
        block(portal,brass,side*(w-.52),5.49,.63,.71,.076,.103);
        const windowX=side*(w+2.83);
        block(portal,wall,windowX,3.41,-3.50,3.92,7.12,1.22);
        block(portal,windowGlass,windowX,4.55,-2.854,2.64,3.70,.055);
        for(let k=-1;k<=1;k++)block(portal,brass,windowX+k*.76,4.55,-2.81,.079,3.80,.071);
        const table=block(portal,timber,side*(w+2.43),.70,2.02,2.82,.24,4.18);
        table.rotation.y=side*.06;
        for (const along of [-1.42,1.42]) {
          const tableX=side*(w+2.43);
          block(portal,timber,tableX-.91,.31,2.02+along,.18,.73,.18);
          block(portal,timber,tableX+.91,.31,2.02+along,.18,.73,.18);
        }
        for(let k=0;k<3;k++){
          const dishZ=1.01+k*.89;
          cylinder(portal,brass,side*(w+2.43),.885,dishZ,.37,.069,.37);
          ellipsoid(portal,dessert,side*(w+2.43),.987,dishZ,.24,.113,.23);
        }
      }
      cord(portal,wall,[[-w,6.62,0],[-w*.65,8.53,0],[0,10.60,-.19],[w*.65,8.53,0],[w,6.62,0]],.30,19);
      batchMeshes(portal);
      for(const side of [-1,1])for(let k=0;k<4;k++){
        const candle=new T.Group();
        portal.add(candle);
        candle.position.set(side*(.75+k*.86),5.65+random()*2.00,-1.85+random()*4.7);
        mesh(candle,candleGeo,white,0,0,0);
        ellipsoid(candle,candlelight,0,.405,0,.101,.19,.102);
        candles.push({node:candle,y:candle.position.y,phase:random()*7});
      }
      if(i===1 || i===Math.floor(length/13)-1){
        block(portal,slate,0,7.25,.05,3.84,1.21,.26);
        sign(portal,'THE GREAT HALL',0,7.25,.20,3.69,1.02);
      }
    }
    const lamps=Array.from({length:2},()=>new T.PointLight(0xffc68e,5,13,1.6));
    root.add(...lamps);
    animated.push((time,at)=>{
      for(const {node,y,phase} of candles)node.position.y=y+Math.sin(time*1.7+phase)*.27;
      for(const [i,lamp] of lamps.entries()){
        const near=Math.min(length,at+10+i*11);
        lamp.position.set(pathX(stage,near)+(i?-2.2:2.2),pathY(stage,near)+4.87,-near);
        lamp.intensity=5.2+.55*Math.sin(time*3.7+i);
      }
    });
  }

  if(theme.world==='home'){
    const snow=matt(0xf2f1ff,.94), brick=matt(0x946069,.72);
    const decking=matt(0xa88b9c), dark=matt(0x536080), pine=matt(0x416c63);
    const firShade=matt(0x31574b);
    const darkWindow=glow(0xffbe68,0xe9913d,1.04);
    const bulbs=[0xff6c75,0x9bf0cf,0xffcb81,0xb1c6ff].map(c=>glow(c,c,.82));
    const treeTip=own(new T.ConeGeometry(1,1,13));
    for(let at=9,i=0;at<length+10;at+=11.7,i++){
      const side=i%2?1:-1;
      const home=group(around(at,side,7.3+random()*3.5),-.42,-at,side*.14);
      const scale=.80+random()*.37;
      home.scale.setScalar(scale);
      block(home,brick,0,2.00,-.39,6.9,4.03,5.54);
      roof(home,dark,0,3.98,-.39,7.47,6.17,2.55);
      roof(home,snow,0,4.12,-.39,7.64,6.30,2.61);
      block(home,brick,-2.17,5.15,-1.68,.66,2.65,.68);
      block(home,snow,-2.17,6.44,-1.68,.87,.24,.86);
      block(home,decking,0,.25,2.53,7.31,.50,1.42);
      block(home,snow,0,.51,2.61,7.32,.11,1.475);
      block(home,dark,0,1.28,2.429,1.18,2.44,.17);
      block(home,darkWindow,0,1.63,2.525,.56,.72,.049);
      for(const sideWindow of [-1,1])for(const y of [1.48,3.14]){
        const u=sideWindow*1.91;
        block(home,white,u,y,2.41,1.30,1.18,.18);
        block(home,darkWindow,u,y,2.53,1.09,.98,.045);
        block(home,white,u,y,2.59,.084,1.02,.054);
        block(home,white,u,y,2.60,1.12,.076,.054);
      }
      const brim=mesh(home,own(new T.TorusGeometry(.27,.076,8,24)),firShade,0,1.43,2.63);
      brim.rotation.z=.16;
      for(let i=0;i<10;i++){
        const x=(i-4.5)*.68;
        const y=4.10-.18*Math.cos(x*.75);
        ellipsoid(home,bulbs[i%4],x,y,2.77,.077,.110,.076);
      }
      batchMeshes(home);

      const tree=group(around(at+4,-side,2.1+random()*3.9),-.28,-at-4);
      cylinder(tree,decking,0,.73,0,.17,1.4,.17);
      for(let k=0;k<3;k++){
        const spread=1.38-k*.26;
        mesh(tree,treeTip,k%2?firShade:pine,0,1.32+k*.77,0,spread,1.85,spread);
        mesh(tree,treeTip,snow,0,1.63+k*.75,0,spread*.794,1.489,spread*.794);
      }
      for(let k=0;k<6;k++) {
        const a=k*2.40,r=.84-k*.075;
        ellipsoid(tree,bulbs[k%4],Math.cos(a)*r,1.37+k*.24,Math.sin(a)*r,.101,.119,.091);
      }
      ellipsoid(tree,bulbs[2],0,4.05,0,.19,.28,.18);
      batchMeshes(tree);
    }
    const iceGeometry=own(new T.IcosahedronGeometry(1,0));
    const snowfall=new T.InstancedMesh(iceGeometry,snow,128);
    snowfall.frustumCulled=false;
    root.add(snowfall);
    const transform=new T.Object3D();
    const flakes=Array.from({length:128},()=>[random()*34-17,random()*13,random()*45,random()]);
    animated.push((time,at)=>{
      for(const [index,[x,y,z,t]] of flakes.entries()){
        const stride=at-z;
        const fall=(y+20-time*(.73+t*.53))%13;
        const posY=(fall+13)%13+pathY(stage,stride)*.53;
        transform.position.set(pathX(stage,at)+x+Math.sin(y+time*.96)*.48,posY,-stride-20);
        transform.scale.setScalar(.035+t*.054);
        transform.updateMatrix();
        snowfall.setMatrixAt(index,transform.matrix);
      }
      snowfall.instanceMatrix.needsUpdate=true;
    });
  }

  if(theme.world==='buck'){
    const countertop=matt(0xab6650,.68), cabinet=matt(0xb68062,.70);
    const hob=matt(0x35383e,.69), batter=matt(0xe2a05b,.72), hotSyrup=matt(0x9b562b,.49);
    const yolk=matt(0xfac153,.53), plate=matt(0xb8c6d5,.56);
    for(let at=13,i=0;at<length+7;at+=16.2,i++){
      const side=i%2?1:-1;
      const station=group(around(at,side,5.4+random()*4.2),.12,-at,side*.21);
      block(station,cabinet,0,.68,0,6.1,1.47,5.2);
      block(station,countertop,0,1.52,0,6.35,.29,5.35);
      for(let k=-1;k<=1;k++){
        block(station,white,k*1.73,.84,2.61,1.45,.91,.11);
        block(station,brass,k*1.73,.923,2.70,.39,.10,.11);
      }
      if(i%3===1) {
        cylinder(station,plate,0,1.88,0,2.29,.26,2.29);
        for(let j=0;j<5;j++){
          const w=1.87-j*.105;
          ellipsoid(station,batter,.06*Math.cos(j),2.13+j*.33,0,w,.276,w*.86);
          cylinder(station,j%2?yolk:hotSyrup,0,2.25+j*.33,0,w*.978,.039,w*.84);
        }
        ellipsoid(station,hotSyrup,0,3.73,0,1.20,.061,1.10);
        block(station,yolk,.38,3.89,-.31,.61,.23,.47).rotation.y=.44;
        sign(station,'PANCAKES',0,.66,2.715,3.07,.69,'#784234','#ffe4a9');
      } else if(i%3===2) {
        for(let k=-1;k<=1;k++)for(let j=0;j<2;j++){
          ellipsoid(station,white,k*1.04,2.25,-.6+j*1.16,.425,.69,.49).rotation.z=.17*k;
        }
        block(station,plate,0,1.77,0,4.26,.25,2.53);
      } else {
        cylinder(station,hob,0,1.91,0,2.10,.40,2.10);
        const handle=block(station,hob,2.77,1.96,-.42,2.49,.26,.37);
        handle.rotation.y=.19;
        cylinder(station,plate,0,2.095,0,1.86,.081,1.86);
        const pancake=ellipsoid(station,batter,.09,2.32,0,1.36,.17,1.13);
        animated.push(time=>{
          const flip=Math.max(0,Math.sin(time*1.22+i*.94));
          pancake.position.y=2.22+flip**3*1.36;
          pancake.rotation.x=flip*.24;
        });
      }
      batchMeshes(station);
    }
  }

  if(theme.world==='liverpool'){
    const brick=own(new T.MeshStandardMaterial({color:0xa45b5e,map:art.rock,roughness:.93}));
    const cream=matt(0xc8c7bd), black=matt(0x463952);
    const red=matt(0xc63c49,.57), lit=glow(0xffdbc1,0xffc077,1.1);
    const ship=matt(0x627b8d,.60);
    for(let at=12,i=0;at<length*.35;at+=12.8,i++){
      const side=i%2?-1:1;
      const quay=group(around(at,side,6.65),-.46,-at,side*-.09);
      block(quay,ship,side*3.2,-.015,0,13.6,.13,11.3);
      block(quay,brick,0,1.73,-1.16,6.19,3.35,5.61);
      block(quay,black,0,3.48,-1.16,6.58,.25,6.06);
      for(let k=-1;k<=1;k++){
        block(quay,cream,k*1.41,1.89,1.66,1.13,1.32,.12);
        block(quay,lit,k*1.41,1.89,1.74,.87,1.06,.071);
        block(quay,brick,k*1.41,1.88,1.79,.15,1.07,.09);
      }
      cylinder(quay,brass,-2.82,.33,2.56,.21,.87,.22);
      batchMeshes(quay);
    }
    for(let at=length*.34;at<length+13;at+=12.8){
      const x=pathX(stage,at), y=pathY(stage,at);
      const end=pathWidth(stage,at)*.5+1.31;
      const stadium=group(x,y,-at);
      for(const side of [-1,1]){
        for(let row=0;row<4;row++){
          const edge=end+1.23+row*1.27;
          block(stadium,row%2?red:brick,side*edge,.34+row*.523,0,1.21,1.12+row*.40,12.25);
          for(let seat=0;seat<5;seat++)block(stadium,red,side*edge,.99+row*.731,-4.8+seat*2.39,.72,.47,.91);
        }
        block(stadium,black,side*(end+5.0),5.79,0,.48,4.49,12.24);
        block(stadium,cream,side*(end+3.30),5.82,0,4.21,.16,12.24).rotation.z=side*.102;
        for(let lamp=0;lamp<3;lamp++)block(stadium,lit,side*(end+3.07),5.65,-3.9+lamp*3.6,1.08,.109,1.16);
      }
      for(const side of [-1,1]){
        const edge=side*(end-.25);
        block(stadium,cream,edge,-.32,0,.044,.022,11.85);
        if(Math.abs(at-length*.48)<7){
          block(stadium,cream,edge,.81,3.8,.074,2.23,.074);
          block(stadium,red,edge+side*.25,1.74,3.80,.51,.32,.05);
        }
      }
      if(Math.abs(at-length*.55)<8 || Math.abs(at-length*.86)<8) {
        block(stadium,red,0,7.1,0,9.25,.94,.38);
        sign(stadium,'LIVERPOOL',0,7.1,.21,8.9,.78,'#a02e44','#fff0dc');
      }
      batchMeshes(stadium);
    }
    const tower=group(23,-.46,-41);
    block(tower,cream,0,2.76,0,7.0,5.72,4.5);
    for(const side of [-1,1]){
      const x=side*2.05;
      block(tower,cream,x,5.68,-.1,2.43,3.96,2.53);
      cylinder(tower,black,x,7.66,-.10,1.09,.55,1.09);
      const face=cylinder(tower,brass,x,6.22,1.26,.72,.10,.72);
      face.rotation.x=Math.PI/2;
      block(tower,black,x,6.41,1.33,.072,.42,.091).rotation.z=.3;
      block(tower,black,x-.14,6.15,1.33,.40,.070,.090).rotation.z=.15;
      ellipsoid(tower,ship,x,8.18,-.03,.28,.34,.53);
      ellipsoid(tower,ship,x,8.51,.31,.16,.22,.19);
    }
    batchMeshes(tower);
  }

  if(theme.world==='jungle'){
    const cedar=own(new T.MeshStandardMaterial({color:0x897044,map:art.palmBark,roughness:.9}));
    const leaf=[0x3a674b,0x64874c,0x82a665].map(c=>matt(c));
    const raptor=matt(0x85a75c,.74), belly=matt(0xb0b77b,.79), ember=glow(0xff8958,0xeb6736,1.02);
    const rockGeo=own(new T.IcosahedronGeometry(1,1));
    for(let at=8,i=0;at<length+14;at+=9.3,i++){
      const side=i%2?1:-1;
      const rocks=group(around(at,side,3.2+random()*3.1),-.39,-at);
      for(let k=0;k<4;k++){
        mesh(rocks,rockGeo,stone,(random()-.5)*4.8,.35,(random()-.5)*4.3,
          .89+random()*1.92,.79+random()*1.42,.77+random()*1.83).rotation.y=random()*3;
      }
      const tall=3.3+random()*4.4;
      cylinder(rocks,cedar,side*.42,tall*.50,-.62,.38,tall,.42);
      for(let k=0;k<6;k++) {
        const a=k*2.40;
        ellipsoid(rocks,leaf[k%3],Math.cos(a)*1.17,tall+random()*.70,Math.sin(a)*1.37,1.93,.84,1.67);
      }
      for(let k=0;k<5;k++){
        const a=k*2.40;
        ellipsoid(rocks,leaf[k%3],Math.cos(a)*1.90,.79,Math.sin(a)*2.04,.77,.56,.89);
      }
      batchMeshes(rocks);
    }
    for(const fraction of [.16,.65]){
      const at=length*fraction;
      const gate=group(pathX(stage,at),pathY(stage,at),-at);
      const w=pathWidth(stage,at)*.5+.81;
      for(const side of [-1,1]){
        block(gate,stone,side*w,3.38,0,1.09,6.80,1.36);
        block(gate,cedar,side*w,5.67,.71,.80,3.35,.19);
        block(gate,ember,side*w,6.69,.18,.36,.78,.36);
        block(gate,stone,side*w,.44,0,1.87,.87,1.62);
      }
      block(gate,cedar,0,7.03,0,w*2+1.06,1.09,.49);
      sign(gate,'JURASSIC PARK',0,7.03,.26,6.54,.94,'#4b3229','#ffe2a3');
      batchMeshes(gate);
    }
    for(const [i,fraction] of [.22,.50,.81].entries()){
      const at=length*fraction;
      const side=i%2?-1:1;
      const dinosaur=group(around(at,side,6.5),.34,-at,side*.55);
      ellipsoid(dinosaur,raptor,0,2.21,0,1.46,1.18,2.28);
      ellipsoid(dinosaur,belly,0,1.87,.18,1.27,.79,2.17);
      for(const a of [-1,1])for(const z of [-1,1]){
        const foot=cylinder(dinosaur,raptor,a*.89,1.07,z*1.20,.245,2.14,.27);
        foot.rotation.z=a*.083;
        ellipsoid(dinosaur,belly,a*.94,.20,z*1.23,.31,.23,.43);
      }
      cord(dinosaur,raptor,[[0,2.3,-1.77],[0,2.18,-2.60],[.31,1.73,-3.72],[.82,1.34,-4.86]],.24);
      cord(dinosaur,raptor,[[.0,2.45,1.34],[0,3.40,1.96],[-.10,4.77,2.41],[-.19,5.91,2.77]],.38,17);
      const head=new T.Group();
      dinosaur.add(head);
      head.position.set(-.18,5.94,2.76);
      ellipsoid(head,raptor,0,0,.20,.46,.39,.73);
      ellipsoid(head,belly,0,-.15,.29,.43,.25,.68);
      ellipsoid(head,slate,.355,.13,.48,.076,.080,.061);
      animated.push(time=>{
        head.rotation.x=Math.sin(time*.90+i*1.9)*.18;
        head.rotation.y=Math.cos(time*.65+i*2.4)*.15;
      });
    }
  }

  if(theme.world==='future'){
    const concrete=matt(0x897b8f,.77), nickel=matt(0xa3a9bd,.32);
    const pink=glow(0xf477ad,0xcd407a,1.2);
    const teal=glow(0x70dbef,0x4d94db,1.11);
    const window=glow(0xffd29a,0xe49857,.78);
    const tyre=matt(0x3f425a,.82);
    for(let at=7,i=0;at<length+14;at+=12.8,i++){
      const side=i%2?-1:1;
      const store=group(around(at,side,4.87+random()*2.2),-.50,-at,side*.18);
      block(store,concrete,0,1.90,-.42,6.14,3.83,5.62);
      block(store,i%2?pink:teal,0,3.85,-.41,6.26,.21,5.71);
      block(store,slate,0,1.38,2.43,5.26,1.74,.20);
      for(let j=-1;j<=1;j++){
        block(store,window,j*1.59,1.39,2.55,1.34,1.42,.065);
        block(store,nickel,j*1.59,1.38,2.59,.070,1.44,.081);
      }
      sign(store,i%3===0?'LOU’S CAFE':i%3===1?'SODA FOUNTAIN':'HILL VALLEY',0,3.15,2.506,5.55,1.02,
        i%2?'#843b73':'#375270',i%2?'#ffdcba':'#cefaff');
      batchMeshes(store);

      if(i%3!==1) continue;
      const car=group(around(at+5,-side,1.8),-.36,-at-5,-side*.26);
      block(car,nickel,0,.60,0,2.80,.42,5.12);
      block(car,slate,0,1.11,-.04,2.39,.68,2.21);
      block(car,nickel,0,1.47,-.13,2.42,.18,2.30);
      for(const edge of [-1,1]){
        block(car,teal,edge*1.31,.73,.24,.15,.095,4.32);
        for(const z of [-1.49,1.44]){
          cylinder(car,tyre,edge*1.32,.46,z,.43,.31,.43).rotation.z=Math.PI*.5;
          cylinder(car,nickel,edge*1.52,.46,z,.24,.078,.24).rotation.z=Math.PI*.5;
        }
      }
      block(car,pink,0,.70,-2.61,2.22,.12,.048);
      batchMeshes(car);
    }
    const at=length*.48;
    const clock=group(around(at,-1,7.4),.11,-at,.13);
    block(clock,concrete,0,3.27,0,8.40,6.56,5.23);
    for(let i=-2;i<=2;i++)cylinder(clock,white,i*1.45,2.64,2.76,.22,4.81,.22);
    roof(clock,white,0,5.4,.50,9.39,5.88,2.91);
    const dial=cylinder(clock,white,0,6.79,3.47,.98,.18,.98);
    dial.rotation.x=Math.PI/2;
    const hands=[];
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      ellipsoid(clock,slate,Math.sin(a)*.81,6.79+Math.cos(a)*.81,3.572,.079,.071,.044);
    }
    for(const length of [.67,1.03]){
      const hand=new T.Group();
      hand.position.set(0,6.79,3.61);
      clock.add(hand);
      block(hand,slate,0,length*.28,0,.068,length,.071);
      hands.push(hand);
    }
    sign(clock,'CLOCK TOWER',0,4.63,2.93,4.48,.63,'#55577e','#fff1d7');
    animated.push(time=>{
      hands[0].rotation.z=-.43+Math.sin(time*.6)*.033;
      hands[1].rotation.z=.47-time*.23;
    });
  }

  return {
    tick(time,cameraZ){
      const distance=11-cameraZ;
      for (const node of scenery) {
        const view=cameraZ-node.position.z;
        node.visible=view>-31 && view<130;
      }
      for(const animation of animated)animation(time,distance);
    },
    dispose(){for(const resource of resources)resource.dispose();},
  };
}
