import * as T from './vendor/three.js';

export function artUrl(name) {
  return new URL('art/' + name + '.webp', import.meta.url).href;
}

function texture(name, fallback, { repeat = false, srgb = true, anisotropy = 1 } = {}) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 2, height: 2 });
  const context = canvas.getContext('2d');
  context.fillStyle = fallback;
  context.fillRect(0, 0, 2, 2);
  const map = new T.CanvasTexture(canvas);
  if (srgb) map.colorSpace = T.SRGBColorSpace;
  if (repeat) map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = anisotropy;

  const image = new Image();
  image.onload = () => {
    map.image = image;
    map.needsUpdate = true;
    map.userData.loaded = true;
  };
  image.src = artUrl(name);
  return map;
}

function environment() {
  const width = 128, height = 64;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const altitude = (y + .5) / height;
    const sky = T.MathUtils.smoothstep(altitude,.36,.64);
    const horizon = Math.exp(-((altitude-.5)**2)/.010);
    for (let x = 0; x < width; x++) {
      const angle = (x + .5) / width;
      const panel = Math.exp(-((altitude-.71)**2+(angle-.31)**2)/.003);
      const pixel = (y*width+x)*4;
      data[pixel] = Math.min(255, 29 + sky*103 + horizon*83 + panel*136);
      data[pixel+1] = Math.min(255, 92 + sky*104 + horizon*52 + panel*105);
      data[pixel+2] = Math.min(255, 112 + sky*121 + horizon*36 + panel*67);
      data[pixel+3] = 255;
    }
  }
  const map = new T.DataTexture(data,width,height,T.RGBAFormat);
  map.colorSpace = T.SRGBColorSpace;
  map.mapping = T.EquirectangularReflectionMapping;
  map.minFilter = map.magFilter = T.LinearFilter;
  map.needsUpdate = true;
  return map;
}

export function loadArt(maxAnisotropy) {
  const tiled = { repeat: true, anisotropy: Math.min(8,maxAnisotropy) };
  return {
    wood: texture('boardwalk','#ffe8bf',tiled),
    sand: texture('beach-sand','#f7deb7',tiled),
    rock: texture('coastal-rock','#c0b6a2',tiled),
    palmBark: texture('palm-bark','#b28c6a',tiled),
    palmLeaf: texture('palm-leaf','#91ae6c',{anisotropy:tiled.anisotropy}),
    crumb: texture('bread-crumb','#ffdb95',{anisotropy:tiled.anisotropy}),
    crust: texture('bread-crust','#cf8544',tiled),
    caustic: texture('sea-caustics','#3c838a',{repeat:true,srgb:false,anisotropy:tiled.anisotropy}),
    sky: texture('coastal-sky','#adf0eb'),
    lanternSky: texture('lantern-sky','#6c639a'),
    pepperSky: texture('pepper-sky','#f9a575'),
    wizardSky: texture('wizard-sky','#655781'),
    homeSky: texture('home-sky','#9ab1cb'),
    buckSky: texture('buck-sky','#ffd5a4'),
    liverpoolSky: texture('liverpool-sky','#ac7f9c'),
    jungleSky: texture('jungle-sky','#90b4a0'),
    futureSky: texture('future-sky','#9b82b1'),
    sandwich: texture('sandwich','#e49745',{anisotropy:tiled.anisotropy}),
    reflections: environment(),
  };
}

export function digestionBackdrop(name,fallback) {
  return texture(name,fallback,{anisotropy:2});
}
