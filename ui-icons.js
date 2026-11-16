import { atlas, columns, kinds, tileSize } from './ui-icon-data.js';

const tiles = new Map(kinds.map((kind, index) => [kind, index]));
let artwork;

async function decodeArtwork() {
  if (typeof createImageBitmap === 'function') {
    try {
      const bytes = Uint8Array.from(atob(atlas), character => character.charCodeAt(0));
      return await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
    } catch {
      // Some web views can decode the image with Image but cannot create a bitmap.
    }
  }

  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = 'data:image/webp;base64,' + atlas;
  });
}

export function prepareIcons() {
  artwork ??= decodeArtwork().catch(() => null);
  return artwork;
}

export function drawIcon(context,image,kind,width,height) {
  const index=tiles.get(kind);
  if(index===undefined) return false;
  context.clearRect(0,0,width,height);
  context.drawImage(image,index%columns*tileSize,Math.floor(index/columns)*tileSize,
    tileSize,tileSize,0,0,width,height);
  return true;
}

export async function paintIcons(container) {
  const canvases = [...container.querySelectorAll('canvas[data-icon]')];
  if (!canvases.length) return;
  const image = await prepareIcons();
  if (!image) return;

  for (const canvas of canvases) {
    if(!canvas.isConnected) continue;
    const context=canvas.getContext('2d');
    if(!context || !drawIcon(context,image,canvas.dataset.icon,canvas.width,canvas.height)) continue;
    canvas.hidden = false;
    const fallback = canvas.nextElementSibling;
    if (fallback?.hasAttribute('data-icon-fallback')) fallback.hidden = true;
  }
}
