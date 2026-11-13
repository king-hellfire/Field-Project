// Welcome page: fills the picture-theme gallery and counts from the real theme data.
import { IMAGE_THEMES, IMAGE_THEME_VARIANTS } from './libs/image-themes.js';

const FEATURED = ['knight', 'strawhats', 'sakura', 'claudecode', 'yellowpop', 'violet', 'moonhill', 'goldendragon'];

const gallery = document.getElementById('gallery');
if (gallery) {
  const picks = FEATURED.map(id => IMAGE_THEMES.find(t => t.id === id)).filter(Boolean);
  for (const t of picks) {
    const card = document.createElement('div');
    card.className = 'pt';
    card.title = `${t.name}: ${t.description}`;
    const variants = document.createElement('div');
    variants.className = 'pt-variants';
    for (const v of IMAGE_THEME_VARIANTS) {
      const p = t.variants[v.key];
      const cell = document.createElement('div');
      cell.style.background = p.bg;
      cell.title = `${t.name} · ${v.label}`;
      const line1 = document.createElement('i'); line1.style.background = p.heading || p.text;
      const line2 = document.createElement('i'); line2.style.background = p.muted || p.text;
      const button = document.createElement('b'); button.style.background = p.accent;
      cell.append(line1, line2, button);
      variants.appendChild(cell);
    }
    const name = document.createElement('div');
    name.className = 'pt-name';
    name.textContent = t.name;
    const hint = document.createElement('span');
    hint.textContent = 'D · L · B';
    name.appendChild(hint);
    card.append(variants, name);
    gallery.appendChild(card);
  }
}

const count = document.getElementById('statPictures');
if (count) count.textContent = String(IMAGE_THEMES.length);
const variants = document.getElementById('statVariants');
if (variants) variants.textContent = String(IMAGE_THEMES.length * IMAGE_THEME_VARIANTS.length);
