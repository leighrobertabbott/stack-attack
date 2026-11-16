import { seededRandom } from './stages.js';

export const DIGEST_WIDTH = 4.68;
export const DIGEST_HEIGHT = 12;
export const DIGEST_GAP = 13.25;
export const MAX_MORSELS = 216;
export const ROPE_SEGMENTS = 19;
const CUT_COLORS=[0xffa36c,0x79ecd5,0xc5a5ff,0xffdf85];

const rope=(name,ax,bx,y,sag)=>({name,ax,bx,y,sag});
const gate=(name,row,x,y,width,factor,travel=0,tempo=1)=>({name,row,x,y,width,factor,travel,tempo});
const paddle=(x,y,length,angle,swing,tempo,travel=0)=>({x,y,length,angle,swing,tempo,travel});

export const CHAMBERS = [
  {
    name:'Esophagus', art:'digest-esophagus-depth', background:0x420e25, wall:0xb83d59, rail:0xf28773, energy:0x81f5d6,
    ropes:[rope('Feed rope',-4.62,4.62,2.56,.78),rope('Left pocket',-4.60,-.03,7.08,.58),rope('Right pocket',.03,4.60,7.08,.58)],
    gates:[gate('Quick swallow',0,2.81,5.38,2.66,3,.42,1.2),gate('Swallow',0,0,5.38,8.95,2),
      gate('Enzyme',1,-2.90,9.39,2.31,2,.43,1.4),gate('Enzyme',1,2.90,9.39,2.31,2,.43,1.4)],
    bands:[[-4.34,3.82,-3.05,4.45],[4.34,3.82,3.05,4.45],[-4.44,8.38,-3.82,8.70],[4.44,8.38,3.82,8.70]],
    paddles:[paddle(0,4.64,2.72,.15,.75,1.54),paddle(0,8.56,2.95,-.09,.54,1.39,.94)],
  },
  {
    name:'Stomach', art:'digest-stomach-depth', bubble:{y:8.76,radius:.77}, background:0x481026, wall:0xa52c65, rail:0xe3aa69, energy:0x9aefb2,
    ropes:[rope('Upper pocket',-4.60,-.08,2.24,.67),rope('Lower pocket',.08,4.60,3.44,.67),rope('Drain rope',-3.92,3.92,7.35,.70)],
    gates:[gate('Acid wash',0,0,6.17,3.88,4,2.33,1.56),gate('Foam',0,0,6.17,9.15,2),
      gate('Bubble jet',1,0,9.65,3.56,3,2.65,1.53)],
    bands:[[-4.42,4.45,-3.70,4.91],[4.43,6.65,3.96,6.98],[-4.46,8.23,-3.30,8.73],[4.47,8.39,3.42,8.94]],
    paddles:[paddle(-.14,4.91,2.47,-.19,1.22,2.18,1.23),paddle(.14,8.84,2.59,.31,1.09,1.76,1.64)],
  },
  {
    name:'Small Intestine', art:'digest-intestine-depth', bubble:{y:9.72,radius:.69}, background:0x221449, wall:0x6044a7, rail:0xab94ef, energy:0x76e9fb,
    ropes:[rope('Feed rope',-4.62,4.62,1.97,.68),rope('Left pocket',-4.58,.02,5.36,.51),
      rope('Right pocket',.02,4.58,6.48,.51),rope('Exit rope',-3.06,3.06,8.50,.50)],
    gates:[gate('First enzyme',0,0,4.56,3.92,3,1.59,2.31),
      gate('Second enzyme',1,-2.38,7.77,3.12,2,.54,1.85),gate('Second enzyme',1,2.38,7.77,3.12,2,.54,1.85),
      gate('Absorption',2,0,10.52,2.62,5,2.02,1.67),gate('Absorption',2,0,10.52,9.14,2)],
    bands:[[-4.39,3.45,-3.12,3.99],[4.36,3.48,3.02,4.0],[-4.38,7.85,-3.55,8.27],[4.38,8.23,3.57,8.69]],
    paddles:[paddle(-.24,3.67,2.32,.3,.83,2.37,.78),paddle(.84,6.09,1.43,-.35,1.52,2.63,.68),
      paddle(0,9.65,2.78,.04,.92,2.71,1.53)],
  },
];

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const mix=(a,b,t)=>a+(b-a)*t;

export function makeChambers(seed) {
  const random=seededRandom(seed^0xfd921519);
  return CHAMBERS.map(chamber=>{
    const flip=random()<.5?-1:1;
    const phase=random()*Math.PI*2;
    const shift=(random()-.5)*.36;
    return {...chamber,phase,flip,
      ropes:chamber.ropes.map((r,id)=>{
        const ax=Math.min(flip*r.ax,flip*r.bx),bx=Math.max(flip*r.ax,flip*r.bx);
        const name=r.name==='Left pocket'||r.name==='Right pocket' ? ax+bx<0?'Left pocket':'Right pocket' : r.name;
        return {...r,id,color:CUT_COLORS[id],ax,bx,name};
      }),
      gates:chamber.gates.map((g,i)=>({...g,x:flip*g.x,phase:phase+i*1.8})),
      bands:chamber.bands.map(([ax,ay,bx,by])=>[flip*ax,ay+shift,flip*bx,by+shift]),
      paddles:chamber.paddles.map((p,i)=>({...p,x:flip*p.x,angle:flip*p.angle,phase:phase+i*1.93})),
    };
  });
}

export function ropePoint(r,fraction,age,half=0) {
  const x=mix(r.ax,r.bx,fraction);
  const wave=Math.sin(Math.PI*fraction);
  const drop=r.sag*4*fraction*(1-fraction);
  if(!r.cut) return {x,y:r.y+drop+Math.sin(age*4+fraction*6)*.036*wave};
  const t=clamp((age-r.cut.age)*2.25,0,1);
  const ease=1-(1-t)**3;
  const side=half || (fraction<=r.cut.fraction?-1:1);
  const length=side<0?r.cut.fraction:1-r.cut.fraction;
  const free=(side<0?fraction:1-fraction)/length;
  const anchor=side<0?r.ax:r.bx;
  const hang=Math.min(3.24,(r.bx-r.ax)*length*.91);
  return {x:mix(x,anchor-side*.46*free,ease),
    y:r.y+mix(drop,free*hang,ease)+Math.sin((age-r.cut.age)*17-free*3)*free*(1-t)*.31};
}

export const gateX=(g,age)=>g.x+g.travel*Math.sin(age*g.tempo+g.phase);

export function movingBand(p,age) {
  const phase=p.tempo*age+p.phase;
  const x=p.x+Math.sin(phase*.69)*p.travel;
  const a=p.angle+Math.sin(phase)*p.swing;
  const dx=Math.cos(a)*p.length*.5,dy=Math.sin(a)*p.length*.5;
  return [x-dx,p.y-dy,x+dx,p.y+dy];
}

function pointToSegment(point,a,b) {
  const dx=b.x-a.x, dy=b.y-a.y;
  const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
  return (point.x-a.x-dx*t)**2+(point.y-a.y-dy*t)**2;
}

export function bubbleHit(bubble,from,to) {
  return Boolean(bubble && !bubble.popped && pointToSegment(bubble,from,to)<(bubble.radius+.09)**2);
}

export function ropeHits(ropes,from,to,age) {
  const dx=to.x-from.x,dy=to.y-from.y;
  const contacts=[];
  for(const r of ropes) {
    if(r.cut) continue;
    let contact=null, nearest=null, distance=.24**2;
    for(let i=0;i<ROPE_SEGMENTS;i++) {
      const a=ropePoint(r,i/ROPE_SEGMENTS,age);
      const b=ropePoint(r,(i+1)/ROPE_SEGMENTS,age);
      const rx=b.x-a.x,ry=b.y-a.y;
      const denominator=dx*ry-dy*rx;
      if(denominator) {
        const qx=a.x-from.x,qy=a.y-from.y;
        const t=(qx*ry-qy*rx)/denominator;
        const u=(qx*dy-qy*dx)/denominator;
        if(t>=0 && t<=1 && u>=0 && u<=1 && (!contact || t<contact.t)){
          contact={id:r.id,t,x:from.x+t*dx,y:from.y+t*dy,distance:0};
        }
      }
      const separation=Math.min(pointToSegment(from,a,b),pointToSegment(to,a,b),
        pointToSegment(a,from,to),pointToSegment(b,from,to));
      if(separation<distance) {
        distance=separation;
        const x=clamp((from.x+to.x)*.5,a.x,b.x);
        const y=mix(a.y,b.y,(x-a.x)/(b.x-a.x));
        nearest={id:r.id,t:0,x,y,distance};
      }
    }
    if(contact||nearest) contacts.push(contact??nearest);
  }
  const crossing=contacts.filter(p=>p.distance===0).sort((a,b)=>a.t-b.t);
  if(crossing.length) return crossing;
  return contacts.sort((a,b)=>a.distance-b.distance).slice(0,1);
}
function bump(piece,band) {
  const [ax,ay,bx,by]=band;
  const dx=bx-ax, dy=by-ay;
  const t=clamp(((piece.x-ax)*dx+(piece.y-ay)*dy)/(dx*dx+dy*dy),0,1);
  const px=piece.x-ax-t*dx, py=piece.y-ay-t*dy;
  const radius=piece.radius+.16;
  const d2=px*px+py*py;
  if(d2>=radius*radius) return;
  const dist=Math.sqrt(d2)||.001;
  const nx=dist>.001 ? px/dist : Math.sign(dx)*.48;
  const ny=dist>.001 ? py/dist : -.87;
  piece.x+=nx*(radius-dist);
  piece.y+=ny*(radius-dist);
  const velocity=piece.vx*nx+piece.vy*ny;
  if(velocity<0) {
    piece.vx-=velocity*nx*1.27;
    piece.vy-=velocity*ny*1.27;
  }
}

function separateMorsels(pieces) {
  const bins=new Map();
  const cell=.62, stride=32;
  for(const piece of pieces) {
    if(piece.y<2.8) continue;
    const cx=Math.floor((piece.x+DIGEST_WIDTH)/cell),cy=Math.floor(piece.y/cell);
    const bucket=cy*stride+cx;
    for(let row=-1;row<=1;row++) for(let col=-1;col<=1;col++) {
      const neighbors=bins.get(bucket+row*stride+col);
      if(!neighbors) continue;
      for(const other of neighbors) {
        const dx=piece.x-other.x,dy=piece.y-other.y;
        const d2=dx*dx+dy*dy, reach=(piece.radius+other.radius)*.93;
        if(!d2 || d2>=reach*reach) continue;
        const distance=Math.sqrt(d2);
        const amount=Math.min(.065,(reach-distance)*.45)/distance;
        piece.x+=dx*amount;
        piece.y+=dy*amount;
        other.x-=dx*amount;
        other.y-=dy*amount;
      }
    }
    if(bins.has(bucket)) bins.get(bucket).push(piece);
    else bins.set(bucket,[piece]);
  }
}

export function createDigestion(seed,fills,notify=()=>{}) {
  const layouts=makeChambers(seed);
  const random=seededRandom(seed^0x0a9556fc);
  const ingredients=fills.length?fills:['toast','toast'];
  let portions=ingredients.map(kind=>({kind,units:1,chain:0}));
  if(portions.length>MAX_MORSELS) {
    const counts=new Map();
    for(const kind of ingredients) counts.set(kind,(counts.get(kind)??0)+1);
    portions=Array.from(counts,([kind,units])=>({kind,units,chain:0}));
  }
  const state={layouts,pieces:[],ropes:[],index:0,age:0,units:0,delivered:0,chambersClear:0,done:false,
    bestCombo:0,roomsHit:[false,false,false],bubble:null};
  let next=[],carryTime=0,scored=0,bankedChain=0;

  function load(morsels) {
    const count=morsels.length;
    const chamber=layouts[state.index];
    state.ropes=chamber.ropes.map(r=>({...r,cut:null,count:0}));
    state.age=state.delivered=carryTime=0;
    const exitGate=chamber.gates.find(g=>g.row===state.index && g.factor>2);
    state.bubble=chamber.bubble ? {...chamber.bubble,popped:false,camber:chamber.phase,
      startY:chamber.bubble.y,caughtAt:Infinity,count:0,x:0,exitGate} : null;
    moveBubble(chamber);
    state.units=morsels.reduce((sum,piece)=>sum+piece.units,0);
    state.pieces=morsels.map((piece,i)=>{
      const x=state.index===1 ? chamber.flip*(i%2?1:-1)*(.73+random()*2.92) : (random()-.5)*6.04;
      return {...piece,x,y:.23+random()*1.0,vx:(random()-.5)*.6,vy:random()*1.31,
        radius:Math.max(.095,.244-count*.00055)*(1+random()*.21),
        spin:random()*Math.PI*2,mask:0,hold:null,delay:Math.floor(i/21)*.016,lastDrop:0,lowest:0};
    });
    next=[];
    notify('enter',state);
  }

  function cut(id,x,y) {
    const r=state.ropes[id];
    if(!r || r.cut || state.done || state.age<.28) return false;
    const width=r.bx-r.ax;
    x ??= (r.ax+r.bx)*.5;
    y ??= ropePoint(r,(x-r.ax)/width,state.age).y;
    const lean=clamp((x-(r.ax+r.bx)*.5)/(width*.5),-1,1);
    const dir=Math.abs(lean)<.12 ? (Math.abs(x)>.4?Math.sign(x):1) : Math.sign(lean);
    // The sag tips toward the cut. Once released the pieces only respond to gravity and collisions.
    r.cut={age:state.age,fraction:clamp((x-r.ax)/width,.035,.965)};
    const count=r.count;
    for(const piece of state.pieces) {
      if(piece.hold!==id) continue;
      piece.hold=null;
      const strength=Math.abs(lean)<.12?.48:1;
      piece.vx=piece.vx*.42+dir*(.68+random()*1.19+strength*(width*.44));
      piece.vy=1.12+random()*.98;
      piece.lastDrop=state.age;
    }
    r.count=0;
    notify('cut',{x,y,count,name:r.name});
    return true;
  }

  function moveBubble(chamber) {
    const bubble=state.bubble;
    if(!bubble||bubble.popped) return;
    const rise=clamp((state.age-bubble.caughtAt)*.43,0,.56);
    const target=bubble.exitGate ? gateX(bubble.exitGate,state.age)*.86 : 0;
    bubble.x=target+.61*Math.sin(state.age*1.91+chamber.phase);
    bubble.y=bubble.startY+.12*Math.sin(state.age*2.96+bubble.camber)-rise;
  }

  function popBubble(direction=1,voluntary=true) {
    const bubble=state.bubble;
    if(!bubble || bubble.popped || state.age<.28 || state.done) return false;
    bubble.popped=true;
    const side=Math.sign(direction)||Math.sign(-bubble.x)||1;
    const count=bubble.count;
    for(const piece of state.pieces) {
      if(piece.inBubble){
        piece.inBubble=false;
        piece.vx=side*(2.08+random()*1.96);
        piece.vy=1.03+random()*1.13;
        piece.lastDrop=state.age;
      } else if(voluntary && piece.hold===null && (piece.x-bubble.x)**2+(piece.y-bubble.y)**2<1.35**2){
        piece.vx+=side*1.5;
        piece.vy=Math.max(piece.vy,1.8);
      }
    }
    bubble.count=0;
    notify('bubblePop',{x:bubble.x,y:bubble.y,count,voluntary});
    return true;
  }

  function catchRope(piece,beforeY) {
    const old=piece.hold;
    for(const r of state.ropes) {
      if(r.cut || piece.x<r.ax || piece.x>r.bx) continue;
      const fraction=(piece.x-r.ax)/(r.bx-r.ax);
      const floor=ropePoint(r,fraction,state.age).y-piece.radius-.072;
      if(piece.y<floor || (beforeY>floor+.14 && old!==r.id)) continue;
      piece.y=floor;
      piece.vy*=-.13;
      piece.vx=(piece.vx-(fraction-.5)*.10)*.86;
      piece.hold=r.id;
      return;
    }
  }

  function split(piece,budget,spawned) {
    if(state.pieces.length+next.length+spawned.length>=budget || piece.units<2) return;
    const half=Math.floor(piece.units/2);
    piece.units-=half;
    piece.radius=Math.max(.088,piece.radius*.83);
    spawned.push({...piece,units:half,x:piece.x+(random()-.5)*.27,vx:piece.vx+(random()-.5)*4.4,
      vy:Math.max(1.15,piece.vy*(.63+random()*.24)),spin:random()*Math.PI*2});
  }

  function step(dt) {
    if(state.done) return;
    state.age+=dt;
    const chamber=layouts[state.index];
    moveBubble(chamber);
    const bubble=state.bubble;
    if(bubble && !bubble.popped && state.age-bubble.caughtAt>1.17) popBubble(-bubble.x,false);
    const obstacles=[...chamber.bands,...chamber.paddles.map(p=>movingBand(p,state.age))];
    const gates=chamber.gates.map(g=>({...g,center:gateX(g,state.age)}));
    const spawned=[];
    let bestGate;
    const budget=[108,156,MAX_MORSELS][state.index];
    for(const r of state.ropes) r.count=0;
    for(let i=state.pieces.length-1;i>=0;i--) {
      const piece=state.pieces[i];
      if(piece.delay>state.age) continue;
      if(piece.inBubble) {
        piece.x=bubble.x+piece.bubbleX;
        piece.y=bubble.y+piece.bubbleY;
        piece.spin+=dt;
        continue;
      }
      const beforeX=piece.x,beforeY=piece.y;
      piece.vy+=dt*15.4;
      piece.x+=piece.vx*dt;
      piece.y+=piece.vy*dt;
      piece.spin+=piece.vx*dt*1.1;
      const edge=DIGEST_WIDTH-piece.radius;
      if(Math.abs(piece.x)>edge) {
        piece.x=clamp(piece.x,-edge,edge);
        piece.vx*=-.49;
      }
      catchRope(piece,beforeY);
      if(piece.hold===null) {
        // Drop squeezed food through a baffle after a long stall. Closed ropes still catch it.
        if(piece.y>piece.lowest+.18){
          piece.lowest=piece.y;
          piece.lastDrop=state.age;
        }
        if(state.age-piece.lastDrop>2.20) piece.vy=Math.max(piece.vy,4.2);
        else for(const band of obstacles) bump(piece,band);
        catchRope(piece,beforeY);
      }
      const y=piece.y;
      if(y>beforeY) {
        for(const g of gates) {
          const flag=1<<g.row;
          if(piece.mask&flag || beforeY>g.y || y<g.y) continue;
          const x=mix(beforeX,piece.x,(g.y-beforeY)/(y-beforeY));
          if(Math.abs(x-g.center)>g.width*.5) continue;
          state.units+=piece.units*(g.factor-1);
          piece.units*=g.factor;
          piece.mask|=flag;
          piece.chain++;
          state.bestCombo=Math.max(state.bestCombo,piece.chain);
          if(g.factor>=3) state.roomsHit[state.index]=true;
          if(!bestGate || (g.factor*10+piece.chain)>(bestGate.factor*10+bestGate.chain)) bestGate={...g,chain:piece.chain};
          split(piece,budget,spawned);
        }
      }
      if(bubble && !bubble.popped && piece.hold===null && piece.vy>0 &&
        (piece.x-bubble.x)**2+(piece.y-bubble.y)**2<bubble.radius**2){
        piece.inBubble=true;
        piece.bubbleX=(piece.x-bubble.x)*.63;
        piece.bubbleY=(piece.y-bubble.y)*.62;
        if(!bubble.count) {
          bubble.caughtAt=state.age;
          notify('bubbleCatch',{x:bubble.x,y:bubble.y});
        }
        bubble.count+=piece.units;
      }
      if(piece.hold!==null) {
        state.ropes[piece.hold].count+=piece.units;
        piece.lastDrop=state.age;
      } else if(!piece.inBubble && y>11.50) {
        state.delivered+=piece.units;
        next.push({kind:piece.kind,units:piece.units,chain:piece.chain});
        state.pieces.splice(i,1);
      } else if(y>10.72) {
        piece.x*=Math.exp(-dt*8.4);
        piece.vx*=Math.exp(-dt*4);
      }
    }
    state.pieces.push(...spawned);
    separateMorsels(state.pieces.filter(piece=>piece.hold!==null));
    if(bestGate) notify('gate',{...bestGate,index:state.index});
    if(state.pieces.length) return;
    carryTime+=dt;
    if(carryTime<.48) return;
    state.chambersClear++;
    scored=state.delivered;
    bankedChain=state.bestCombo;
    if(state.index===layouts.length-1) {
      state.done=true;
      notify('finish',state);
      return;
    }
    state.index++;
    load(next);
  }

  function outcome() {
    return {units:scored,points:Math.round(scored*1.24+bankedChain*90),cleared:state.chambersClear,
      chain:bankedChain,perfect:state.done && state.roomsHit.every(Boolean) && bankedChain>=6};
  }

  load(portions);
  return {state,step,cut,popBubble,outcome};
}
