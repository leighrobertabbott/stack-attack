import { HEAT_LIMIT, FUNK_LIMIT, sandwichReaction, seededRandom } from './stages.js';

export const UPGRADES = [
  {id:'mitts',name:'Oven Mitts',icon:'perk-mitts',cap:2,detail:'One more block per stage'},
  {id:'tongs',name:'Long Tongs',icon:'perk-tongs',cap:3,detail:'Reach a little farther for fresh food'},
  {id:'spring',name:'Spring Spatula',icon:'perk-spring',cap:2,detail:'Flip higher and recharge faster'},
  {id:'glaze',name:'Golden Glaze',icon:'perk-glaze',cap:3,detail:'Toast Rush lasts 0.8s longer'},
];

export const MEDALS = ['','Bronze','Silver','Gold'];
export const DARES = {hot:'Blow his top',sick:'Make him sick',both:'Do both'};

export function orderProgress(order,fills) {
  const counts=new Map();
  for(const kind of fills) counts.set(kind,(counts.get(kind)??0)+1);
  return order.map(({kind,count})=>({kind,count,have:counts.get(kind)??0}));
}

export function dareProgress(dare,recipe) {
  return (dare==='sick' || recipe.heat>=HEAT_LIMIT) && (dare==='hot' || recipe.funk>=FUNK_LIMIT);
}

export function serviceScore(stage,fills,stats) {
  const ordered=orderProgress(stage.order,fills).every(({have,count})=>have>=count);
  const dared=dareProgress(stage.dare,sandwichReaction(fills));
  const serving=fills.length*25;
  const ticket=ordered?1200:0;
  const dare=dared?(stage.dare==='both'?1800:1400):0;
  const target=[.33,.61,.83].map(ratio=>Math.ceil(stage.beatCount*ratio));
  const goldStyle=ordered || dared || stats.air>=2;
  const medal=fills.length>=target[2] && goldStyle ? 3
    : fills.length>=target[1] ? 2 : fills.length>=target[0] ? 1 : 0;
  return {ordered,dared,serving,ticket,dare,target,goldStyle,medal};
}

export function upgradeOffers(seed,levels) {
  const random=seededRandom(seed^0xe73462ca);
  return UPGRADES
    .map(upgrade=>({upgrade,rank:random()}))
    .filter(({upgrade})=>(levels[upgrade.id]??0)<upgrade.cap)
    .sort((a,b)=>a.rank-b.rank)
    .slice(0,2)
    .map(({upgrade})=>upgrade);
}
