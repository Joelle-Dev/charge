// Category artwork from Lucide (https://lucide.dev),
// licensed under ISC (https://github.com/lucide-icons/lucide/blob/main/LICENSE).
// The lipstick icon is hand-drawn in the same line style.
export const CATEGORY_ICON_ASSET_KEYS = {
  '🍜': 'noodle',
  '☕': 'coffee',
  '🍪': 'cookie',
  '🍰': 'cake',
  '🥤': 'cup',
  '🍚': 'rice',
  '🍔': 'burger',
  '🍕': 'pizza',
  '🍣': 'sushi',
  '🍎': 'apple',
  '🚗': 'car',
  '🚇': 'metro',
  '✈️': 'airplane',
  '🚌': 'bus',
  '🚲': 'bicycle',
  '🛵': 'scooter',
  '⛽': 'fuel',
  '🧳': 'luggage',
  '🏠': 'house',
  '🛍️': 'shopping',
  '🧺': 'basket',
  '🧹': 'broom',
  '🛋️': 'couch',
  '👗': 'dress',
  '👟': 'sneaker',
  '💄': 'lipstick',
  '🐾': 'paw',
  '🎮': 'game',
  '🎬': 'movie',
  '🎵': 'music',
  '🎤': 'microphone',
  '🎲': 'dice',
  '🎨': 'palette',
  '🎯': 'target',
  '🏋️': 'gym',
  '📚': 'books',
  '💊': 'pill',
  '🏥': 'hospital',
  '📱': 'phone',
  '💡': 'bulb',
  '🎁': 'gift',
  '💰': 'money',
  '🧾': 'receipt',
  '🎫': 'ticket',
  '💳': 'card',
  '🔑': 'key',
  '📦': 'package',
  '🔁': 'repeat',
  '🛡️': 'shield',
  '🅿️': 'circle-parking',
  '✂️': 'scissors',
  '🔧': 'wrench',
  '👓': 'glasses',
  '💻': 'laptop',
  '👕': 'shirt',
  '👶': 'baby',
  '🍷': 'wine'
};

function normalizeIconKey(icon) {
  return String(icon ?? '').replace(/\uFE0F/g, '');
}

const NORMALIZED_ASSET_KEYS = Object.fromEntries(
  Object.entries(CATEGORY_ICON_ASSET_KEYS).map(([icon, key]) => [normalizeIconKey(icon), key])
);

export function iconAssetKey(icon) {
  return NORMALIZED_ASSET_KEYS[normalizeIconKey(icon)] || '';
}
