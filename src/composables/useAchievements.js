import { computed, ref, watch } from 'vue';
import { showToast } from 'vant';
import { getSetting, setSetting } from '../lib/db';
import { useLedger } from './useLedger';
import { buildAchievementStats, getAchievementState } from '../utils/achievements';
import { haptic } from '../utils/haptics';

const unlockedIds = ref([]);
const initialized = ref(false);
let initPromise = null;
let watcherStarted = false;

export function useAchievements() {
  const { expenses, stages } = useLedger();

  const stats = computed(() => buildAchievementStats(expenses.value, stages.value));
  const currentAchievements = computed(() => getAchievementState(stats.value));
  const achievements = computed(() =>
    currentAchievements.value.map((achievement) => ({
      ...achievement,
      unlocked: achievement.unlocked || unlockedIds.value.includes(achievement.id)
    }))
  );
  const unlockedCount = computed(() => achievements.value.filter((item) => item.unlocked).length);

  async function persist(ids) {
    unlockedIds.value = ids;
    await setSetting('achievementUnlocked', ids);
  }

  function startWatcher() {
    if (watcherStarted) return;
    watcherStarted = true;
    watch(currentAchievements, (list) => {
      if (!initialized.value) return;
      const newIds = list
        .filter((item) => item.unlocked && !unlockedIds.value.includes(item.id))
        .map((item) => item.id);
      if (!newIds.length) return;

      const merged = [...new Set([...unlockedIds.value, ...newIds])];
      persist(merged);
      const names = list.filter((item) => newIds.includes(item.id)).map((item) => item.name);
      haptic('success');
      showToast(`解锁：${names.join('、')}`);
    });
  }

  async function initAchievements() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const stored = await getSetting('achievementUnlocked', null);
      if (!Array.isArray(stored)) {
        await persist(currentAchievements.value.filter((item) => item.unlocked).map((item) => item.id));
      } else {
        unlockedIds.value = stored;
        const newIds = currentAchievements.value
          .filter((item) => item.unlocked && !stored.includes(item.id))
          .map((item) => item.id);
        if (newIds.length) {
          await persist([...new Set([...stored, ...newIds])]);
          const names = currentAchievements.value
            .filter((item) => newIds.includes(item.id))
            .map((item) => item.name);
          haptic('success');
          showToast(`解锁：${names.join('、')}`);
        }
      }
      initialized.value = true;
      startWatcher();
    })();
    return initPromise;
  }

  return {
    stats,
    achievements,
    unlockedCount,
    initAchievements
  };
}
