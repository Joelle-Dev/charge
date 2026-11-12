import { iconAssetKey } from './categoryIconAssets';

const modules = import.meta.glob('../assets/category-icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default'
});

const sourcesByKey = {};
for (const [path, raw] of Object.entries(modules)) {
  const key = path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '');
  const svg = raw
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/>\s+</g, '><')
    .trim();
  sourcesByKey[key] = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function iconSourceFor(name) {
  const key = iconAssetKey(name);
  return key ? sourcesByKey[key] || '' : '';
}
