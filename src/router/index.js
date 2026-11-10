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
    path: '/batch',
    name: 'batch',
    component: () => import('../views/BatchRecordView.vue')
  },
  {
    path: '/voice',
    redirect: '/batch'
  },
  {
    path: '/voice-test',
    redirect: '/batch'
  },
  {
    path: '/search',
    name: 'search',
    meta: { immersive: true },
    component: () => import('../views/SearchView.vue')
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
  scrollBehavior() {
    return { top: 0 };
  }
});

export default router;
