import { FEATURE_COURSES, FEATURE_FOODS } from './feature-courses.js';

export const STEER_LIMIT = 3.14;
export const STEER_SPEED = 14;
export const RUSH_RADIUS = 1.95;
export const HEAT_LIMIT = 4;
export const FUNK_LIMIT = 3;

export const FILLED = {
  ...FEATURE_FOODS,
  tomato: { name: 'Tomato', color: 0xf75039, height: .20 },
  lettuce: { name: 'Lettuce', color: 0x86d94a, height: .17 },
  patty: { name: 'Patty', color: 0x804125, height: .29 },
  egg: { name: 'Fried egg', color: 0xffd449, height: .17 },
  cheese: { name: 'Cheddar', color: 0xffb841, height: .12 },
  pickle: { name: 'Pickle', color: 0xaac454, height: .15 },
  chili: { name: 'Chilli', color: 0xf2472e, height: .13, heat: 1 },
  fish: { name: 'Spoiled fish', color: 0x97ae6d, height: .20, funk: 2 },
  mould: { name: 'Mouldy cheese', color: 0x82ae62, height: .15, funk: 1 },
};

export const THEMES = [
  {
    name:'Sunny Shores', world:'shore', course:'Boardwalk and beach islands', accent:'#f8bb73',
    sky:'#42bede', horizon:'#c7f5ec', deep:'#0986aa', shallow:'#30bfc1',
    sand:'#ffdf9b', plank:'#f8be78', leaf:0x4f9f61, trim:0xff7955, width:7.48, pinch:0, bend:0, lift:0, pace:1,
  },
  {
    name:'Coral Cove', world:'reef', course:'Wide reef bends and narrow crossings', accent:'#f38ea1',
    sky:'#59b8ca', horizon:'#d7f9ee', deep:'#0b94a0', shallow:'#7ce8cc', grade:.22,
    sand:'#ffd6be', plank:'#e59195', leaf:0x41a266, trim:0xff879d, width:7.66, pinch:1.30, bend:6.0, lift:1.34, pace:.96,
  },
  {
    name:'Lantern Wharf', world:'harbor', course:'Steep bridges through a lantern-lit harbor', accent:'#b3a6ff',
    sky:'#2e3986', horizon:'#9d82ab', deep:'#193657', shallow:'#4f5b9c', skyArt:'lanternSky',
    sand:'#d3a884', plank:'#855960', leaf:0x476788, trim:0xff9a57, width:7.1, pinch:.95, bend:3.4, lift:3.70, pace:1.06,
  },
  {
    name:'Pepper Peak', world:'peak', course:'Volcanic hills, rolling pins and extra chillies', accent:'#fa765e',
    sky:'#ed855f', horizon:'#ffd0a1', deep:'#682d48', shallow:'#d27f6f', skyArt:'pepperSky',
    sand:'#c87a61', plank:'#75485a', leaf:0x865b5b, trim:0xf74731, width:7.6, pinch:1.18, bend:4.35, lift:5.86, pace:1.09,
  },
  {
    name:'Cloud Kitchen', world:'cloud', course:'High, twisting bridges through the clouds', accent:'#9cdbe8',
    sky:'#758bd4', horizon:'#eae7f8', deep:'#586aaa', shallow:'#abbaf3', grade:.53,
    sand:'#e7e2ee', plank:'#8799ce', leaf:0x438885, trim:0x8e8fee, width:8.3, pinch:1.34, bend:5.05, lift:7.8, pace:.93,
  },
  ...FEATURE_COURSES,
];

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let scrambled = Math.imul(value ^ value >>> 15, value | 1);
    scrambled ^= scrambled + Math.imul(scrambled ^ scrambled >>> 7, scrambled | 61);
    return ((scrambled ^ scrambled >>> 14) >>> 0) / 4294967296;
  };
}

const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
const smooth = (value) => {
  const t=clamp(value,0,1);
  return t*t*(3-2*t);
};

export function pathX(stage, distance) {
  if (distance <= 5 || distance >= stage.length || !stage.theme.bend) return 0;
  const { phase, wave, lean }=stage.profile;
  const edge=smooth((distance-5)/30)*smooth((stage.length-distance)/29);
  return edge*stage.theme.bend*(.82*Math.sin(distance*wave+phase)+.19*Math.sin(distance*wave*1.91+lean));
}

export function pathY(stage,distance) {
  let y=0;
  for(const hill of stage.profile.hills) {
    const rise=Math.abs(distance-hill.at)/hill.radius;
    if(rise<1) y+=hill.height*(1+Math.cos(rise*Math.PI))*.5;
  }
  return y;
}

export function pathWidth(stage,distance) {
  if (!stage.theme.pinch) return stage.theme.width;
  const envelope=smooth((distance-4)/22)*smooth((stage.length-distance)/23);
  const f=distance*stage.profile.wave;
  return stage.theme.width+stage.theme.pinch*envelope*(.72*Math.sin(f*1.67+stage.profile.lean)+.28*Math.cos(f*.77));
}

export function steeringLimit(stage,distance) {
  return pathWidth(stage,distance)*.5-.60;
}

export function itemOffset(item,distance) {
  return item.offset+(item.swing ?? 0)*Math.sin((distance-item.at)*.29);
}

export function sandwichReaction(fills) {
  let heat=0, funk=0;
  for(const kind of fills) {
    heat+=FILLED[kind]?.heat??0;
    funk+=FILLED[kind]?.funk??0;
  }
  return {
    heat,funk,
    type:heat>=HEAT_LIMIT && funk>=FUNK_LIMIT ? 'both' : funk>=FUNK_LIMIT ? 'sick' : heat>=HEAT_LIMIT ? 'hot' : 'happy',
  };
}

export function makeStage(seed, number, difficulty=number) {
  const random=seededRandom(seed^Math.imul(number,0x9e3779b9));
  const theme=THEMES[(number-1)%THEMES.length];
  const choose=(list)=>list[Math.floor(random()*list.length)];
  const tier=Math.min(12,difficulty);
  const span=3.72-tier*.043;
  const speed=Math.min(19,10.9+(tier-1)*.69)*theme.pace;
  const palette=theme.foods??['tomato','lettuce','patty','egg','cheese','pickle'].slice(0,number===1?4:6);
  const patterns={
    shore:[.99,1.02,1.01],
    reef:[.66,.77,1.43,1.16],
    harbor:[.84,.93,1.24,.81,1.11],
    peak:[1.20,.77,.79,1.23],
    cloud:[.63,.70,.86,1.65,1.16],
  };
  const cadence=theme.pattern??patterns[theme.world];
  // Course-specific phrases hold, cut back, or build speed within the same piece of track.
  const sweepShapes={
    shore:[0,.55,1,1,.28,-.40,-1,-.64,0],
    reef:[-.64,-1,-1,-.64,0,.64,1,.85,.44],
    harbor:[0,.6,.8,.3,-.4,-.8,-.3,.6,1],
    peak:[-1,-.7,.7,1,.5,-.7,-1,-.2,.65],
    cloud:[0,.6,1,.96,.72,.21,-.35,-.8,-1],
    wizard:[0,-.65,-1,-.72,.02,.75,1,.76,.2],
    home:[.58,1,.64,-.86,-1,-.45,.60,1,.53],
    buck:[.8,.6,-.3,-.8,-.7,.1,.82,.82,.15],
    liverpool:[-1,-.52,.25,1,.42,-.3,-1,-.4,.61],
    jungle:[.17,.86,.42,-.4,-1,-.1,.88,.34,-.38],
    future:[-.77,.3,.9,.29,-.85,-.65,.59,1,.09],
  };
  const shape=sweepShapes[theme.world];
  const sections=[
    {type:'opening',count:6,rhythm:[1.13]},
    {type:'sweep',count:8+tier%3,rhythm:[.83,1.10,1.03]},
    {type:'fork',count:11,rhythm:[.95,1.12],side:choose([-1,1])},
    {type:'flip',count:10,rhythm:[1.04,1,.87],side:choose([-1,1])},
    {type:'recovery',count:5,rhythm:[1.09,.92]},
    {type:'finale',count:8+Math.floor(tier/4),rhythm:[.72,.81,1.17]},
  ];
  let at=10.5, beat=0;
  for(const section of sections) {
    section.rows=[];
    for(let i=0;i<section.count;i++) {
      if(beat) at+=span*cadence[beat%cadence.length]*section.rhythm[i%section.rhythm.length]*(.96+random()*.08);
      if(section.type==='flip' && i===8) at=Math.max(at,section.rows[3]+speed*1.03);
      section.rows.push(at);
      beat++;
    }
    section.at=section.rows[0];
  }
  const length=at+13;
  const hillSeeds=theme.hills??(theme.world==='peak'?[.28,.63]:theme.world==='cloud'?[.32,.69]:[.32,.72]);
  const profile={
    phase:random()*Math.PI*2,
    lean:random()*Math.PI*2,
    wave:(theme.world==='reef'?.069:.043)+random()*.012,
    hills:theme.lift ? hillSeeds.map((location,i)=>{
      const center=length*(location+(random()-.5)*.055);
      return {at:center,radius:Math.min(center-7,length-center-8,19+theme.lift*2+i*3),height:theme.lift*(.70+random()*.33)};
    }) : [],
  };
  const orderStart=Math.floor(random()*palette.length);
  const order=[0,1].map((i)=>({kind:palette[(orderStart+i)%palette.length],count:3+(i===0 && tier>=4 ? 1 : 0)}));
  const dare=tier===1 && number===1 ? 'hot' : choose(['hot','sick','both']);
  const items=[], markers=[];
  const stage={number,items,markers,sections,order,dare,beatCount:beat,speed,seed:seed^Math.imul(number,0x4a39b70d),length,theme,profile};
  const hot=theme.hot??'chili', spoiled=theme.spoiled??'fish';
  const hazards=dare==='hot' ? [hot,hot,spoiled,hot,hot,spoiled,hot]
    : dare==='sick' ? [spoiled,hot,spoiled,hot,spoiled,hot,hot]
    : [hot,spoiled,hot,hot,spoiled,hot,hot];
  const side=choose([-1,1]);
  const bound=(value,distance,margin=.21)=>{
    const limit=steeringLimit(stage,distance)-margin;
    return clamp(value,-limit,limit);
  };
  let offset=0, previous=0, index=0;
  for(const section of sections) {
    const {type,rows}=section;
    for(const [i,distance] of rows.entries()) {
      const t=i/(rows.length-1);
      const shapeAt=t*(shape.length-1);
      const shapeIndex=Math.floor(shapeAt);
      const sweep=shape[shapeIndex]+((shape[shapeIndex+1]??shape[shapeIndex])-shape[shapeIndex])*smooth(shapeAt-shapeIndex);
      const desired={
        opening:.63*side*smooth(t),
        sweep:side*sweep*1.93,
        fork:-section.side*1.90*smooth(t*3.2),
        flip:-section.side*1.88*smooth(t*3.0),
        recovery:side*1.25*Math.sin(t*Math.PI),
        finale:side*Math.sin(t*Math.PI*(tier>4?3.5:2.5))*2.38,
      }[type];
      const allowable=STEER_SPEED*.58*(distance-previous)/speed;
      offset=bound(offset+clamp(desired-offset,-allowable,allowable),distance);
      const pick=order.find((_,j)=>index>=palette.length+j && (index-palette.length-j)%5===0);
      const kind=index<palette.length ? palette[index] : pick?.kind??choose(palette);
      items.push({at:distance,offset,kind,trail:true});
      if(type==='fork' && i>=3 && i<10) {
        items.push({at:distance,offset:bound(section.side*(1.92+.20*Math.sin(i)),distance),kind:hazards[i-3],dare:true});
      } else if(type==='flip' && (i===3 || i===8)) {
        const pinOffset=bound(section.side*2.0,distance,.38);
        items.push({at:distance,offset:pinOffset,kind:'pin',swing:.34});
        items.push({at:distance+.42,offset:pinOffset,kind:i===3?'coin':'golden',air:true});
        const launchAt=distance-speed*.255;
        markers.push({at:launchAt,offset:bound(pinOffset,launchAt,.4),kind:'flip'});
      } else if((type==='sweep' && i===2) || (type==='finale' && i===1)) {
        const goldAt=distance+.84;
        items.push({at:goldAt,offset:bound(offset+.20*side,goldAt),kind:'golden'});
      } else if(type==='recovery' && i===1) {
        const extra=distance+.94;
        items.push({at:extra,offset:bound(offset,extra),kind:choose(palette)});
      } else if((type==='sweep' || type==='finale') && i>=2 && i%3===2) {
        const extra=distance+span*.41;
        items.push({at:extra,offset:bound(offset+(offset>0?-1:1)*1.26,extra),kind:random()>.60?'coin':choose(palette)});
      }
      previous=distance;
      index++;
    }
  }
  const fork=sections.find(section=>section.type==='fork');
  const signAt=fork.rows[1];
  markers.push({at:signAt,offset:bound(-fork.side*1.9,signAt),kind:'fresh'});
  markers.push({at:signAt,offset:bound(fork.side*1.9,signAt),kind:dare});
  items.sort((a,b)=>a.at-b.at);
  return stage;
}
