import * as T from './vendor/three.js';
import {
  STEER_SPEED, RUSH_RADIUS, HEAT_LIMIT, FUNK_LIMIT, FILLED, THEMES,
  makeStage, pathX, pathY, steeringLimit, itemOffset, sandwichReaction,
} from './stages.js';
import { makeFoodLibrary, makeChef } from './models.js';
import { createAtmosphere, makeCourse } from './scenery.js';
import { makeAudio } from './audio.js';
import { makeFeatureFood } from './feature-food-models.js';
import { loadArt } from './art.js';
import { paintIcons, prepareIcons } from './ui-icons.js';
import { makeDigestion } from './digestion.js';
import { UPGRADES, MEDALS, DARES, orderProgress, dareProgress, serviceScore, upgradeOffers } from './service.js';

const $ = (id) => document.getElementById(id);
const game = $('game'), canvas = $('world'), overlay = $('overlay'), dialog = $('dialog');
const gameUI = {
  stage: $('stageNumber'), name: $('stageName'), score: $('score'), best: $('bestScore'),
  progress: $('progressValue'), bar: $('progressFill'), fill: $('fillCount'),
  label: $('fillLabel'), combo: $('combo'), rushBanner: $('rushBanner'), rushFill: $('rushFill'),
  heat: $('heatCount'), funk: $('funkCount'), heatIcon: $('heatIcon'), funkIcon: $('funkIcon'),
  toast: $('toast'), countdown: $('countdown'), sound: $('soundButton'),
  order: $('orderItems'), dare: $('dareName'), flip: $('flipButton'), flipStatus: $('flipStatus'),
};
const point = new T.Vector3();
const RUSH_DURATION = 4.75;
const CHAIN_WINDOW = .96;
const FLIP_LENGTH = .66;
const FLIP_BUFFER = .16;

const steeringKeys = new Set(['arrowleft','a','arrowright','d']);
const smoothedLook = new T.Vector3();
const idealCam = new T.Vector3();
const idealLook = new T.Vector3();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const numberText = new Intl.NumberFormat();

function load(key, fallback) {
  try { return localStorage.getItem('tidal-diner:' + key) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem('tidal-diner:' + key, String(value)); } catch { /* Private browsing can disable storage. */ }
}
function freshSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }

let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  boot();
} catch (error) {
  console.error(error);
  $('error').hidden = false;
}

function boot() {
  const touchDisplay = matchMedia('(pointer: coarse)').matches;
  let resolution = Math.min(window.devicePixelRatio || 1,touchDisplay ? 1.5 : 1.65);
  let framesAtResolution = 0, averageFrame = 1/60;
  renderer.setPixelRatio(resolution);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(46, 1, .1, 530);
  const art = loadArt(renderer.capabilities.getMaxAnisotropy());
  scene.environment = art.reflections;
  scene.environmentIntensity = .37;
  const ambience = new T.HemisphereLight(0xfff5df, 0x57999a, 1.66);
  const sun = new T.DirectionalLight(0xffe1b7, 2.77);
  const rim = new T.DirectionalLight(0xb5ecff, .97);
  sun.castShadow = true;
  const shadowDimensions = touchDisplay ? 1024 : 1536;
  sun.shadow.mapSize.set(shadowDimensions,shadowDimensions);
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 47;
  sun.shadow.normalBias = .031;
  sun.shadow.bias = -.00018;
  sun.shadow.camera.updateProjectionMatrix();
  rim.position.set(8,7,-10);
  scene.add(ambience,sun,sun.target,rim);
  const atmosphere = createAtmosphere(scene,art);
  const food = makeFoodLibrary(art);
  const themedFood = new Map();
  let currentFood;
  const chef = makeChef();
  chef.root.scale.setScalar(1.72);
  scene.add(chef.root);
  const player = new T.Group();
  player.name = 'Sandwich';
  const bottom = food.toast.clone(true), cap = food.toast.clone(true), stackGroup = new T.Group();
  const shadeTower = new T.Mesh(
    new T.CylinderGeometry(.85,.87,1,16),
    new T.MeshBasicMaterial({ colorWrite:false, depthWrite:false }),
  );
  shadeTower.castShadow = true;
  player.add(bottom, stackGroup, cap, shadeTower);
  scene.add(player);

  const shadowCanvas = Object.assign(document.createElement('canvas'), { width:64, height:64 });
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32,32,1,32,32,31);
  gradient.addColorStop(0,'#6a4426aa');
  gradient.addColorStop(.51,'#7252336f');
  gradient.addColorStop(1,'#7b562800');
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,64,64);
  const shadowTexture = new T.CanvasTexture(shadowCanvas);
  const shadowGeo = new T.PlaneGeometry(1,1);
  const shadowMat = new T.MeshBasicMaterial({ transparent:true, depthWrite:false, map:shadowTexture, opacity:.43, polygonOffset:true, polygonOffsetFactor:-2 });
  function shadow() {
    const disc = new T.Mesh(shadowGeo,shadowMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = .017;
    return disc;
  }
  const playerShadow = shadow();
  playerShadow.scale.set(3.05,2.90,1);
  scene.add(playerShadow);

  const glowCanvas = Object.assign(document.createElement('canvas'), { width:64, height:64 });
  const glowDraw = glowCanvas.getContext('2d');
  const glow = glowDraw.createRadialGradient(32,32,0,32,32,32);
  glow.addColorStop(0,'#fff2b07a');
  glow.addColorStop(.33,'#ffcb5590');
  glow.addColorStop(.57,'#fcad3425');
  glow.addColorStop(1,'#ffb12900');
  glowDraw.fillStyle = glow;
  glowDraw.fillRect(0,0,64,64);
  const glowMap = new T.CanvasTexture(glowCanvas);
  glowMap.colorSpace = T.SRGBColorSpace;
  const starGlow = new T.SpriteMaterial({
    map:glowMap, opacity:.73, blending:T.AdditiveBlending, depthWrite:false, transparent:true,
  });
  const rushLight = new T.Sprite(starGlow);
  rushLight.visible = false;
  scene.add(rushLight);
  const markerGeo = new T.RingGeometry(.57,.68,26);
  markerGeo.rotateX(-Math.PI/2);
  const rushMat = new T.MeshBasicMaterial({ color:0xffd452, transparent:true, opacity:.70, side:T.DoubleSide, depthWrite:false });
  const rushHalo = new T.Mesh(new T.RingGeometry(.93,1,48),rushMat);
  rushHalo.rotation.x = -Math.PI/2;
  rushHalo.visible = false;
  scene.add(rushHalo);
  const flyingFood = new T.Group();
  scene.add(flyingFood);
  const warningMat = new T.MeshBasicMaterial({ color:0xe9504d, transparent:true, opacity:.69, side:T.DoubleSide, depthWrite:false });
  const airMat = new T.MeshBasicMaterial({color:0x7df6e4,transparent:true,opacity:.86,side:T.DoubleSide,depthWrite:false});
  const flipHalo = new T.Mesh(markerGeo,airMat);
  flipHalo.scale.setScalar(1.65);
  flipHalo.visible = false;
  const itemGroup = new T.Group();
  const cueTextures = new Map();
  let courseCues = [];
  scene.add(itemGroup,flipHalo);

  function cueTexture(kind) {
    if(cueTextures.has(kind)) return cueTextures.get(kind);
    const labels={flip:'FLIP ↑',fresh:'FRESH',hot:'HEAT',sick:'SPOILED',both:'CHAOS'};
    const backdrop=kind==='flip'?'#125e66':kind==='fresh'?'#276341':'#a03537';
    const tile=Object.assign(document.createElement('canvas'),{width:320,height:112});
    const draw=tile.getContext('2d');
    draw.fillStyle='#fff3c9';
    draw.fillRect(5,5,310,102);
    draw.fillStyle=backdrop;
    draw.fillRect(12,12,296,88);
    draw.strokeStyle='#ffffff66';
    draw.strokeRect(18,18,284,76);
    draw.fillStyle='#fff4c9';
    draw.textAlign='center';
    draw.textBaseline='middle';
    draw.font='900 50px system-ui';
    draw.fillText(labels[kind],160,56);
    const texture=new T.CanvasTexture(tile);
    texture.colorSpace=T.SRGBColorSpace;
    cueTextures.set(kind,texture);
    return texture;
  }

  function makeCue(marker) {
    const map=cueTexture(marker.kind);
    const material=new T.SpriteMaterial({map,transparent:true,toneMapped:false,depthWrite:false});
    const sign=new T.Sprite(material);
    const y=pathY(stage,marker.at);
    sign.position.set(pathX(stage,marker.at)+marker.offset,y+(marker.kind==='flip'?.21:.61),-marker.at);
    sign.scale.set(marker.kind==='flip'?1.66:2.06,.68,1);
    itemGroup.add(sign);
    return {sign,at:marker.at};
  }

  const particleLimit = 180;
  const confetti = new T.InstancedMesh(new T.BoxGeometry(.12,.10,.065),new T.MeshStandardMaterial({ color:0xffffff, roughness:.75 }),particleLimit);
  const confettiTransform = new T.Object3D();
  confetti.frustumCulled = false;
  confetti.count = 0;
  scene.add(confetti);
  const reactionCapacity=124;
  const effects=new T.InstancedMesh(
    new T.SphereGeometry(1,12,8),new T.MeshStandardMaterial({color:0xffffff,roughness:.45}),reactionCapacity,
  );
  effects.name='Chef reaction effects';
  effects.frustumCulled=false;
  effects.count=0;
  scene.add(effects);
  const spray=new T.InstancedMesh(
    new T.SphereGeometry(1,16,10),new T.MeshStandardMaterial({color:0x9fc74a,roughness:.36}),6,
  );
  spray.name='Chef splash';
  spray.frustumCulled=false;
  spray.count=0;
  scene.add(spray);
  const spill=new T.Group();
  spill.visible=false;
  const puddleMaterial=new T.MeshStandardMaterial({color:0x8fba42,roughness:.43,depthWrite:false});
  for(const [x,z,sx,sz] of [
    [.01,0,.78,.59],[-.59,.40,.41,.46],[.41,.59,.64,.43],
    [-.26,1.02,.53,.37],[-.89,.89,.17,.22],[.83,.97,.19,.28],[.03,1.52,.28,.15],
  ]) {
    const patch=new T.Mesh(spray.geometry,puddleMaterial);
    patch.position.set(x,.005,z);
    patch.scale.set(sx,.033,sz);
    spill.add(patch);
  }
  scene.add(spill);
  const healthySkin=chef.skin.color.clone(), healthyBlush=chef.cheeks.color.clone();
  const spicySkin=new T.Color(0xf95d4c), spicyBlush=new T.Color(0xfd391e);
  const sickSkin=new T.Color(0xb9bf67), sickBlush=new T.Color(0x91a049);

  const audio = makeAudio();
  let digestion, digestionOutcome;
  const digestionHud=$('digestionHud');
  let muted = load('mute','false') === 'true';
  let best = Math.max(0,Number(load('best',0)) || 0);
  let bestStack = Math.max(0,Number(load('stack',0)) || 0);
  let seed, stage, course, items = [], fills = [], layerNodes = [];
  const pressed = new Set();
  let distance = 0, x = 0, offset = 0, steerGoal = 0, steerVelocity = 0, speedLean = 0;
  let bank = 0, score = 0, tall = .76, stackHeight = 0;
  let depth = 1, upgrades = {}, pendingUpgrade = '', offers = [];
  let flipStart = -Infinity, flipRequest = -Infinity, lastFlipStatus;
  let stats = {}, orderNodes = [], orderReady = false, dareReady = false;
  let records = {};
  try {
    const stored=JSON.parse(load('course-medals','{}'));
    if(stored && typeof stored==='object' && !Array.isArray(stored)) records=stored;
  } catch { /* Invalid local records can be replaced by the next result. */ }
  let streak = 0, longestChain = 0, lastFill = -Infinity, rushTime = 0, nextTrail = 0;
  let mode = 'menu', pauseFrom = 'running', modal = null, focusBefore;
  let countTime = 0, eatTime = 0, time = 0, playClock = 0, previous = 0, countdownValue = 0;
  let particles = [], flights = [], toastTime = 0, bump = 0, bumpAge = 0, compact = false;
  let recipe = sandwichReaction([]), bursts = [], nextBurst = 0;
  let pointer = null;
  let width = 0, height = 0, renderedProgress = -1;

  audio.mute(muted);
  updateMute();
  gameUI.best.textContent = numberText.format(best);

  function modeSet(next) {
    mode = next;
    game.dataset.mode = mode;
    const inside=mode==='digestion' || mode==='paused' && pauseFrom==='digestion';
    game.classList.toggle('digestion-active',inside);
    digestionHud.hidden=mode!=='digestion';
    if(mode!=='digestion') digestion?.cancelSwipe();
    $('intro').inert = next !== 'menu';
    $('pauseButton').disabled = !['running','countdown','feeding'].includes(next);
    gameUI.flip.hidden = next !== 'running' && next !== 'countdown';
    if(next==='paused') flipRequest=-Infinity;
    if (next !== 'countdown') gameUI.countdown.hidden = true;
    if (next !== 'running' && next !== 'countdown') releaseSteering();
  }

  function updateMute() {
    gameUI.sound.setAttribute('aria-pressed',String(muted));
    gameUI.sound.setAttribute('aria-label',muted ? 'Unmute audio' : 'Mute audio');
  }

  function releaseSteering() {
    pressed.clear();
    pointer = null;
    steerGoal = offset;
    steerVelocity = 0;
  }

  function clampOffset(value,at=distance) {
    const limit=steeringLimit(stage,at);
    return T.MathUtils.clamp(value,-limit,limit);
  }

  function updateSeasoning(node,value,limit){
    node.parentElement.hidden=!value;
    node.parentElement.classList.toggle('full',value>=limit);
    node.textContent=value+'/'+limit;
  }

  function showToast(text, type = '') {
    gameUI.toast.textContent = text;
    gameUI.toast.classList.toggle('hazard',type === 'hazard');
    gameUI.toast.classList.toggle('milestone',type === 'milestone');
    gameUI.toast.classList.add('show');
    toastTime = .82;
  }

  function multiplier() {
    return Math.min(4,1+Math.floor(streak/5)) * (rushTime > 0 ? 2 : 1);
  }

  function updateProgress() {
    const progress = Math.round(T.MathUtils.clamp(distance/stage.length,0,1)*100);
    if (progress === renderedProgress) return;
    renderedProgress = progress;
    gameUI.progress.textContent = progress + '%';
    gameUI.bar.style.width = progress + '%';
  }

  function renderTickets() {
    gameUI.order.innerHTML=stage.order.map(({kind})=>{
      const name=FILLED[kind].name;
      return '<span class="ticket-item" title="'+name+'">'+
        '<canvas class="recipe-icon" data-icon="'+kind+'" width="72" height="72" aria-hidden="true" hidden></canvas>'+
        '<span class="recipe-name" data-icon-fallback>'+name+'</span><b></b></span>';
    }).join('');
    orderNodes=Array.from(gameUI.order.querySelectorAll('.ticket-item'));
    gameUI.dare.textContent=DARES[stage.dare];
    gameUI.dare.title=stage.dare==='both'?'Fill both chef meters':stage.dare==='hot'?'Fill the heat meter':'Fill the stink meter';
    void paintIcons(gameUI.order);
  }

  function updateTickets() {
    const progress=orderProgress(stage.order,fills);
    orderReady=progress.every(({have,count})=>have>=count);
    dareReady=dareProgress(stage.dare,recipe);
    progress.forEach(({kind,have,count},i)=>{
      const node=orderNodes[i];
      if(!node) return;
      const value=Math.min(have,count)+'/'+count;
      if(node.lastElementChild.textContent!==value) {
        node.lastElementChild.textContent=value;
        node.setAttribute('aria-label',value+' '+FILLED[kind].name);
      }
      node.classList.toggle('complete',have>=count);
    });
    gameUI.order.closest('.house-ticket')?.classList.toggle('complete',orderReady);
    gameUI.dare.classList.toggle('complete',dareReady);
  }

  function updateHud() {
    const rush = rushTime > 0;
    const points = multiplier();
    gameUI.score.textContent = numberText.format(bank+score);
    gameUI.fill.textContent = fills.length;
    gameUI.label.textContent = fills.length === 1 ? 'filling' : 'fillings';
    gameUI.combo.hidden = points < 2;
    gameUI.combo.textContent = '×' + points;
    gameUI.fill.parentElement.classList.toggle('chain',points >= 2 && !rush);
    gameUI.fill.parentElement.classList.toggle('rush',rush);
    game.classList.toggle('rush-active',rush);
    gameUI.rushBanner.hidden = !rush || mode === 'feeding' || mode === 'result';
    recipe=sandwichReaction(fills);
    updateSeasoning(gameUI.heat,recipe.heat,HEAT_LIMIT);
    updateSeasoning(gameUI.funk,recipe.funk,FUNK_LIMIT);
    updateTickets();
    updateProgress();
  }

  function pickupTemplate(kind) {
    if(kind==='pin' && currentFood)return currentFood.obstacle;
    return currentFood?.pickups[kind]??food.pickup[kind];
  }

  function disposeInstances(node) {
    node.traverse(part=>{if(part.isInstancedMesh)part.dispose();});
  }

  function addLayer(kind) {
    const layer = (currentFood?.layers[kind]??food.layers[kind]).clone(true);
    stackGroup.add(layer);
    layerNodes.push(layer);
    fills.push(kind);
    stackHeight += FILLED[kind].height;
  }

  function removeLayers(count) {
    for(let i = 0; i < count; i++) {
      stackHeight -= FILLED[fills.pop()].height;
      const node=layerNodes.pop();
      disposeInstances(node);
      stackGroup.remove(node);
    }
  }

  function resetStack(kinds) {
    disposeInstances(stackGroup);
    stackGroup.clear();
    fills = [];
    layerNodes = [];
    stackHeight = 0;
    for (const kind of kinds) addLayer(kind);
    updateStacks();
  }

  function updateStacks() {
    const squash = Math.min(1,3.7/Math.max(.01,stackHeight));
    const spring = reducedMotion ? 0 : bump * Math.exp(-bumpAge*9) * Math.cos(bumpAge*21);
    let cursor = .386;
    layerNodes.forEach((layer,i)=>{
      const fraction = i / Math.max(1,layerNodes.length-1);
      const flex = reducedMotion ? 0 : fraction ** 1.8 * Math.sin(playClock*8-i*.31) * (.037+Math.abs(speedLean)*.27);
      layer.position.set(Math.sin(i*3.87)*.035+flex,cursor,0);
      layer.rotation.y = Math.sin(i*2.54)*.11;
      layer.rotation.z = flex*.11;
      layer.scale.y = squash;
      cursor += FILLED[fills[i]].height * squash;
    });
    tall = cursor + .43;
    cap.position.set((reducedMotion ? 0 : speedLean*.43),cursor-.018+spring*.24,0);
    cap.rotation.z = spring*.072;
    shadeTower.visible = stackHeight > .36;
    shadeTower.position.y = cursor*.54;
    shadeTower.scale.y = Math.max(.01,cursor-.28);
  }

  function buildStage(number,preview) {
    stage = makeStage(seed,number,depth);
    const {theme}=stage;
    if(theme.foods && !themedFood.has(theme.world))themedFood.set(theme.world,makeFeatureFood(theme));
    currentFood=themedFood.get(theme.world);
    gameUI.heatIcon.dataset.icon=theme.hot??'chili';
    gameUI.funkIcon.dataset.icon=theme.spoiled??'funk';
    void paintIcons($('seasonings'));
    audio.theme(theme.world);
    course?.dispose();
    for(const {sign} of courseCues) sign.material.dispose();
    disposeInstances(itemGroup);
    itemGroup.clear();
    courseCues=preview?[]:stage.markers.map(makeCue);
    course = makeCourse(stage,preview,art);
    scene.add(course.root);
    atmosphere.tint(stage.theme);
    const world=theme.world, night=['harbor','wizard','home','future'].includes(world);
    sun.color.set(theme.light??(world==='peak'?'#ffc48f':night?'#c3b5fc':'#ffebc9'));
    sun.intensity=night?1.48:2.77;
    ambience.color.set(theme.fill??(night?'#aab5ec':'#fff5df'));
    ambience.groundColor.set(night?'#45577c':'#57999a');
    ambience.intensity=night?1.38:1.66;
    rim.color.set(world==='peak'?'#ffaba7':world==='cloud'?'#e2c9ff':'#b5ecff');
    scene.environmentIntensity=night?.26:.37;
    game.style.setProperty('--course-accent',stage.theme.accent);
    chef.root.position.set(pathX(stage,course.length),.04,-course.length-3.5);
    chef.mouth.scale.set(1,1,1);
    for(const eye of chef.eyes) eye.scale.y = 1;
    distance = 0;
    x = 0;
    offset = 0;
    releaseSteering();
    streak = longestChain = 0;
    lastFill = -Infinity;
    rushTime = nextTrail = 0;
    flipStart = flipRequest = -Infinity;
    lastFlipStatus = undefined;
    flipHalo.visible = false;
    stats = {air:0,dodges:0,blocks:upgrades.mitts??0};
    digestion?.stop();
    digestionOutcome=null;
    pendingUpgrade = '';
    offers = [];
    if(!preview) renderTickets();
    rushHalo.visible = false;
    rushLight.visible = false;
    speedLean = 0;
    playClock = 0;
    score = 0;
    bump = bumpAge = 0;
    flights = [];
    disposeInstances(flyingFood);
    flyingFood.clear();
    particles = [];
    bursts=[];
    nextBurst=0;
    confetti.count = effects.count = spray.count = 0;
    spill.visible=false;
    game.dataset.reaction='happy';
    player.visible = true;
    playerShadow.visible = true;
    player.scale.setScalar(preview ? 1.21 : 1);
    player.rotation.set(0,0,0);
    gameUI.stage.textContent = String(number).padStart(2,'0');
    gameUI.name.textContent = stage.theme.name;
    gameUI.toast.classList.remove('show');
    toastTime = 0;
    const line = preview ? [
      { at:6.3,offset:1.10,kind:'tomato' }, { at:9,offset:.17,kind:'lettuce' },
      { at:11.6,offset:-1.42,kind:'patty' }, { at:14.8,offset:-2.22,kind:'egg' },
      { at:17.9,offset:-1.35,kind:'golden' }, { at:20.9,offset:.45,kind:'tomato' },
      { at:24.1,offset:1.88,kind:'lettuce' }, { at:27.3,offset:2.52,kind:'egg' },
      { at:30.0,offset:1.45,kind:'tomato' },
    ] : stage.items;
    items = line.map((item,i)=>{
      const holder = new T.Group();
      const model = pickupTemplate(item.kind).clone(true);
      const itemShadow = shadow();
      holder.position.set(pathX(stage,item.at)+item.offset,pathY(stage,item.at),-item.at);
      const slope=Math.atan2(pathY(stage,item.at+.23)-pathY(stage,item.at-.23),.46);
      itemShadow.rotation.x+=slope;
      itemShadow.scale.set(2.05,1.95,1);
      holder.add(itemShadow,model);
      for (const silhouette of model.children.slice(0, item.kind==='tomato' ? 5 : 1)) {
        if (silhouette.isMesh) silhouette.castShadow = true;
      }
      let glimmer;
      if(item.kind==='golden' || item.air){
        glimmer = new T.Sprite(starGlow);
        glimmer.position.y = .89;
        glimmer.scale.set(2.7,2.7,1);
        holder.add(glimmer);
      }
      if (item.kind === 'pin' || item.kind === 'golden' || item.air) {
        const ring = new T.Mesh(markerGeo,item.air ? airMat : item.kind==='pin' ? warningMat : rushMat);
        ring.rotation.x=slope;
        ring.position.y=.023;
        holder.add(ring);
      }
      itemGroup.add(holder);
      return {...item, holder, model, glimmer, y:model.position.y, phase:i*2.128, used:false};
    });
    resetStack(preview ? ['lettuce','tomato','patty','cheese','lettuce','egg','tomato'] : []);
    updateHud();
  }

  function dropConfetti(px,py,pz,color,count,power = 1,forward = 0) {
    const limit = Math.min(count,particleLimit-particles.length);
    for(let i=0;i<limit;i++) {
      const angle = Math.random()*Math.PI*2;
      const tint = Array.isArray(color) ? color[i%color.length] : color;
      particles.push({
        x:px,y:py,z:pz,vx:Math.sin(angle)*(1+Math.random()*3)*power,
        vy:(1.0+Math.random()*4)*power,vz:Math.cos(angle)*(1+Math.random()*3)*power+forward,
        r:Math.random()*6.3,life:.40+Math.random()*.64,color:new T.Color(tint),
      });
    }
  }

  function tickConfetti(dt) {
    particles = particles.filter(p=>p.life > 0);
    confetti.count = particles.length;
    particles.forEach((p,i)=>{
      p.life-=dt;
      p.x+=dt*p.vx;
      p.y+=dt*p.vy;
      p.z+=dt*p.vz;
      p.vy-=dt*9.4;
      p.r+=dt*8.2;
      confettiTransform.position.set(p.x,p.y,p.z);
      confettiTransform.rotation.set(p.r*.67,p.r,p.r*.83);
      confettiTransform.scale.setScalar(Math.min(1,p.life*4));
      confettiTransform.updateMatrix();
      confetti.setMatrixAt(i,confettiTransform.matrix);
      confetti.setColorAt(i,p.color);
    });
    confetti.instanceMatrix.needsUpdate=true;
    if(confetti.instanceColor) confetti.instanceColor.needsUpdate=true;
  }

  function launchFood(item) {
    if (reducedMotion) return;
    const node = pickupTemplate(item.kind).clone(true);
    const start = item.holder.position.clone();
    start.y += item.model.position.y+.12;
    node.position.copy(start);
    flyingFood.add(node);
    flights.push({ node,start,age:0,color:FILLED[item.kind].color });
  }

  function tickFlights(dt) {
    for (let i=flights.length-1; i>=0; i--) {
      const flight = flights[i];
      flight.age += dt;
      const t = Math.min(1,flight.age/.23);
      const smooth = t*t*(3-2*t);
      point.set(cap.position.x,cap.position.y+.23,.05);
      player.localToWorld(point);
      flight.node.position.lerpVectors(flight.start,point,smooth);
      flight.node.position.y += Math.sin(t*Math.PI)*.52;
      flight.node.rotation.set(t*2.3,t*4.7,t*.7);
      flight.node.scale.setScalar(1-t*.84);
      if(t<1) continue;
      dropConfetti(point.x,point.y,point.z,flight.color,8,.62,2.3);
      disposeInstances(flight.node);
      flyingFood.remove(flight.node);
      flights.splice(i,1);
    }
  }

  function rushDuration() {
    return RUSH_DURATION+(upgrades.glaze??0)*.8;
  }

  function flipHeight(clock=playClock) {
    const t = (clock-flipStart)/FLIP_LENGTH;
    return t>0 && t<1 ? (1.62+(upgrades.spring??0)*.32)*4*t*(1-t) : 0;
  }

  function requestFlip() {
    if(mode==='running' || mode==='countdown') flipRequest=playClock;
  }

  function tickFlip() {
    let ready=playClock-flipStart>=.89-(upgrades.spring??0)*.095;
    if(ready && playClock-flipRequest<=FLIP_BUFFER) {
      flipStart=playClock;
      flipRequest=-Infinity;
      ready=false;
      audio.effect('flip');
      if(!reducedMotion) dropConfetti(x,pathY(stage,distance)+.19,-distance,[0x9bf8e7,0xffd475],13,.59,2.2);
    }
    const takeoff=ready && stage.markers.some(marker=>marker.kind==='flip'
      && Math.abs(marker.at-distance)<stage.speed*.076 && Math.abs(pickupX(marker,distance)-x)<1.23);
    const status=takeoff?'Now!':ready?'Ready':'Recharging';
    if(status!==lastFlipStatus) {
      lastFlipStatus=status;
      gameUI.flip.dataset.ready=String(ready);
      gameUI.flip.dataset.takeoff=String(takeoff);
      gameUI.flipStatus.textContent=status;
    }
  }

  function collect(item,height) {
    item.used = true;
    item.holder.visible = false;
    if(item.air) {
      stats.air++;
      score+=250;
      audio.effect('air');
    }
    if (item.kind === 'pin' && height>=.82) {
      stats.dodges++;
      score+=200;
      audio.effect('air');
      showToast('Clean flip +200','milestone');
      dropConfetti(x,pathY(stage,distance)+height+.6,-distance,[0x85f9e4,0xffd962],14,.76,2.5);
    } else if(item.kind==='pin' && stats.blocks>0) {
      stats.blocks--;
      audio.effect('shield');
      showToast('Oven Mitts blocked it','milestone');
      dropConfetti(x,pathY(stage,distance)+.5,-distance,[0x85f9e4,0xfff4d0],14,.76,2.5);
    } else if (item.kind === 'pin') {
      const lost = Math.min(2,fills.length);
      removeLayers(lost);
      streak = 0;
      lastFill = -Infinity;
      score = Math.max(0,score-75);
      const danger=stage.theme.obstacleName??'Rolling pin';
      showToast(danger+'!'+(lost?' −'+lost+(lost===1?' filling':' fillings'):''),'hazard');
      audio.effect('hit');
      dropConfetti(x,pathY(stage,distance)+Math.min(tall,2.6),-distance,[0xf55e48,0xffbe65,0xffe5aa],20,1.14,2.7);
      bump = -1;
      bumpAge = 0;
    } else if (item.kind === 'golden') {
      rushTime = rushDuration();
      score += 250;
      showToast(item.air?'Air star +500':'Golden star +250','milestone');
      audio.effect('rush');
      dropConfetti(x,pathY(stage,distance)+1,-distance,[0xffd354,0xffef96,0xfeb254],30,1.03,2.5);
    } else if (item.kind === 'coin') {
      score += 150;
      showToast(item.air?'Air coin +400':'Coin +150',item.air?'milestone':'');
      audio.effect('coin');
      dropConfetti(x,pathY(stage,distance)+.92,-distance,0xffd354,12,.80,2);
    } else {
      addLayer(item.kind);
      launchFood(item);
      streak = playClock-lastFill <= CHAIN_WINDOW ? streak+1 : 1;
      lastFill = playClock;
      longestChain = Math.max(longestChain,streak);
      const points = 100*multiplier();
      score += points;
      bump = 1;
      bumpAge = 0;
      const milestone = streak===5 || streak===10 || streak===15;
      audio.effect(milestone ? 'combo' : 'collect',streak);
      const ingredient=FILLED[item.kind];
      const after=sandwichReaction(fills);
      const caption=ingredient.heat
        ? (after.heat===HEAT_LIMIT?'The chef is in for it!':ingredient.name+' · '+after.heat+'/'+HEAT_LIMIT+' heat')
        : ingredient.funk
          ? (after.funk>=FUNK_LIMIT?'That sandwich reeks!':ingredient.name+' · '+after.funk+'/'+FUNK_LIMIT+' stink')
          : milestone ? streak+' in a row!  ×'+multiplier() : ingredient.name+' +'+points;
      showToast(caption,milestone||ingredient.heat||ingredient.funk ? 'milestone' : '');
      dropConfetti(item.holder.position.x,item.holder.position.y+.56,-item.at,ingredient.color,8,.77,2.2);
    }
    const wasReady=orderReady, wasDared=dareReady;
    updateHud();
    if((!wasReady && orderReady) || (!wasDared && dareReady)) {
      audio.effect('ticket');
      showToast(!wasReady && orderReady?'House order filled!':'Chef dare ready!','milestone');
    }
  }

  function cameraPose(snap,dt) {
    let cameraX, cameraY, cameraZ, lookX, lookY, lookZ;
    if(mode === 'menu') {
      const orbit = reducedMotion ? 0 : Math.sin(time*.47)*.25;
      cameraX = compact ? .03 : -1.35 + orbit;
      cameraY = compact ? 4.50 : 5.20;
      cameraZ = compact ? 12.50 : 11.40;
      lookX = compact ? .06 : -5.90;
      lookY = compact ? -1.72 : .25;
      lookZ = compact ? -9.50 : -16.0;
    } else {
      const path = pathX(stage,distance);
      const feeding = mode === 'feeding' || mode === 'result' || (mode === 'paused' && pauseFrom === 'feeding');
      const drift = feeding ? T.MathUtils.smoothstep(eatTime,.31,1.40) : 0;
      cameraX = path + offset*(.22-.16*drift) + drift*(compact?.37:2.50);
      const stackRise = Math.max(0,tall-1.7);
      const showHat=feeding && recipe.heat>=HEAT_LIMIT ? T.MathUtils.smoothstep(eatTime,1.20,2.34) : 0;
      const showSpill=feeding && recipe.funk>=FUNK_LIMIT ? T.MathUtils.smoothstep(eatTime,1.43,2.14) : 0;
      cameraY = (compact ? 5.40 : 5.35) + stackRise*.61 + drift*2.15 + pathY(stage,distance)+showHat*.81;
      cameraZ = -Math.min(stage.length,distance) + (compact ? 11.25 : 10.90) + stackRise*.37 + drift*(compact?3.8:3.5) + Math.max(showHat*6.2,showSpill*3.9);
      lookX = pathX(stage,distance+11) + offset*.10;
      lookY = .54 - stackRise*.17 + drift*5.92 + pathY(stage,distance+8)+showHat*2.14;
      lookZ = -distance - 11 + drift*6.5;
    }
    const fov = compact ? 54 : 46;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    idealCam.set(cameraX,cameraY,cameraZ);
    idealLook.set(lookX,lookY,lookZ);
    const ease = snap ? 1 : 1 - Math.exp(-dt*5.75);
    camera.position.lerp(idealCam,ease);
    smoothedLook.lerp(idealLook,ease);
    camera.lookAt(smoothedLook);
  }

  function steer(dt) {
    if(!dt) return;
    const direction = Number(pressed.has('arrowright') || pressed.has('d'))
      - Number(pressed.has('arrowleft') || pressed.has('a'));
    if (!pointer && direction) {
      steerVelocity = T.MathUtils.lerp(steerVelocity,direction*STEER_SPEED,1-Math.exp(-dt*24));
      offset = clampOffset(offset+steerVelocity*dt);
      steerGoal = offset;
    } else if (Math.abs(steerGoal-offset) > .002 || pointer) {
      const before = offset;
      offset = T.MathUtils.lerp(before,steerGoal,1-Math.exp(-dt*29));
      steerVelocity = (offset-before)/dt;
    } else {
      steerVelocity *= Math.exp(-dt*27);
      offset = clampOffset(offset+steerVelocity*dt);
      steerGoal = offset;
    }
    offset=clampOffset(offset);
    steerGoal=clampOffset(steerGoal);
    x = pathX(stage,distance)+offset;
  }

  function aimPlayer(dt) {
    if (mode === 'menu') {
      const hover = reducedMotion ? 0 : Math.sin(time*2.35)*.06;
      player.position.set(compact?.04:1.08,.063+hover,compact?1.24:.90);
      player.rotation.set(.014,(compact?-.21:-.28)+hover*1.42,hover*.3);
      playerShadow.position.set(player.position.x,.017,player.position.z-.10);
    } else if (mode === 'feeding' || mode === 'result') {
      const fly = T.MathUtils.smoothstep(eatTime,.075,1.20);
      const shrink = T.MathUtils.smoothstep(eatTime,.65,1.20);
      point.set(0,-.20,.39);
      chef.mouth.localToWorld(point);
      player.position.set(T.MathUtils.lerp(x,point.x,fly),T.MathUtils.lerp(.035,point.y,fly)+Math.sin(fly*Math.PI)*2.0,T.MathUtils.lerp(-distance,point.z,fly));
      player.rotation.set(-fly*.36,fly*.56,Math.sin(fly*Math.PI)*.22);
      player.scale.setScalar(Math.max(.05,1-shrink*.95));
      player.visible = eatTime < 1.20;
      playerShadow.visible = eatTime < .92;
      playerShadow.position.set(player.position.x,.017,player.position.z);
    } else if (mode !== 'paused') {
      const yaw = Math.atan2(pathX(stage,distance+.25)-pathX(stage,distance-.25),.5);
      const wobble = reducedMotion ? 0 : Math.sin(playClock*15)*.029;
      speedLean = T.MathUtils.lerp(speedLean,T.MathUtils.clamp(-steerVelocity*.019,-.25,.25),1-Math.exp(-dt*13));
      const ground=pathY(stage,distance);
      const pitch=Math.atan2(pathY(stage,distance+.25)-pathY(stage,distance-.25),.50);
      const rise=flipHeight();
      const flight=T.MathUtils.clamp((playClock-flipStart)/FLIP_LENGTH,0,1);
      const spin=reducedMotion?0:Math.PI*2*flight*flight*(3-2*flight);
      player.position.set(x,ground+.034+wobble+rise,-distance);
      player.rotation.set(pitch*.63+wobble*.45,-yaw*.54+speedLean*.33+spin,speedLean+(reducedMotion?0:rise*.11));
      flipHalo.visible=rise>0;
      flipHalo.position.set(x,ground+.04,-distance+.09);
      flipHalo.rotation.x=pitch;
      flipHalo.scale.setScalar(1.6+rise*.32);
      playerShadow.scale.set(3.05-rise*.5,2.90-rise*.5,1);
      playerShadow.position.set(x,ground+.017,-distance+.09);
      playerShadow.rotation.x=-Math.PI/2+pitch;
    }
    if(mode==='menu'||mode==='feeding'||mode==='result') playerShadow.rotation.x=-Math.PI/2;
    updateStacks();
  }

  function hatMoment() {
    return recipe.type==='both'?2.52:2.00;
  }

  function tickChef() {
    const tasting=mode==='feeding'||mode==='result';
    const sick=tasting && recipe.funk>=FUNK_LIMIT;
    const hot=tasting && recipe.heat>=HEAT_LIMIT;
    const near=mode==='menu'?.3:T.MathUtils.smoothstep(distance,stage.length-31,stage.length);
    const biteTime=Math.max(0,eatTime-1.02);
    const bite=tasting ? Math.sin(Math.min(1,biteTime/.73)*Math.PI*3)**2*(1-T.MathUtils.smoothstep(biteTime,.44,.73)) : 0;
    const cheer=tasting && !sick && !hot ? T.MathUtils.smoothstep(eatTime,1.51,1.98) : 0;
    const heat=hot?T.MathUtils.smoothstep(eatTime,1.27,hatMoment())*(1-.44*T.MathUtils.smoothstep(eatTime,hatMoment(),hatMoment()+.70)):0;
    const queasy=sick?T.MathUtils.smoothstep(eatTime,1.24,1.83)*(1-.28*T.MathUtils.smoothstep(eatTime,2.40,3.04)):0;
    const spitting=sick && eatTime>=1.83 && eatTime<2.35;
    const lift=hot?Math.max(0,eatTime-hatMoment()):0;
    const shake=reducedMotion?0:Math.sin(time*33)*heat*.051+Math.sin(time*15)*queasy*.066;
    const jump=tasting && !hot && !sick && !reducedMotion
      ? Math.sin(Math.PI*T.MathUtils.smoothstep(eatTime,1.54,2.25))*Math.min(.78,.34+fills.length*.016):0;
    const breeze=reducedMotion?0:Math.sin(time*2.6)*.055;
    chef.root.position.y=.04+jump+breeze-(spitting?.20:0)+Math.abs(shake)*2.1;
    chef.root.rotation.z=breeze*.49+Math.sin(eatTime*5)*jump*.12+shake;
    chef.skin.color.copy(healthySkin).lerp(sickSkin,queasy*.72).lerp(spicySkin,heat*.80);
    chef.cheeks.color.copy(healthyBlush).lerp(sickBlush,queasy*.85).lerp(spicyBlush,heat*.91);
    chef.toque.position.set(lift*2.48,lift ? 7.2*lift-3.6*lift*lift : jump*.54+bite*.17+heat*.19,-lift*.72);
    chef.toque.rotation.set(lift*1.27,0,jump*-.073+heat*.14-lift*1.94);
    const tight=.22*queasy+.23*heat;
    chef.mouth.scale.set(1+cheer*.18-tight+(spitting?.33:0),spitting?.93:Math.max(.13,.87+breeze+near*.25-bite*.72-cheer*.43-tight),1);
    const blink=Math.max(0,1-Math.abs(((time+1.18)%4.76)-.115)*13);
    for(const [i,eye] of chef.eyes.entries()) {
      const side=i?1:-1;
      eye.scale.y=Math.max(.08,1-blink*.94-cheer*.35-bite*.61-queasy*(i?.65:.21)+heat*.15);
      chef.gazes[i].position.x=T.MathUtils.clamp(offset*.032,-.15,.15)*near-side*queasy*.07;
      chef.gazes[i].position.y=cheer*.14-bite*.04-queasy*.18+heat*.10;
      chef.eyebrows[i].position.y=4.58+near*.12+bite*.18+cheer*.30+side*breeze*.60+heat*.24+side*queasy*.26;
      chef.eyebrows[i].rotation.z=-side*(.16+cheer*.16-.46*heat-.33*queasy);
      chef.hands[i].position.y=.26+near*.58+cheer*1.76+jump*1.22+queasy*.79+heat*1.27;
      chef.hands[i].position.x=side*(2.30+cheer*.28+heat*.29-queasy*.18);
      chef.hands[i].rotation.z=side*(-.14-near*.19-cheer*.31+queasy*.27)+shake*3.8;
      chef.blush[i].scale.set(.51+heat*.19,.40+heat*.096,.28+heat*.16);
    }
    showSpillOnDeck(sick);
    spray.count=spitting?6:0;
    if(spitting){
      chef.mouth.localToWorld(point.set(0,-.24,.40));
      for(let i=0;i<spray.count;i++){
        const reach=i*.64+.23;
        const wave=Math.sin(eatTime*29-i*.77);
        confettiTransform.position.set(point.x+wave*.12,point.y-.10+reach*.215-reach*reach*.13,point.z+reach);
        confettiTransform.scale.set(.43+reach*.031,Math.max(.15,.39-.049*i),.49+.045*i);
        confettiTransform.rotation.set(.2+i*.082,0,0);
        confettiTransform.updateMatrix();
        spray.setMatrixAt(i,confettiTransform.matrix);
      }
      spray.instanceMatrix.needsUpdate=true;
    }
  }

  function showSpillOnDeck(sick) {
    spill.visible=sick && eatTime>1.99;
    if(!spill.visible) return;
    spill.position.set(chef.root.position.x,.081,chef.root.position.z+6.27);
    spill.scale.setScalar(Math.max(.03,T.MathUtils.smoothstep(eatTime,1.99,2.48)));
  }

  function emitReaction(kind,count) {
    const isSick=kind==='sick';
    const colors=isSick?[0xa4d044,0x739b39,0xc7e965]:[0xfff3ca,0xffdf97,0xf86837,0xff7258];
    if(isSick) chef.mouth.localToWorld(point.set(0,-.23,.39));
    else chef.root.localToWorld(point.set(0,5.94,.08));
    for(let i=0;i<count && bursts.length<reactionCapacity;i++){
      const radius=isSick?.075+Math.random()*.16:.14+Math.random()*.40;
      const life=(isSick?.53:.60)+Math.random()*.57;
      bursts.push({
        x:point.x+(Math.random()-.5)*.54,y:point.y,z:point.z,
        vx:(Math.random()-.5)*(isSick?6:11),
        vy:isSick?1.22+Math.random()*3.15:2.4+Math.random()*5.8,
        vz:isSick?4.4+Math.random()*6.1:(Math.random()-.50)*6.6,
        life,radius,loss:isSick?11.6:5.4,color:colors[i%colors.length],
      });
    }
  }

  function tickReactions(dt) {
    bursts=bursts.filter(p=>p.life>0 && p.y>-1.18);
    effects.count=bursts.length;
    bursts.forEach((particle,index)=>{
      particle.life-=dt;
      particle.x+=particle.vx*dt;
      particle.y+=particle.vy*dt;
      particle.z+=particle.vz*dt;
      particle.vy-=dt*particle.loss;
      const radius=particle.radius*Math.min(1,particle.life*5);
      confettiTransform.position.set(particle.x,particle.y,particle.z);
      confettiTransform.scale.set(radius,radius*.94,radius*(particle.loss>7?1.54:1.1));
      confettiTransform.rotation.x=.19;
      confettiTransform.updateMatrix();
      effects.setMatrixAt(index,confettiTransform.matrix);
      effects.setColorAt(index,new T.Color(particle.color));
    });
    effects.instanceMatrix.needsUpdate=true;
    if(effects.instanceColor) effects.instanceColor.needsUpdate=true;
  }

  function tickFeeding(dt) {
    const before=eatTime;
    eatTime+=dt;
    const crossed=(mark)=>before<mark && eatTime>=mark;
    const sick=recipe.funk>=FUNK_LIMIT;
    const hot=recipe.heat>=HEAT_LIMIT;
    if(crossed(1.10)) audio.effect('eat');
    if(sick && crossed(1.46)){
      audio.effect('gag');
      showToast('Uh-oh…','hazard');
    }
    if(sick && crossed(1.83)) {
      audio.effect('splat');
      showToast('BLEURGH!','hazard');
    }
    if(sick && eatTime>=1.83 && eatTime<2.33 && eatTime>=nextBurst) {
      emitReaction('sick',reducedMotion?5:15);
      nextBurst=eatTime+.070;
    }
    if(hot && crossed(hatMoment()-.52)) audio.effect('kettle');
    if(hot && crossed(hatMoment())){
      audio.effect('hat');
      emitReaction('hot',reducedMotion?15:59);
      showToast('TOO HOT!','hazard');
    }
    if(!sick && !hot && crossed(1.76)) {
      audio.effect('clear');
      dropConfetti(chef.root.position.x,2.5,chef.root.position.z+3.45,[0xffce56,0xff8162,0x86d985],Math.min(66,13+fills.length*2),1.28,2.17);
      if(fills.length>=10 && !reducedMotion) {
        for(const side of [-1,1]) dropConfetti(chef.root.position.x+side*3.8,3.35,chef.root.position.z+2.8,[0xffce56,0xff8162,0x86d985,0xa9dcf0],33,1.30,2.1);
      }
    }
    if(eatTime>(recipe.type==='both'?3.48:sick||hot?3.10:2.43)) beginDigestion();
  }

  function beginDigestion() {
    digestion??=makeDigestion(digestionHud,canvas,audio,finishDigestion,reducedMotion);
    digestion.start(stage.seed,fills);
    digestion.resize();
    gameUI.toast.classList.remove('show');
    toastTime=0;
    modeSet('digestion');
    audio.effect('digestStep',0);
    canvas.focus({preventScroll:true});
  }

  function finishDigestion(outcome) {
    if(mode!=='digestion' && !(mode==='paused' && pauseFrom==='digestion')) return;
    closeModal(false);
    digestionOutcome=outcome;
    result();
  }

  function tickItems(animate) {
    const clock = mode === 'menu' ? time : playClock;
    for(const {sign,at} of courseCues) sign.visible=at>distance-1.15 && at<distance+27;
    for (const item of items) {
      if(item.used) continue;
      item.holder.visible = item.at > distance-13 && item.at < distance+57;
      if(!item.holder.visible) continue;
      if(item.kind==='pin') {
        item.holder.position.x=pickupX(item,distance);
        if(animate && !reducedMotion) {
          const kind=stage.theme.obstacle;
          if(kind==='paint'){
            item.model.rotation.z=Math.sin((distance-item.at)*.29)*.64;
            item.model.position.y=.17+.21*Math.abs(item.model.rotation.z);
          } else if(kind==='spell'||kind==='flux') {
            item.model.rotation.set(.35*Math.sin(clock*3+item.phase),clock*4,.27);
            item.model.position.y=.23+Math.sin(clock*6+item.phase)*.11;
          } else if(kind==='spatula') {
            item.model.rotation.y=clock*3.9;
            item.model.rotation.z=.11*Math.sin(clock*12);
          } else {
            item.model.rotation.x=clock*6.6;
          }
        }
        continue;
      }
      if(!animate) continue;
      const special = item.kind === 'coin' || item.kind === 'golden';
      const beat = Math.sin(clock*5-item.at*.29);
      item.model.position.y = item.y + (item.air?1.49:.13) + (reducedMotion ? 0 : (special?.19:.14)*beat);
      item.model.rotation.y = reducedMotion ? item.phase : clock*(special ? 3.2 : 1.27)+item.phase;
      item.model.rotation.z = reducedMotion ? 0 : beat*(item.kind==='chili'?.28:.12);
      item.model.scale.setScalar(item.kind==='golden' && !reducedMotion ? 1.13+beat*.16 : 1);
      if(item.glimmer){
        item.glimmer.position.y=item.model.position.y+.75;
        item.glimmer.scale.setScalar(2.65 + (reducedMotion ? 0 : beat*.44));
      }
    }
  }

  function startRound(number) {
    audio.open();
    void prepareIcons();
    closeModal();
    buildStage(number,false);
    eatTime = 0;
    countTime = reducedMotion ? 1.65 : 2.25;
    lastFlipStatus='Ready';
    gameUI.flip.dataset.ready='true';
    gameUI.flip.dataset.takeoff='false';
    gameUI.flipStatus.textContent='Ready';
    countdownValue = null;
    modeSet('countdown');
    gameUI.countdown.hidden = false;
    aimPlayer(0);
    tickChef();
    cameraPose(true,0);
    canvas.setAttribute('tabindex','-1');
    canvas.focus({preventScroll:true});
  }

  function newRun(number=1) {
    seed = freshSeed();
    bank = 0;
    depth = 1;
    upgrades = {};
    startRound(number);
  }

  function mainMenu() {
    closeModal(false);
    seed = 0xa87e717;
    bank = 0;
    depth = 1;
    upgrades = {};
    modeSet('menu');
    buildStage(1,true);
    cameraPose(true,0);
    $('start').focus({preventScroll:true});
  }

  function pickupX(item,at) {
    return pathX(stage,item.at)+clampOffset(itemOffset(item,at),item.at);
  }

  function sweepHit(item, before, beforeX) {
    const ingredient=FILLED[item.kind];
    const fresh=ingredient && !ingredient.heat && !ingredient.funk;
    const reach=fresh?(upgrades.tongs??0)*.16:0;
    const radius=(item.kind==='pin'?1.15:item.air?1:rushTime>0 && fresh?RUSH_RADIUS:1.16)+reach;
    const depth=1.05;
    const itemBefore=pickupX(item,before);
    const itemNow=item.swing?pickupX(item,distance):itemBefore;
    const dx=(x-beforeX-itemNow+itemBefore)/radius, dz=(distance-before)/depth;
    const ix=(itemBefore-beforeX)/radius, iz=(item.at-before)/depth;
    const sweep=dx*dx+dz*dz;
    const t=sweep?T.MathUtils.clamp((ix*dx+iz*dz)/sweep,0,1):0;
    return (ix-dx*t)**2+(iz-dz*t)**2<1 ? t : null;
  }

  function stepRace(dt) {
    const before = distance;
    const beforeX = x;
    distance = Math.min(stage.length,distance+stage.speed*dt);
    playClock += dt;
    tickFlip();
    steer(dt);
    bumpAge += dt;
    if (rushTime>0) {
      rushTime = Math.max(0,rushTime-dt);
      gameUI.rushFill.style.transform = 'scaleX('+rushTime/rushDuration()+')';
      if (!rushTime) updateHud();
    }
    if (streak && playClock-lastFill>CHAIN_WINDOW) {
      streak = 0;
      updateHud();
    }
    for(const item of items) {
      if(item.at>distance+1.05) break;
      if(item.used || item.at<before-1.05) continue;
      const hit=sweepHit(item,before,beforeX);
      if(hit===null) continue;
      const height=flipHeight(playClock-dt*(1-hit));
      if(item.air && height<1.02) continue;
      collect(item,height);
    }
    aimPlayer(dt);
    rushLight.visible = rushHalo.visible = rushTime>0;
    if (rushHalo.visible) {
      rushHalo.position.set(x,pathY(stage,distance)+.049,-distance);
      rushHalo.rotation.x=playerShadow.rotation.x;
      const pulse = reducedMotion ? 0 : Math.sin(playClock*14)*.14;
      rushHalo.scale.setScalar(1.27+pulse);
      rushLight.position.set(x,pathY(stage,distance)+.6,-distance-.35);
      rushLight.scale.set(2.8+pulse,2.1+pulse,1);
    }
    if (!reducedMotion && playClock>=nextTrail) {
      dropConfetti(x,pathY(stage,distance)+.13,-distance+.67,rushTime>0 ? 0xffd354 : 0xefb772,rushTime>0 ? 5 : 2,.29,2.7);
      nextTrail = playClock + (rushTime>0 ? .07 : .15);
    }
    updateProgress();
    if (distance >= stage.length) {
      eatTime = 0;
      rushTime = streak = 0;
      rushLight.visible = rushHalo.visible = flipHalo.visible = false;
      playerShadow.scale.set(3.05,2.9,1);
      modeSet('feeding');
      updateHud();
      game.dataset.reaction=recipe.type;
    }
  }

  function showModal(type,title,body) {
    if (!modal) focusBefore = document.activeElement;
    modal = type;
    dialog.classList.toggle('course-dialog',type==='courses');
    dialog.classList.toggle('result-dialog',type==='result');
    dialog.innerHTML = '<h2 class="dialog-title" id="dialogTitle">' + title + '</h2>' + body;
    void paintIcons(dialog);
    overlay.hidden = false;
    dialog.querySelector('button')?.focus({preventScroll:true});
  }

  function closeModal(restoreFocus = true) {
    if(!modal) return;
    modal = null;
    overlay.hidden = true;
    dialog.replaceChildren();
    if(restoreFocus && focusBefore instanceof HTMLElement && focusBefore.isConnected) focusBefore.focus({preventScroll:true});
    focusBefore = null;
  }

  function result() {
    modeSet('result');
    const performance=serviceScore(stage,fills,stats);
    score += performance.serving+performance.ticket+performance.dare+(digestionOutcome?.points??0);
    const world=stage.theme.world;
    const past=records[world]??{};
    const newMedal=performance.medal>(past.medal??0);
    records[world]={medal:Math.max(performance.medal,past.medal??0),score:Math.max(score,past.score??0)};
    save('course-medals',JSON.stringify(records));
    offers=upgradeOffers(stage.seed,upgrades);
    updateHud();
    if(bank+score>best) {
      best = bank+score;
      save('best',best);
      gameUI.best.textContent = numberText.format(best);
    }
    const record = fills.length>bestStack;
    if(record) {
      bestStack = fills.length;
      save('stack',bestStack);
    }
    const recipeIcons = Object.entries(FILLED).map(([kind,data])=>{
      const count = fills.filter(fill=>fill===kind).length;
      if (!count) return '';
      return '<span class="recipe-chip" title="' + data.name + '">' +
        '<canvas class="recipe-icon" data-icon="' + kind + '" width="72" height="72" aria-hidden="true" hidden></canvas>' +
        '<span class="recipe-name" data-icon-fallback aria-hidden="true">' + data.name + '</span>' +
        '<b aria-label="' + count + ' ' + data.name + '">' + count + '</b></span>';
    }).join('');
    const tasty=fills.length>=29?'Tower of Toast!':fills.length>=11?'Order up!':fills.length?'Snack served!':'Just toast!';
    const titles={happy:tasty,hot:'Blown his top!',sick:'Chef’s lost his lunch!',both:'Kitchen catastrophe!'};
    const hotFood=stage.theme.foods?' spicy fillings':' chillies';
    const counts={happy:'',hot:recipe.heat+hotFood+' sent the chef’s hat flying. ',
      sick:'The spoiled fillings made the chef throw up. ',both:'The chef threw up, then blew his top. '};
    const next = THEMES[stage.number%THEMES.length].name;
    const detail=counts[recipe.type]+(record?'New stack record! ':'')+'Next stop, '+next+'.';
    const medalName=MEDALS[performance.medal];
    const medalLine=medalName
      ? '<div class="medal-line">'+artIcon('medal-'+medalName.toLowerCase(),34,['','🥉','🥈','🥇'][performance.medal])+
        '<strong>'+medalName+(newMedal?' · Course record':'')+'</strong><span>'+stats.dodges+' clean flips</span></div>'
      : '<div class="medal-line"><strong>'+performance.target[0]+' fillings for bronze</strong><span>'+stats.dodges+' clean flips</span></div>';
    const plus=(value)=>'+'+numberText.format(value);
    const bonusLine=[
      performance.serving?plus(performance.serving)+' serving':'',
      performance.ticket?plus(performance.ticket)+' house order':'',
      performance.dare?plus(performance.dare)+' chef dare':'',
      digestionOutcome?.points?plus(digestionOutcome.points)+' digestion':'',
    ].filter(Boolean).join(' · ');
    const digestionLine=digestionOutcome?.cleared ?
      '<div class="digest-result"><span aria-hidden="true">✦</span><strong>'+numberText.format(digestionOutcome.units)+'</strong> morsels digested'+
      (digestionOutcome.chain>1?' <span class="digest-perfect">'+digestionOutcome.chain+'-gate chain</span>':'')+
      (digestionOutcome.perfect?' <span class="digest-perfect">Perfect digestion</span>':'')+'</div>' : '';
    const offerMarkup=offers.length?'<div class="upgrade-deck"><h3>Pick an upgrade for this run <small>Optional</small></h3><div>'+
      offers.map(({id,icon,name,detail})=>'<button class="upgrade-option" data-do="upgrade" data-upgrade="'+id+'" aria-pressed="false">'+artIcon(icon,36,'✦')+
        '<span><strong>'+name+'</strong><small>'+detail+'</small></span></button>').join('')+'</div></div>':'';
    const medalHint=performance.medal===3?'':performance.medal===2
      ? performance.target[2]+' fillings and a ticket, dare or 2 air prizes for gold'
      : performance.medal===1?performance.target[1]+' fillings for silver':'';
    showModal('result',titles[recipe.type],'<p>'+detail+'</p>'+medalLine+
      '<div class="stage-stats"><div><strong>' + fills.length + '</strong><span>Fillings stacked</span></div><div><strong>' + longestChain +
      '</strong><span>Longest streak</span></div><div><strong>' + numberText.format(score) + '</strong><span>Stage score</span></div></div>' +
      (recipeIcons ? '<div class="recipe" aria-label="Sandwich recipe">' + recipeIcons + '</div>' : '') +
      '<div class="result-score">' + (bonusLine ? bonusLine+' · ' : '') + 'Best stack ' + bestStack + '</div>' +
      digestionLine+(medalHint?'<div class="medal-hint">'+medalHint+'</div>':'')+offerMarkup+
      '<div class="result-actions"><button class="action" data-do="next">Next Stage</button>' +
      '<div class="dialog-actions"><button class="text-btn" data-do="restart">Replay stage</button><button class="text-btn" data-do="menu">Main menu</button></div></div>');
  }

  function pause() {
    if(!['countdown','running','feeding','digestion'].includes(mode)) return;
    pauseFrom = mode;
    modeSet('paused');
    const skipping=pauseFrom==='digestion'?'<button class="text-btn" data-do="skip-digestion">Skip bonus</button>':'';
    showModal('pause','Paused','<button class="action" data-do="resume">Resume Run</button><div class="dialog-actions">'+skipping+
      '<button class="text-btn" data-do="restart">Restart stage</button><button class="text-btn" data-do="help">How to play</button><button class="text-btn" data-do="menu">Main menu</button></div>');
  }

  function resume() {
    closeModal(false);
    modeSet(pauseFrom);
    gameUI.countdown.hidden = pauseFrom !== 'countdown';
    canvas.focus({preventScroll:true});
    audio.open();
  }

  function artIcon(kind,size,fallback) {
    return '<span class="ui-icon" style="--icon-size:'+size+'px" aria-hidden="true">'+
      '<canvas data-icon="'+kind+'" width="72" height="72" hidden></canvas>'+
      '<span data-icon-fallback>'+fallback+'</span></span>';
  }

  function chooseCourse() {
    if(mode!=='menu') return;
    const themed=[], originals=[];
    for(const [index,theme] of THEMES.entries()){
      const face=theme.icon?artIcon(theme.icon,43,'◈'):'';
      const record=records[theme.world];
      const medal=MEDALS[record?.medal];
      const badge=medal?'<i class="course-medal" title="'+medal+' · Best '+numberText.format(record.score)+'" aria-label="'+medal+' medal">'+
        artIcon('medal-'+medal.toLowerCase(),30,['','🥉','🥈','🥇'][record.medal])+'</i>':'<i aria-hidden="true">→</i>';
      const card='<button class="course-option'+(theme.foods?' with-icon':'')+'" data-do="course" data-stage="'+(index+1)+'" style="--zone:'+theme.accent+'">'+face+
        '<strong>'+theme.name+'</strong><span>'+theme.course+'</span>'+badge+'</button>';
      (theme.foods?themed:originals).push(card);
    }
    showModal('courses','Choose a course','<h3 class="course-section">Themed courses</h3><div class="course-options">'+themed.join('')+
      '</div><h3 class="course-section">Tidal Diner courses</h3><div class="course-options stock-courses">'+originals.join('')+'</div>'+
      '<div class="dialog-actions"><button class="text-btn" data-do="close">Back</button></div>');
  }

  function help() {
    if (modal === 'result') return;
    if (['countdown','running','feeding','digestion'].includes(mode)) pause();
    const featured=stage.theme.foods;
    const spiceRule=featured?HEAT_LIMIT+' '+FILLED[stage.theme.hot].name.toLowerCase()+' pickups':HEAT_LIMIT+' chillies';
    const funkRule=featured?'Two '+FILLED[stage.theme.spoiled].name.toLowerCase()+' pickups make him throw up.':
      '<b>Three stink points</b> make him throw up. Spoiled fish add two, and mouldy cheese adds one.';
    const obstacle=stage.theme.obstacleName?'Watch for '+stage.theme.obstacleName.toLowerCase()+' hazards. A hit can knock':'Rolling pins knock';
    const helpIcon=(kind,fallback)=>'<span class="help-symbol">'+artIcon(kind,23,fallback)+'</span>';
    showModal('help','How to play',
      '<div class="dialog-controls"><p><span class="help-symbol" aria-hidden="true">↔</span><span>Hold <b>← →</b> or <b>A / D</b>, or drag the sandwich with your finger or mouse.</span></p>' +
      '<p>'+helpIcon('sandwich','🥪')+'<span>Stack as many fillings as you can. Keep collecting to build a scoring streak.</span></p>' +
      '<p>'+helpIcon('flip','↑')+'<span>Press <b>Space</b> or tap <b>Flip</b> at the turquoise signs to clear obstacles and catch airborne prizes.</span></p>' +
      '<p>'+helpIcon('order-ticket','✓')+'<span>Fill the <b>house order</b> or take the chef dare for bonus points. Earn a medal and choose an upgrade at the end of the stage.</span></p>' +
      '<p>'+helpIcon('gold-star','★')+'<span>Grab a gold star for <b>Toast Rush</b>. Nearby fresh fillings fly to you and earn double points.</span></p>' +
      '<p>'+helpIcon(stage.theme.hot??'chili','🌶')+'<span><b>'+spiceRule+'</b> make the chef blow his top.</span></p>' +
      '<p>'+helpIcon(stage.theme.spoiled??'fish','!')+'<span>'+funkRule+'</span></p>' +
      '<p>'+helpIcon('pin','⚠')+'<span>'+obstacle+' off up to two fillings and reset your streak.</span></p>' +
      '<p><span class="help-symbol" aria-hidden="true">✂</span><span>After the chef eats, <b>swipe ropes</b> to drop food and swipe bubbles to flick it sideways. Use 1–4 to cut from top to bottom, Shift to tip left, or Space to pop a bubble.</span></p></div>' +
      '<button class="action" data-do="' + (mode==='paused' ? 'resume' : 'close') + '">' + (mode==='paused' ? 'Resume Run' : 'Got It') + '</button>');
  }

  function resize() {
    const box = game.getBoundingClientRect();
    if (box.width === width && box.height === height) return;
    width = box.width;
    height = box.height;
    compact = width/height < 1.06;
    camera.aspect = canvas.clientWidth/canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
    digestion?.resize();
    aimPlayer(0);
    cameraPose(true,0);
  }

  function tick(elapsed) {
    const frameTime = previous ? (elapsed-previous)*.001 : 0;
    const dt = Math.min(.043,frameTime);
    previous = elapsed;
    if(mode==='running' && frameTime>0 && frameTime<.125) {
      averageFrame += (frameTime-averageFrame)*.045;
      if(++framesAtResolution>=110 && averageFrame>.029 && resolution>.91) {
        resolution = Math.max(.91,resolution*.85);
        renderer.setPixelRatio(resolution);
        framesAtResolution = 0;
      }
    }
    if(mode==='digestion' || mode==='paused' && pauseFrom==='digestion') {
      audio.update(mode);
      digestion.draw(renderer,mode==='digestion'?dt:0);
      return;
    }
    if(mode !== 'paused' && !modal) time += dt;
    if(mode === 'countdown') {
      countTime -= dt;
      steer(dt);
      const count = Math.max(0,Math.ceil(countTime));
      if(count !== countdownValue) {
        countdownValue = count;
        gameUI.countdown.textContent = count || 'GO!';
        audio.effect('start',count);
      }
      if(countTime <= -.23) {
        modeSet('running');
        aimPlayer(dt);
      }
    } else if(mode === 'running') {
      stepRace(dt);
    } else if(mode === 'feeding') {
      tickFeeding(dt);
    }
    if(mode==='digestion') {
      audio.update(mode);
      digestion.draw(renderer,0);
      return;
    }
    if(mode !== 'paused') {
      tickChef();
      if(mode !== 'running') aimPlayer(dt);
      tickFlights(dt);
      tickConfetti(dt);
      tickReactions(dt);
      if(toastTime>0) {
        toastTime -= dt;
        if(toastTime<=0) gameUI.toast.classList.remove('show');
      }
    }
    tickItems(mode !== 'paused' && !modal);
    cameraPose(false,dt);
    atmosphere.tick(reducedMotion?0:time,camera);
    course.tick(reducedMotion?0:time,camera.position.z);
    const lightX = mode === 'menu' ? .65 : pathX(stage,distance);
    const lightZ = mode === 'menu' ? -3 : -distance-2.4;
    const lightY=pathY(stage,distance);
    sun.position.set(lightX-8.4,lightY+15.7,lightZ+7.1);
    sun.target.position.set(lightX,lightY,lightZ);
    audio.update(mode);
    renderer.render(scene,camera);
  }

  $('start').addEventListener('click',()=>newRun());
  $('chooseCourse').addEventListener('click',chooseCourse);
  $('topHelp').addEventListener('click',help);
  $('bottomHelp').addEventListener('click',help);
  $('pauseButton').addEventListener('click',pause);
  $('pauseDigestion').addEventListener('click',pause);
  gameUI.flip.addEventListener('pointerdown',(event)=>{
    if(event.button!==0) return;
    event.preventDefault();
    requestFlip();
  });
  gameUI.flip.addEventListener('click',(event)=>{
    if(event.detail===0) requestFlip();
  });
  gameUI.sound.addEventListener('click',()=>{
    muted = !muted;
    save('mute',muted);
    audio.mute(muted);
    if(!muted) audio.open();
    updateMute();
  });
  dialog.addEventListener('click',(event)=>{
    const selection=event.target.closest('button')?.dataset;
    switch(selection?.do) {
      case 'course': {
        const number=Number(selection.stage);
        if(modal==='courses' && Number.isInteger(number) && number>0 && number<=THEMES.length) newRun(number);
        break;
      }
      case 'resume': resume(); break;
      case 'skip-digestion':
        if(modal==='pause' && pauseFrom==='digestion') finishDigestion(digestion.stop());
        break;
      case 'restart': startRound(stage.number); break;
      case 'menu': mainMenu(); break;
      case 'close': closeModal(); break;
      case 'help': help(); break;
      case 'upgrade': {
        if(modal!=='result' || !offers.some(({id})=>id===selection.upgrade)) break;
        pendingUpgrade=pendingUpgrade===selection.upgrade?'':selection.upgrade;
        dialog.querySelectorAll('.upgrade-option').forEach(button=>{
          button.setAttribute('aria-pressed',String(button.dataset.upgrade===pendingUpgrade));
        });
        if(pendingUpgrade) audio.effect('ticket');
        break;
      }
      case 'next':
        if(modal!=='result') break;
        if(pendingUpgrade && UPGRADES.some(({id,cap})=>id===pendingUpgrade && (upgrades[id]??0)<cap)) {
          upgrades[pendingUpgrade]=(upgrades[pendingUpgrade]??0)+1;
        }
        bank += score;
        depth++;
        startRound(stage.number+1);
        break;
    }
  });
  window.addEventListener('keydown',(event)=>{
    const key = event.key.toLowerCase();
    if(key==='escape') {
      if(mode==='paused' && !event.repeat) resume();
      else if(modal==='help'||modal==='courses') closeModal();
      else pause();
      return;
    }
    if(event.key==='Tab' && modal) {
      const btns = Array.from(dialog.querySelectorAll('button'));
      if(!btns.length) return;
      const index = btns.indexOf(document.activeElement);
      const next = event.shiftKey ? (index<=0?btns.length-1:index-1) : (index+1)%btns.length;
      event.preventDefault();
      btns[next].focus();
      return;
    }
    if(modal) return;
    if((key===' ' || key==='enter') && mode==='menu' && !event.target.closest('button')) {
      event.preventDefault();
      newRun();
      return;
    }
    if(mode==='digestion') {
      const ropeKey=event.code?.match(/^Digit([1-4])$/)?.[1]??key;
      if(!event.repeat && /^[1-4]$/.test(ropeKey)){
        event.preventDefault();
        digestion.keyCut(Number(ropeKey)-1,event.shiftKey?-1:1);
      }
      if(!event.repeat && steeringKeys.has(key)){
        event.preventDefault();
        digestion.keyCut(0,key==='arrowleft'||key==='a'?-1:1);
      }
      if(key===' ' && !event.repeat && !event.target.closest('button')){
        event.preventDefault();
        digestion.keyPop(event.shiftKey?-1:1);
      }
      if(key==='p' && !event.repeat) pause();
      return;
    }
    if(mode !== 'running' && mode !== 'countdown') return;
    if((key===' ' && !event.target.closest('button')) || key==='arrowup') {
      event.preventDefault();
      if(!event.repeat) requestFlip();
    }
    if(steeringKeys.has(key)) {
      event.preventDefault();
      pressed.add(key);
    }
    if(key==='p' && !event.repeat) pause();
  });
  window.addEventListener('keyup',(event)=>pressed.delete(event.key.toLowerCase()));
  window.addEventListener('blur',pause);
  canvas.addEventListener('pointerdown',(event)=>{
    if(mode==='digestion') {
      digestion.pointerStart(event);
      return;
    }
    if ((mode!=='running' && mode!=='countdown') || pointer || event.button!==0) return;
    steerVelocity = 0;
    steerGoal = offset;
    const dragWidth = Math.max(140,Math.min(canvas.clientHeight*.74,canvas.clientWidth*.91));
    pointer = {id:event.pointerId,x:event.clientX,scale:2*steeringLimit(stage,distance)/dragWidth};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',(event)=>{
    if(mode==='digestion') {
      digestion.pointerMove(event);
      return;
    }
    if(pointer?.id!==event.pointerId) return;
    steerGoal = clampOffset(steerGoal+(event.clientX-pointer.x)*pointer.scale);
    pointer.x = event.clientX;
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name,(event)=>{
    if(mode==='digestion') digestion.pointerEnd(event,name==='pointerup');
    if(pointer?.id===event.pointerId) pointer = null;
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden) pause();});
  canvas.addEventListener('webglcontextlost',(event)=>{
    event.preventDefault();
    pause();
    renderer.setAnimationLoop(null);
    const message = $('error');
    message.querySelector('h2').textContent = '3D graphics interrupted';
    message.querySelector('p').textContent = 'Reload the page to reconnect to the graphics renderer.';
    message.hidden = false;
  });
  seed = 0xa87e717;
  buildStage(1,true);
  void paintIcons($('orderTicket'));
  void paintIcons(gameUI.flip);
  resize();
  new ResizeObserver(resize).observe(game);
  renderer.setAnimationLoop(tick);
}
