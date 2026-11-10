import { computed, ref } from 'vue';
import { getSetting, setSetting } from '../lib/db';
import {
  DEFAULT_PROFILE,
  normalizeProfile,
  profileDisplayName
} from '../utils/profile';

const PROFILE_KEY = 'profile';

const profile = ref(normalizeProfile(DEFAULT_PROFILE));
const profileLoaded = ref(false);
let loadPromise = null;

async function initProfile(force = false) {
  if (!force && loadPromise) return loadPromise;

  loadPromise = (async () => {
    const stored = await getSetting(PROFILE_KEY, null);
    profile.value = normalizeProfile(stored || DEFAULT_PROFILE);
    profileLoaded.value = true;
    return profile.value;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

async function reloadProfile() {
  return initProfile(true);
}

async function saveProfile(next) {
  const normalized = normalizeProfile(next);
  profile.value = normalized;
  await setSetting(PROFILE_KEY, normalized);
  return normalized;
}

async function resetProfile() {
  return saveProfile(DEFAULT_PROFILE);
}

const profileName = computed(() => profileDisplayName(profile.value));

export function useProfile() {
  return {
    profile,
    profileLoaded,
    profileName,
    initProfile,
    reloadProfile,
    saveProfile,
    resetProfile
  };
}
