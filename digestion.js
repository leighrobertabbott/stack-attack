import * as T from './vendor/three.js';
import { digestionBackdrop } from './art.js';
import { drawIcon, prepareIcons } from './ui-icons.js';
import { FILLED } from './stages.js';
import {
  CHAMBERS, DIGEST_HEIGHT, DIGEST_GAP, MAX_MORSELS, ROPE_SEGMENTS,
  createDigestion, ropePoint, ropeHits, bubbleHit, gateX, movingBand,
} from './digestion-physics.js';

const makeCanvas=(width,height)=>Object.assign(document.createElement('canvas'),{width,height});
const rgb=hex=>'#'+hex.toString(16).padStart(6,'0');
const format=new Intl.NumberFormat();
const white=new T.Color(0xffecd1);
const gold=new T.Color(0xffca71);
const mint=new T.Color(0x97f8dc);

export function makeDigestion(hud,canvas,audio,onFinish,reducedMotion) {
  const title=hud.querySelector('#organName');
  const number=hud.querySelector('#organStep');
  const total=hud.querySelector('#morselTotal');
  const hint=hud.querySelector('#digestionHint');
  const win=hud.querySelector('#digestionWin');
  const payout=hud.querySelector('#digestionWinPoints');
  const scene=new T.Scene();
  scene.name='Digestion bonus';
  scene.background=new T.Color(0x200817);
  const camera=new T.OrthographicCamera(-5.6,5.6,7,-7,.1,55);
  const lights=new T.HemisphereLight(0xffdccf,0x5d1b51,2.1);
  const key=new T.DirectionalLight(0xffead2,2.60);
  key.position.set(-5,5,9);
  const rim=new T.DirectionalLight(0xf5a0da,1.85);
  rim.position.set(5,-6,4);
  const chambers=new T.Group();
  scene.add(lights,key,rim,chambers);
  const position=new T.Object3D();
  const capsule=new T.CapsuleGeometry(1,1.6,5,10);
  const sphere=new T.SphereGeometry(1,13,10);
  const tile=new T.PlaneGeometry(1,1);
  const knot=new T.TorusGeometry(1,.29,10,24);
  const chipGeometry=new T.OctahedronGeometry(1,0);
  const ropeLight=new T.MeshStandardMaterial({color:0xffe8be,roughness:.36});
  const strands=Array.from({length:4},()=>Array.from({length:ROPE_SEGMENTS},()=>new T.Mesh(capsule,ropeLight)));
  scene.add(...strands.flat());
  const pellets=new T.InstancedMesh(sphere,new T.MeshStandardMaterial({roughness:.32,metalness:.06}),MAX_MORSELS);
  pellets.name='Food morsels';
  const sparks=new T.InstancedMesh(chipGeometry,new T.MeshBasicMaterial({toneMapped:false}),100);
  pellets.frustumCulled=sparks.frustumCulled=false;
  scene.add(pellets,sparks);
  const ribbons=Array.from({length:11},()=>mesh(capsule,new T.MeshBasicMaterial({
    color:0xc9fff1,toneMapped:false,transparent:true,opacity:0,depthWrite:false,
  }),scene,0,0,1.4));
  const tutorial=mesh(capsule,new T.MeshBasicMaterial({color:0xfbead3,toneMapped:false,transparent:true,
    opacity:0,depthWrite:false}),scene,0,0,1.4);
  const bubbleArt=mesh(tile,new T.MeshBasicMaterial({map:bubbleMap(),transparent:true,toneMapped:false,depthWrite:false}),
    scene,0,0,1.12);
  bubbleArt.name='Swipe bubble';
  const ripple=mesh(knot,new T.MeshBasicMaterial({color:0xe7fff2,transparent:true,depthWrite:false,toneMapped:false}),
    scene,0,0,1.13);
  const comboArt=mesh(tile,new T.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false}),
    scene,0,0,1.42);
  const stickerGroup=new T.Group();
  scene.add(stickerGroup);
  const foodMaps=new Map(), foodColors=new Map();
  const stickers=Array.from({length:72},()=>{
    const sprite=new T.Sprite(new T.SpriteMaterial({transparent:true,toneMapped:false,depthWrite:false}));
    sprite.visible=false;
    stickerGroup.add(sprite);
    return sprite;
  });
  const textures=CHAMBERS.map(chamber=>digestionBackdrop(chamber.art,rgb(chamber.background)));
  const backdrop=mesh(tile,new T.MeshBasicMaterial({map:textures[0],toneMapped:false}),scene,0,0,-9);
  const curtain=mesh(tile,new T.MeshBasicMaterial({map:textures[0],toneMapped:false,transparent:true,depthWrite:false}),scene,0,0,-8.9);
  curtain.visible=false;
  const numberMaps=new Map();
  const getColor=kind=>{
    if(!foodColors.has(kind)) foodColors.set(kind,new T.Color(FILLED[kind]?.color??0xffc378).lerp(white,.12));
    return foodColors.get(kind);
  };
  let display=[], sim, active=false, swipe=null, trail=[], dust=[];
  let shown='', shownCount=0, cue='', currentIndex=-1, gateSound=-Infinity;
  let cameraY=6, finishTime=0, clock=0, accumulator=0, curtainAlpha=0;
  let taughtSwipe=false, taughtBubble=false, keyboardUntil=0, ringFlash=null, combo=null, comboSeen=0;
  let gatePulse=null, showedWin=false, lastDelivered=0, exitPulse=0;

  function mesh(geometry,material,parent,x,y,z) {
    const instance=new T.Mesh(geometry,material);
    instance.position.set(x,-y,z);
    parent.add(instance);
    return instance;
  }

  function placeSegment(segment,a,b,width,depthRise,z) {
    const dx=b.x-a.x,dy=b.y-a.y;
    segment.position.set((a.x+b.x)*.5,-(a.y+b.y)*.5,z);
    segment.rotation.z=Math.atan2(dx,-dy);
    segment.scale.set(width,Math.hypot(dx,dy)/3.1,depthRise);
  }

  function bubbleMap() {
    const bitmap=makeCanvas(192,192);
    const draw=bitmap.getContext('2d');
    const glass=draw.createRadialGradient(78,70,22,96,96,89);
    glass.addColorStop(0,'#54f8f312');
    glass.addColorStop(.66,'#63ffde18');
    glass.addColorStop(.92,'#9effde8c');
    glass.addColorStop(1,'#f4ffebed');
    draw.fillStyle=glass;
    draw.beginPath();
    draw.arc(96,96,86,0,Math.PI*2);
    draw.fill();
    draw.lineCap='round';
    draw.lineWidth=6;
    draw.strokeStyle='#fff8e5ee';
    draw.beginPath();
    draw.arc(96,96,70,-2.93,-1.89);
    draw.stroke();
    draw.lineWidth=4;
    draw.strokeStyle='#ee8efaab';
    draw.beginPath();
    draw.arc(96,96,78,.05,1.37);
    draw.stroke();
    const texture=new T.CanvasTexture(bitmap);
    texture.colorSpace=T.SRGBColorSpace;
    return texture;
  }

  function labelMap(label) {
    if(numberMaps.has(label)) return numberMaps.get(label);
    const bitmap=makeCanvas(256,96);
    const draw=bitmap.getContext('2d');
    draw.textAlign='center';
    draw.textBaseline='middle';
    draw.font='900 '+(label.length<=3?67:39)+'px system-ui';
    draw.lineWidth=8;
    draw.strokeStyle='#44283e';
    draw.strokeText(label,128,47);
    draw.fillStyle='#fff9e5';
    draw.fillText(label,128,47);
    const texture=new T.CanvasTexture(bitmap);
    texture.colorSpace=T.SRGBColorSpace;
    numberMaps.set(label,texture);
    return texture;
  }

  function build() {
    const priorMaterials=new Set();
    chambers.traverse(object=>{
      if(!object.isMesh) return;
      if(object.userData.localGeometry) object.geometry.dispose();
      priorMaterials.add(object.material);
    });
    for(const material of priorMaterials) material.dispose();
    chambers.clear();
    display=sim.state.layouts.map((chamber,index)=>{
      const group=new T.Group();
      group.position.y=-index*DIGEST_GAP;
      chambers.add(group);
      // Grooves and beads sit in front of the illustrated tissue, behind the playable board.
      const railMaterial=new T.MeshStandardMaterial({color:chamber.rail,roughness:.3});
      const railHighlight=new T.MeshStandardMaterial({color:chamber.rail,roughness:.33,emissive:chamber.rail,emissiveIntensity:.28});
      const wallMaterial=new T.MeshStandardMaterial({color:chamber.wall,roughness:.57,emissive:chamber.background,emissiveIntensity:.28});
      const innerWall=new T.MeshStandardMaterial({color:chamber.wall,roughness:.48,emissive:chamber.wall,emissiveIntensity:.11});
      const deepMaterial=new T.MeshStandardMaterial({color:chamber.background,roughness:.55});
      const lightBead=new T.MeshStandardMaterial({color:chamber.energy,emissive:chamber.energy,emissiveIntensity:.45,roughness:.31});
      const accents=[];
      for(const side of [-1,1]) {
        const points=Array.from({length:69},(_,i)=>{
          const y=i*(DIGEST_GAP+7.1)/68-4.0;
          const swell=Math.sin(y*1.79+chamber.phase)*.13+Math.sin(y*.83)*.11;
          return new T.Vector3(side*(5.03+swell),-y,-1.16);
        });
        const path=new T.CatmullRomCurve3(points);
        const wall=mesh(new T.TubeGeometry(path,52,.39,12,false),wallMaterial,group,0,0,0);
        wall.userData.localGeometry=true;
        const lip=mesh(new T.TubeGeometry(path,52,.15,8,false),innerWall,group,-side*.27,0,.23);
        lip.userData.localGeometry=true;
        for(let i=0;i<9;i++) {
          const y=.23+i*1.47+Math.sin(i*5+chamber.phase)*.38;
          const node=mesh(sphere,i%3===0?lightBead:wallMaterial,group,side*(5.55+Math.cos(i*1.86)*.31),y,-1.65);
          const size=.13+((i*13+index*7)%8)*.064;
          node.scale.set(size,size*1.09,size*.85);
          accents.push({node,y,phase:i+side*1.2});
        }
      }
      for(const [ax,ay,bx,by] of chamber.bands) {
        const a={x:ax,y:ay},b={x:bx,y:by};
        const rail=mesh(capsule,railMaterial,group,ax,ay,.06);
        const highlight=mesh(capsule,railHighlight,group,ax,ay,.22);
        placeSegment(rail,a,b,.17,.26,.07);
        placeSegment(highlight,{x:ax,y:ay-.04},{x:bx,y:by-.04},.051,.112,.27);
      }
      const ropes=chamber.ropes.map(r=>{
        const color=outerMaterial(r.color);
        const mounts=[r.ax,r.bx].map(x=>{
          const mount=mesh(knot,color,group,x,r.y,.33);
          mount.scale.setScalar(.19);
          return mount;
        });
        const label=mesh(tile,new T.MeshBasicMaterial({map:labelMap(String(r.id+1)),
          transparent:true,toneMapped:false,depthWrite:false}),group,(r.ax+r.bx)*.5,r.y+r.sag+.31,.86);
        label.scale.set(1.41,.52,1);
        return {color,label,mounts};
      });
      const gates=chamber.gates.map(g=>{
        const bright=g.factor>2, wide=g.width>6;
        const tint=bright?chamber.energy:0xffc088;
        const material=new T.MeshBasicMaterial({color:tint,transparent:true,opacity:.28,toneMapped:false,depthWrite:false});
        const beam=mesh(tile,material,group,g.x,g.y,bright?-.52:-.82);
        beam.scale.set(g.width,bright?.30:.12,1);
        const line=mesh(capsule,new T.MeshBasicMaterial({color:tint,toneMapped:false,transparent:true,depthWrite:false}),
          group,g.x,g.y,-.40);
        placeSegment(line,{x:-g.width*.5,y:g.y},{x:g.width*.5,y:g.y},.028,.05,-.32);
        const label=wide?null:mesh(tile,new T.MeshBasicMaterial({map:labelMap('×'+g.factor),transparent:true,toneMapped:false,depthWrite:false}),
          group,g.x,g.y+.23,-.19);
        label?.scale.set(bright?1.82:1.53,.60,1);
        const ends=bright?[-1,1].map(()=>{
          const end=mesh(sphere,outerMaterial(tint),group,g.x,g.y,-.54);
          end.scale.setScalar(.091);
          return end;
        }):[];
        return {g,bright,beam,line,label,ends};
      });
      const paddles=chamber.paddles.map(p=>{
        const rail=mesh(capsule,outerMaterial(chamber.rail),group,p.x,p.y,.33);
        const rim=mesh(capsule,wallMaterial,group,p.x,p.y,-.21);
        const hub=mesh(knot,outerMaterial(chamber.energy),group,p.x,p.y,.75);
        hub.scale.setScalar(.17);
        const bulbs=[mesh(sphere,lightBead,group,p.x,p.y,.45),mesh(sphere,lightBead,group,p.x,p.y,.45)];
        bulbs.forEach(b=>b.scale.setScalar(.138));
        return {p,rail,rim,hub,bulbs};
      });
      const jaws=mesh(knot,outerMaterial(chamber.energy),group,0,11.29,-.62);
      jaws.scale.set(1.38,.39,.41);
      const lining=mesh(knot,wallMaterial,group,0,11.29,-.8);
      lining.scale.set(1.88,.58,.43);
      const exit=mesh(sphere,deepMaterial,group,0,11.29,-1.50);
      exit.scale.set(1.68,.44,.42);
      return {group,accents,gates,jaws,paddles,ropes};
    });
  }

  function outerMaterial(color) {
    return new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.21,roughness:.38});
  }

  function burst(x,y,amount,color) {
    if(reducedMotion) amount=Math.ceil(amount*.36);
    for(let i=0;i<amount && dust.length<100;i++){
      const a=i*2.399+clock*2;
      const speed=.65+(i*7%9)*.47;
      dust.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
        life:.39+(i%6)*.095,r:.046+(i%4)*.025,color});
    }
  }

  function notify(event,value) {
    if(event==='cut'){
      taughtSwipe=true;
      audio.effect('digestCut',value.count);
      ringFlash={x:value.x,y:value.y,life:.24,size:.57};
      burst(value.x,value.y,value.count?16:8,white);
    } else if(event==='bubbleCatch') {
      audio.effect('digestFloat');
    } else if(event==='bubblePop') {
      if(value.voluntary) taughtBubble=true;
      audio.effect('digestBubble');
      ringFlash={x:value.x,y:value.y,life:.31,size:1.28};
      burst(value.x,value.y,22,mint);
    } else if(event==='gate'){
      gatePulse={x:value.center,y:value.y,life:.21};
      if(value.chain>=3 && value.chain>comboSeen){
        comboSeen=value.chain;
        combo={x:value.center,y:value.y,label:'CHAIN '+value.chain,life:.62};
      }
      if(clock-gateSound>.18){
        gateSound=clock;
        audio.effect('digestPop',Math.min(5,value.factor+value.chain-2));
        burst(value.center,value.y,value.factor>2?14:5,value.factor>2?mint:gold);
      }
    } else if(event==='finish') {
      audio.effect('digestClear');
      burst(0,10.7,70,gold);
      burst(-2.5,8.9,15,mint);
      burst(2.5,8.9,15,white);
      ringFlash={x:0,y:10.8,life:.55,size:3.28};
    } else if(event==='enter' && value.index>0) {
      audio.effect('digestStep',value.index);
      dust=[];
      trail=[];
      swipe=null;
      ringFlash=combo=gatePulse=null;
      lastDelivered=exitPulse=0;
    }
  }

  function start(seed,fills) {
    clock=accumulator=finishTime=keyboardUntil=comboSeen=lastDelivered=exitPulse=0;
    gateSound=-Infinity;
    showedWin=false;
    ringFlash=combo=gatePulse=null;
    shown=cue='';
    shownCount=-1;
    currentIndex=-1;
    dust=[];
    swipe=null;
    trail=[];
    sim=createDigestion(seed,fills,notify);
    build();
    cameraY=6.07;
    camera.position.set(0,-cameraY,18);
    active=true;
    void prepareIcons().then(image=>{
      if(!image) return;
      for(const kind of new Set(fills)) {
        if(foodMaps.has(kind)) continue;
        const stamp=makeCanvas(72,72);
        if(!drawIcon(stamp.getContext('2d'),image,kind,72,72)) continue;
        const map=new T.CanvasTexture(stamp);
        map.colorSpace=T.SRGBColorSpace;
        foodMaps.set(kind,map);
      }
    });
    syncHud();
  }

  function keyCut(id,direction=0) {
    if(!active) return false;
    keyboardUntil=clock+3;
    const r=sim.state.ropes[id];
    const x=r && direction ? r.ax+(r.bx-r.ax)*(direction<0?.16:.84) : undefined;
    return sim.cut(id,x);
  }

  function keyPop(direction) {
    if(active) sim.popBubble(direction);
  }

  function cutStroke(from,to) {
    const state=sim.state;
    for(const hit of ropeHits(state.ropes,from,to,state.age)) sim.cut(hit.id,hit.x,hit.y);
    if(bubbleHit(state.bubble,from,to)) {
      const dx=to.x-from.x;
      sim.popBubble(Math.abs(dx)>.09?dx:to.x-state.bubble.x);
    }
  }

  function stop() {
    if(!active) return null;
    active=false;
    swipe=null;
    trail=[];
    return sim.outcome();
  }

  function resize() {
    const ratio=canvas.clientWidth/(canvas.clientHeight||1);
    if(!ratio) return;
    const half=Math.max(6.9,DIGEST_HEIGHT*.432/ratio);
    camera.left=-half*ratio;
    camera.right=half*ratio;
    camera.top=half;
    camera.bottom=-half;
    camera.updateProjectionMatrix();
    const panelWidth=Math.max(camera.right*2.04,half*1.22);
    backdrop.scale.set(panelWidth,half*2.04,1);
    curtain.scale.copy(backdrop.scale);
  }

  function boardPoint(event) {
    const bounds=canvas.getBoundingClientRect();
    return {
      x:camera.left+(event.clientX-bounds.left)/bounds.width*(camera.right-camera.left),
      y:cameraY-camera.top+(event.clientY-bounds.top)/bounds.height*(camera.top-camera.bottom)-sim.state.index*DIGEST_GAP,
    };
  }

  function pointerStart(event) {
    if(!active || event.button!==0 || swipe) return;
    const point=boardPoint(event);
    swipe={id:event.pointerId,point,travel:0};
    canvas.setPointerCapture(event.pointerId);
  }

  function pointerMove(event) {
    if(swipe?.id!==event.pointerId) return;
    const samples=event.getCoalescedEvents?.()??[];
    for(const sample of samples.length ? samples : [event]){
      const point=boardPoint(sample);
      const old=swipe.point;
      const travel=Math.hypot(point.x-old.x,point.y-old.y);
      if(travel<.028) continue;
      swipe.travel+=travel;
      if(swipe.travel>.075){
        keyboardUntil=0;
        if(!reducedMotion){
          if(trail.length===ribbons.length) trail.shift();
          trail.push({a:old,b:point,time:clock});
        }
        cutStroke(old,point);
      }
      swipe.point=point;
    }
  }

  function pointerEnd(event,tap) {
    if(swipe?.id!==event.pointerId) return;
    if(tap){
      pointerMove(event);
      if(swipe.travel<.15) {
        keyboardUntil=0;
        cutStroke(swipe.point,swipe.point);
      }
    }
    swipe=null;
  }

  function coaching() {
    if(sim.state.done) return '';
    const {age,index,bubble,ropes}=sim.state;
    if(!taughtSwipe && index===0 && age<4.7 && ropes[0].count>0) return 'Swipe through the rope';
    if(!taughtBubble && bubble?.count>0 && age-bubble.caughtAt<1.04) return 'Swipe the bubble to pop it';
    return '';
  }

  function syncHud() {
    const state=sim.state;
    const name=state.layouts[state.index].name;
    if(shown!==name){
      shown=name;
      title.textContent=name;
      number.dataset.step=String(state.index+1);
      number.setAttribute('aria-label','Chamber '+(state.index+1)+' of '+CHAMBERS.length);
    }
    if(shownCount!==state.units) {
      shownCount=state.units;
      total.textContent=format.format(shownCount);
    }
    const caption=coaching();
    if(caption!==cue){
      cue=caption;
      hint.textContent=caption;
    }
    hint.hidden=!caption;
    if(state.done && !showedWin){
      showedWin=true;
      payout.textContent='+'+format.format(sim.outcome().points);
    }
    win.hidden=!state.done;
  }

  function renderFrame(dt) {
    const state=sim.state;
    const base=state.index*DIGEST_GAP;
    const y=base+6.07;
    cameraY+=(y-cameraY)*(reducedMotion?1:1-Math.exp(-dt*5.4));
    camera.position.y=-cameraY;
    backdrop.position.y=curtain.position.y=-cameraY;
    if(currentIndex!==state.index) {
      curtain.material.map=backdrop.material.map;
      backdrop.material.map=textures[state.index];
      curtainAlpha=currentIndex<0 || reducedMotion?0:1;
      currentIndex=state.index;
    }
    curtainAlpha=Math.max(0,curtainAlpha-dt*1.56);
    curtain.visible=curtainAlpha>0;
    curtain.material.opacity=curtainAlpha;
    if(state.delivered!==lastDelivered){
      lastDelivered=state.delivered;
      exitPulse=1;
    }
    exitPulse=Math.max(0,exitPulse-dt*5);
    for(const [i,view] of display.entries()) {
      const current=i===state.index;
      view.group.visible=current || (i===state.index-1 && Math.abs(cameraY-y)>1.6);
      if(!view.group.visible) continue;
      const age=current?state.age:0;
      const swell=current ? (state.done?.16+.04*Math.sin(clock*7):exitPulse*.11) : 0;
      view.jaws.scale.set(1.38+swell,.39+swell*.53,.41);
      for(const {g,bright,beam,line,label,ends} of view.gates) {
        const x=gateX(g,age);
        const response=current && gatePulse && Math.abs(g.y-gatePulse.y)<.08 &&
          Math.abs(gatePulse.x-x)<.44 ? gatePulse.life/.21 : 0;
        beam.position.x=line.position.x=x;
        beam.material.opacity=(bright?.30:.11)+response*.28;
        line.material.opacity=(bright?.88:.24)+response*.15;
        if(label) label.position.x=x;
        for(const [i,end] of ends.entries()) end.position.x=x+(i?1:-1)*g.width*.5;
      }
      for(const {p,rail,rim,hub,bulbs} of view.paddles){
        const [ax,ay,bx,by]=movingBand(p,age);
        const a={x:ax,y:ay},b={x:bx,y:by};
        placeSegment(rail,a,b,.14,.23,.26);
        placeSegment(rim,a,b,.23,.32,.08);
        hub.position.set((ax+bx)*.5,-(ay+by)*.5,.62);
        bulbs[0].position.set(ax,-ay,.40);
        bulbs[1].position.set(bx,-by,.40);
      }
      if(!reducedMotion) for(const {node,y,phase} of view.accents) node.position.y=-y+Math.sin(clock*1.5+phase)*.18;
    }
    const view=display[state.index];
    for(const [j,segments] of strands.entries()) {
      const rope=state.ropes[j];
      const elapsed=rope?.cut ? state.age-rope.cut.age : 0;
      if(rope) {
        const art=view.ropes[j];
        art.label.visible=!rope.cut && clock<keyboardUntil;
        for(const mount of art.mounts) mount.visible=true;
      }
      for(const [i,segment] of segments.entries()) {
        segment.visible=Boolean(rope && elapsed<.91);
        if(!segment.visible) continue;
        const fraction=rope.cut?.fraction??1;
        const splitAt=Math.max(1,Math.min(ROPE_SEGMENTS-1,Math.round(fraction*ROPE_SEGMENTS)));
        const half=rope.cut ? i<splitAt?-1:1 : 0;
        const pointAt=index=>half<0 ? index/splitAt*fraction
          : half>0 ? fraction+(index-splitAt)/(ROPE_SEGMENTS-splitAt)*(1-fraction) : index/ROPE_SEGMENTS;
        const a=ropePoint(rope,pointAt(i),state.age,half);
        const b=ropePoint(rope,pointAt(i+1),state.age,half);
        a.y+=base;
        b.y+=base;
        const size=rope.cut?.096*Math.min(1,(.92-elapsed)*4.1):.097;
        placeSegment(segment,a,b,size,size,.72);
        segment.scale.y*=1.28;
        segment.material=i%2 ? view.ropes[j].color : ropeLight;
      }
    }
    pellets.count=state.pieces.length;
    state.pieces.forEach((piece,i)=>{
      position.position.set(piece.x,-piece.y-base,.37+.09*Math.sin(piece.spin));
      position.rotation.set(piece.spin*.19,piece.spin*.44,piece.spin*.13);
      position.scale.set(piece.radius,piece.radius*(piece.mask?.92:.87),piece.radius*.75);
      position.updateMatrix();
      pellets.setMatrixAt(i,position.matrix);
      pellets.setColorAt(i,getColor(piece.kind));
    });
    pellets.instanceMatrix.needsUpdate=true;
    if(pellets.instanceColor) pellets.instanceColor.needsUpdate=true;
    for(const [i,sprite] of stickers.entries()) {
      const piece=state.index===0 ? state.pieces[i] : null;
      const map=piece && foodMaps.get(piece.kind);
      sprite.visible=Boolean(map && !piece.mask);
      if(!sprite.visible) continue;
      sprite.material.map=map;
      sprite.position.set(piece.x,-piece.y-base,.69);
      sprite.scale.setScalar(piece.radius*2.63);
    }
    dust=dust.filter(particle=>particle.life>0);
    sparks.count=dust.length;
    dust.forEach((particle,i)=>{
      particle.x+=particle.vx*dt;
      particle.y+=particle.vy*dt;
      particle.vy+=dt*5;
      particle.life-=dt;
      position.position.set(particle.x,-particle.y-base,1.05);
      position.rotation.set(clock*5+i,i,clock*3);
      position.scale.setScalar(particle.r*Math.min(1,particle.life*8));
      position.updateMatrix();
      sparks.setMatrixAt(i,position.matrix);
      sparks.setColorAt(i,particle.color);
    });
    sparks.instanceMatrix.needsUpdate=true;
    if(sparks.instanceColor) sparks.instanceColor.needsUpdate=true;
    trail=trail.filter(p=>clock-p.time<.18);
    for(const [i,ribbon] of ribbons.entries()){
      const stroke=trail[i];
      ribbon.visible=Boolean(stroke);
      if(!stroke) continue;
      const life=1-(clock-stroke.time)/.18;
      placeSegment(ribbon,{x:stroke.a.x,y:stroke.a.y+base},{x:stroke.b.x,y:stroke.b.y+base},
        .019+life*.035,.048,1.39);
      ribbon.material.opacity=life*.93;
    }
    const bubble=state.bubble;
    bubbleArt.visible=Boolean(bubble && !bubble.popped && !state.done);
    if(bubbleArt.visible){
      bubbleArt.position.set(bubble.x,-bubble.y-base,1.1);
      bubbleArt.scale.setScalar(bubble.radius*(bubble.count?2.38:2.25));
    }
    tutorial.visible=!reducedMotion && cue==='Swipe through the rope' && !swipe;
    if(tutorial.visible){
      const r=state.ropes[0];
      const a=ropePoint(r,.78,state.age);
      const t=Math.max(0,(clock*1.25)%1);
      placeSegment(tutorial,{x:a.x-.34+t*.76,y:a.y+base-1.0+t*1.38},{x:a.x+.09+t*.76,y:a.y+base-.54+t*1.38},
        .039,.052,1.44);
      tutorial.material.opacity=Math.sin(t*Math.PI)*.88;
    }
    ripple.visible=Boolean(ringFlash && ringFlash.life>0);
    if(ripple.visible){
      ripple.position.set(ringFlash.x,-ringFlash.y-base,1.01);
      ripple.scale.setScalar(ringFlash.size*(1-Math.min(.75,ringFlash.life)));
      ripple.material.opacity=Math.min(1,ringFlash.life*3.1);
      ringFlash.life-=dt;
    }
    comboArt.visible=Boolean(combo && combo.life>0);
    if(comboArt.visible){
      comboArt.position.set(combo.x,-combo.y-base+.26+(.62-combo.life)*.87,1.43);
      comboArt.scale.set(2.09,.67,1);
      comboArt.material.map=labelMap(combo.label);
      comboArt.material.needsUpdate=!comboArt.userData.mapped;
      comboArt.userData.mapped=true;
      comboArt.material.opacity=Math.min(1,combo.life*3.5);
      combo.life-=dt;
    }
    if(gatePulse) gatePulse.life=Math.max(0,gatePulse.life-dt);
  }

  function draw(renderer,dt) {
    if(!active) return;
    clock+=dt;
    accumulator+=dt;
    while(accumulator>=1/120){
      sim.step(1/120);
      accumulator-=1/120;
    }
    if(sim.state.done){
      finishTime+=dt;
      if(finishTime>1.23){
        onFinish(stop());
        return;
      }
    }
    syncHud();
    renderFrame(dt);
    renderer.render(scene,camera);
  }

  return {start,stop,resize,keyCut,keyPop,draw,pointerStart,pointerMove,pointerEnd,cancelSwipe:()=>{swipe=null;trail=[];}};
}
