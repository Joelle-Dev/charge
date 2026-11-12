import { createRouter, createWebHashHistory } from 'vue-router';
import { goToPane } from '../composables/useLedgerPanes';

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
    path: '/diary',
    name: 'diary',
    meta: { transition: 'page-rise' },
    component: () => import('../views/MonthlyReportView.vue')
  },
  {
    path: '/history',
    redirect: '/diary'
  },
  {
    path: '/year',
    redirect: '/diary'
  },
  {
    path: '/batch',
    redirect: () => {
      goToPane('batch');
      return '/';
    }
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
    path: '/chart',
    name: 'chart',
    meta: { transition: 'page-rise' },
    component: () => import('../views/ChartView.vue')
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
