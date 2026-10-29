import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'record',
    component: () => import('../views/RecordView.vue')
  },
  {
    path: '/records',
    name: 'records',
    component: () => import('../views/RecordsView.vue')
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/HistoryView.vue')
  },
  {
    path: '/year',
    redirect: '/history'
  },
  {
    path: '/voice',
    name: 'voice',
    meta: { immersive: true },
    component: () => import('../views/VoiceView.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue')
  },
  {
    path: '/setting',
    redirect: '/settings'
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 };
  }
});

export default router;
