const Layout = () => import("@/layout/index.vue");

export default {
  path: "/service",
  name: "Service",
  component: Layout,
  redirect: "/service/partners",
  meta: {
    icon: "ri/server-line",
    title: "服务管理",
    rank: 1
  },
  children: [
    {
      path: "/service/partners",
      name: "ServicePartners",
      component: () => import("@/views/service/partners/index.vue"),
      meta: {
        icon: "ri/team-line",
        title: "合作方",
        showParent: true
      }
    },
    {
      path: "/service/interfaces",
      name: "ServiceInterfaces",
      component: () => import("@/views/service/interfaces/index.vue"),
      meta: {
        icon: "ri/route-line",
        title: "接口管理",
        showParent: true
      }
    }
  ]
} satisfies RouteConfigsTable;
