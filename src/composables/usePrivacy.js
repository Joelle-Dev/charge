import {
  activeScope,
  hideAmount,
  scopes,
  setActiveScope,
  setHideAmount,
  toggleHideAmount
} from '../lib/privacy.js';

export function usePrivacy() {
  return { activeScope, hideAmount, scopes, setActiveScope, setHideAmount, toggleHideAmount };
}
