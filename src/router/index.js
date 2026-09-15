import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/train',
    name: 'Train',
    component: () => import('../views/TrainView.vue')
  },
  {
    path: '/tools/fretboard',
    name: 'FretboardTool',
    component: () => import('../views/FretboardView.vue')
  },
  {
    path: '/result',
    name: 'Result',
    component: () => import('../views/ResultView.vue')
  },
  {
    path: '/wrongbook',
    name: 'WrongBook',
    component: () => import('../views/WrongBookView.vue')
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('../views/StatsView.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
