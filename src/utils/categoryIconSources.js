import { iconAssetKey } from './categoryIconAssets';

const modules = import.meta.glob('../assets/category-icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
});

const sourcesByKey = {};
for (const [path, url] of Object.entries(modules)) {
  const key = path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '');
  sourcesByKey[key] = url;
}

export function iconSourceFor(name) {
  const key = iconAssetKey(name);
  return key ? sourcesByKey[key] || '' : '';
}
