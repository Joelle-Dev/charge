import { computed, reactive, ref } from 'vue';

const STORAGE_KEY = 'shoucai:hideAmountScopes';
const GLOBAL_KEY = '__shoucaiPrivacy';
const SCOPES = ['home', 'record', 'search', 'records', 'settings'];

function emptyScopes() {
  return SCOPES.reduce((result, scope) => {
    result[scope] = false;
    return result;
  }, {});
}

function readScopes() {
  const scopes = emptyScopes();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const scope of SCOPES) scopes[scope] = Boolean(stored?.[scope]);
  } catch (err) {
    // localStorage can be unavailable or contain old data.
  }
  scopes.record = false;
  return scopes;
}

function persistScopes(scopes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scopes));
  } catch (err) {
    // localStorage can be unavailable in private modes.
  }
}

function createState() {
  const activeScope = ref('record');
  const scopes = reactive(readScopes());
  const hideAmount = computed(() => (
    activeScope.value === 'record' ? false : Boolean(scopes[activeScope.value])
  ));

  function setActiveScope(scope) {
    if (SCOPES.includes(scope)) activeScope.value = scope;
  }

  function setHideAmount(next, scope = activeScope.value) {
    const target = SCOPES.includes(scope) ? scope : 'record';
    if (target === 'record') return false;
    scopes[target] = Boolean(next);
    persistScopes(scopes);
    return scopes[target];
  }

  function toggleHideAmount(scope = activeScope.value) {
    return setHideAmount(!scopes[SCOPES.includes(scope) ? scope : 'record'], scope);
  }

  return { activeScope, scopes, hideAmount, setActiveScope, setHideAmount, toggleHideAmount };
}

function resolveState() {
  if (typeof window === 'undefined') return createState();
  if (!window[GLOBAL_KEY]) {
    const state = createState();
    window[GLOBAL_KEY] = state;
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readScopes();
      for (const scope of SCOPES) state.scopes[scope] = next[scope];
    });
  }
  return window[GLOBAL_KEY];
}

const state = resolveState();

export const activeScope = state.activeScope;
export const hideAmount = state.hideAmount;
export const scopes = state.scopes;
export const setActiveScope = state.setActiveScope;
export const setHideAmount = state.setHideAmount;
export const toggleHideAmount = state.toggleHideAmount;
