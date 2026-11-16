import * as T from './vendor/three.js';
import { block,cylinder,ellipsoid,material,mesh,tube,batchMeshes } from './models.js';
import { pathX,pathY,pathWidth,seededRandom } from './stages.js';

export function makeStageWorld(stage,parent,art) {
  const {theme,length}=stage;
  const random=seededRandom(stage.seed^0x6a18e5df);
  const resources=new Set();
  const own=(object)=>{ resources.add(object); return object; };
  const surface=(color,roughness)=>own(material(color,roughness));
  const world=new T.Group();
  parent.add(world);
  const animations=[];
  const lamps=[];
  const strand=(node,surface,points,size,steps)=>own(tube(node,surface,points,size,steps).geometry);

  if(theme.world==='reef') {
    const rock=own(new T.MeshStandardMaterial({color:0x82c2af,map:art.rock,roughness:.91}));
    const coralColors=[0xe45a7c,0xff927e,0xb97ac4,0xedc476].map(color=>surface(color,.7));
    const rockShape=own(new T.IcosahedronGeometry(1,2));
    const branch=own(new T.CylinderGeometry(.32,.61,1,9));
    function coral(node,x,y,z,scale,tint) {
      const growth=new T.Group();
      node.add(growth);
      growth.position.set(x,y,z);
      growth.scale.setScalar(scale);
      mesh(growth,branch,tint,0,.60,0,.40,1.24,.44);
      for(let i=0;i<5;i++){
        const angle=i*2.4;
        const height=1.0+random()*.83;
        const tip=mesh(growth,branch,tint,Math.cos(angle)*.31,.79+height*.24,Math.sin(angle)*.22,.38,height,.38);
        tip.rotation.set(Math.sin(angle)*.63,0,-Math.cos(angle)*.60);
        ellipsoid(growth,tint,Math.cos(angle)*.60,1.0+height*.46,Math.sin(angle)*.49,.137,.18,.126);
      }
    }
    for(let at=13;at<length+10;at+=13.3) {
      const side=Math.floor(at/13.3)%2?1:-1;
      const ground=pathX(stage,at)+side*(pathWidth(stage,at)*.5+3+random()*3.2);
      const reef=new T.Group();
      world.add(reef);
      reef.position.set(ground,-.89,-at);
      mesh(reef,rockShape,rock,0,0,0,3.1,1.13,2.38).rotation.y=random()*6;
      for(let i=0;i<5;i++){
        const x=(random()-.50)*4, z=(random()-.50)*3.1;
        coral(reef,x,.64,z,.58+random()*.99,coralColors[i%coralColors.length]);
      }
      const out=mesh(reef,rockShape,rock,side*3.7,-.30,-1.2,2.5,.68,2.0);
      out.rotation.set(0,random()*4,.16);
      batchMeshes(reef);
    }
    const archColor=surface(0xe3a5ae,.85);
    for(const slice of [.31,.66]) {
      const at=length*slice;
      const x=pathX(stage,at), y=pathY(stage,at);
      const width=pathWidth(stage,at)*.5+1;
      strand(world,archColor,[
        [x-width,-.48,-at],[x-width-.25,y+2.95,-at+.15],[x-width*.68,y+5.42,-at],
        [x+.11,y+6.55,-at-.31],[x+width*.74,y+5.24,-at-.13],[x+width-.1,-.4,-at],
      ],.49,25);
      for(const side of [-1,1]) coral(world,x+width*side,y+.42,-at+.65,.82,coralColors[side>0?1:2]);
    }
  }

  if(theme.world==='harbor') {
    const midnight=surface(0x354261,.91);
    const cedar=own(new T.MeshStandardMaterial({color:0x90656a,map:art.wood,roughness:.88}));
    const paper=own(new T.MeshStandardMaterial({color:0xffd078,emissive:0xff841d,emissiveIntensity:1.30,roughness:.72}));
    const saffron=surface(0xbf5d54,.72);
    const bronze=surface(0x79544d,.78);
    const lampGeo=own(new T.SphereGeometry(1,20,14));
    for(let at=7;at<length;at+=8.05) {
      const side=Math.floor(at/8)%2?1:-1;
      const x=pathX(stage,at)+side*(pathWidth(stage,at)*.5+.09);
      const y=pathY(stage,at);
      block(world,bronze,x,y+.92,-at,.21,1.85,.22);
      block(world,bronze,x-side*.35,y+1.69,-at,.74,.13,.14);
      mesh(world,lampGeo,paper,x-side*.61,y+1.43,-at,.21,.28,.21);
      cylinder(world,saffron,x-side*.61,y+1.66,-at,.18,.074,.18);
      cylinder(world,saffron,x-side*.61,y+1.20,-at,.17,.071,.17);
      lamps.push({at,x:x-side*.61,y:y+1.28});
    }
    const cabinRoof=own(new T.ConeGeometry(1,1,4,1));
    for(let at=15;at<length+15;at+=19) {
      const side=Math.floor(at/18)%2?1:-1;
      const x=pathX(stage,at)+side*(11.0+random()*6);
      const z=-at+(random()-.5)*5;
      const cabin=new T.Group();
      world.add(cabin);
      cabin.position.set(x,-.87,z);
      cabin.rotation.y=side*.22;
      cabin.scale.setScalar(.77+random()*.65);
      block(cabin,midnight,0,.19,0,7.6,.36,5.3);
      block(cabin,cedar,0,1.67,-.18,5.04,2.72,3.65);
      mesh(cabin,cabinRoof,midnight,0,3.48,-.16,4.0,1.59,3.38).rotation.y=Math.PI/4;
      mesh(cabin,cabinRoof,saffron,0,3.12,-.16,4.23,.55,3.62).rotation.y=Math.PI/4;
      for(let i=-1;i<=1;i++){
        block(cabin,midnight,i*1.30,1.62,1.68,1.06,1.0,.13);
        block(cabin,paper,i*1.30,1.62,1.76,.83,.76,.07);
        block(cabin,bronze,i*1.30,1.62,1.81,.075,.78,.08);
      }
      for(const end of [-1,1]) {
        cylinder(cabin,bronze,end*2.39,.47,2.04,.12,.99,.12);
        mesh(cabin,lampGeo,paper,end*2.50,2.24,1.81,.21,.31,.21);
      }
      batchMeshes(cabin);
    }
    const bulbs=Array.from({length:3},()=>new T.PointLight(0xffb968,4,11,1.65));
    world.add(...bulbs);
    animations.push((time,distance)=>{
      const start=Math.max(0,Math.floor((distance-7)/8.05)-1);
      for (const [i,bulb] of bulbs.entries()){
        const lamp=lamps[start+i];
        bulb.visible=Boolean(lamp);
        if(!lamp) continue;
        bulb.position.set(lamp.x,lamp.y,-lamp.at);
        bulb.intensity=6.5+.71*Math.sin(time*2.7+lamp.at);
      }
    });
  }

  if(theme.world==='peak') {
    const basalt=own(new T.MeshStandardMaterial({color:0xa8605a,map:art.rock,roughness:.92}));
    const obsidian=own(new T.MeshStandardMaterial({color:0x653f55,map:art.rock,roughness:.97}));
    const ember=own(new T.MeshStandardMaterial({
      color:0xff9a55,emissive:0xe75814,emissiveIntensity:.83,roughness:.67,
    }));
    const ash=own(new T.MeshStandardMaterial({
      color:0x72545c,transparent:true,opacity:.47,depthWrite:false,roughness:1,
    }));
    const cliff=own(new T.IcosahedronGeometry(1,1));
    const cone=own(new T.CylinderGeometry(.37,1,1,8,1));
    for(let at=12;at<length+23;at+=13.7) {
      const side=Math.floor(at/13)%2?-1:1;
      const x=pathX(stage,at)+side*(8.9+random()*5.1);
      const z=-at;
      const height=3.1+random()*5.0;
      mesh(world,cliff,obsidian,x,-.74,z,4.0,1.22,3.21).rotation.z=.15;
      mesh(world,cone,basalt,x,height*.30-.70,z,2.45,height,2.15).rotation.y=random()*4;
      const rock=mesh(world,cone,obsidian,x+side*2.8,height*.16-.75,z+1.8,1.38,height*.68,1.43);
      rock.rotation.set(.19,random()*4,side*-.18);
      cylinder(world,ember,x,height*.80-.65,z,.88,.17,.81);
      for(let n=0;n<3;n++) {
        const off=n*1.3+random()*.4;
        const fog=ellipsoid(world,ash,x,height*.80-.40,z,.54,.39,.47);
        animations.push((time)=>{
          const p=((time*.33+off*.28)%1);
          fog.position.set(x+side*p*1.7,height*.80-.4+p*3.9,z-p*.63);
          fog.scale.set(.43+p*.84,.28+p*.61,.46+p*.72);
        });
      }
    }
  }

  if(theme.world==='cloud') {
    const vapor=surface(0xfff2fc,1), shade=surface(0xd6cdeb,1), fabric=surface(0x8179d2,.82);
    const base=surface(0x94757a,.87), rope=surface(0xd2a887,.87);
    const hues=[0xf38d9e,0xffc288,0x7ecad7,0xb1a1ea].map(color=>surface(color,.66));
    for(let at=8;at<length+25;at+=9.9) {
      const side=Math.floor(at/9)%2?-1:1;
      const x=pathX(stage,at)+side*(6+random()*11);
      const y=Math.max(-.84,pathY(stage,at)-2.35);
      const z=-at;
      const cloud=new T.Group();
      cloud.position.set(x,y,z);
      world.add(cloud);
      const w=1.13+random()*1.47;
      cloud.scale.setScalar(w);
      ellipsoid(cloud,shade,0,-.26,0,2.6,.42,.93);
      for(const [dx,dy,dz,sx,sy,sz] of [
        [-1.68,0,0,1.04,.55,.89],[-.84,.31,.04,1.26,.83,1.05],
        [.33,.42,-.13,1.41,.94,1.18],[1.51,.12,.05,1.18,.65,.98],
      ]) ellipsoid(cloud,vapor,dx,dy,dz,sx,sy,sz);
      batchMeshes(cloud);
      if(Math.floor(at/9)%4!==1) continue;
      const balloon=new T.Group();
      world.add(balloon);
      const alt=y+4+random()*2;
      balloon.position.set(x+side*3,alt,z-2);
      ellipsoid(balloon,hues[Math.floor(random()*hues.length)],0,2.24,0,1.15,1.53,1.15);
      ellipsoid(balloon,fabric,0,1.34,0,.90,.65,.90);
      block(balloon,base,0,.02,0,.70,.54,.64);
      for (const k of [-1,1]) for (const m of [-1,1]) {
        strand(balloon,rope,[[k*.31,.25,m*.29],[k*.43,.63,m*.35],[k*.49,1.13,m*.42]],.023,5);
      }
      animations.push(time=>{
        balloon.position.y=alt+Math.sin(at+time*.90)*.42;
        balloon.rotation.z=Math.sin(at+time*.81)*.09;
      });
    }
  }

  return {
    tick(time,cameraZ) {
      const distance=11-cameraZ;
      for(const animation of animations) animation(time,distance);
    },
    dispose() { for(const resource of resources) resource.dispose(); },
  };
}
