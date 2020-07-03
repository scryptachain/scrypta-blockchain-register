import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import(/* webpackChunkName: "home" */ '../views/Home.vue')
  },
  {
    path: '/notarize',
    name: 'Notarize',
    component: () => import(/* webpackChunkName: "notarize" */ '../views/Notarize.vue')
  },
  {
    path: '/scan/:address',
    name: 'Scan',
    component: () => import(/* webpackChunkName: "scan" */ '../views/Scan.vue')
  }
]

const router = new VueRouter({
  routes
})

export default router
