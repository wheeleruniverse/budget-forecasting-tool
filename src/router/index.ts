import type { RouteRecordRaw } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Ledger',
    component: () => import('@/views/LedgerView.vue'),
    meta: {
      title: 'Ledger | Budget Forecast',
    },
  },
  {
    path: '/manage',
    name: 'Manage',
    component: () => import('@/views/ManageView.vue'),
    meta: {
      title: 'Manage | Budget Forecast',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: {
      title: 'Page Not Found | Budget Forecast',
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.afterEach(to => {
  const title = to.meta.title as string | undefined;
  if (title) document.title = title;
});

export default router;
