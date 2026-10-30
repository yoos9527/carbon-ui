const Layout = () => import("@/layout/index.vue");

export default [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/login/index.vue"),
    meta: {
      title: "登录",
      showLink: false
    }
  },
  // 全屏403（无权访问）页面
  {
    path: "/access-denied",
    name: "AccessDenied",
    component: () => import("@/views/error/403.vue"),
    meta: {
      title: "403",
      showLink: false
    }
  },
  // 全屏500（服务器出错）页面
  {
    path: "/server-error",
    name: "ServerError",
    component: () => import("@/views/error/500.vue"),
    meta: {
      title: "500",
      showLink: false
    }
  },
  // 业务详情页（不在菜单中，由列表页点击行跳入）
  {
    path: "/service/partners/detail",
    component: Layout,
    // 父级标题不能与子级相同：SidebarBreadCrumb.vue 会把「子级 title 与父级相同」的父级从面包屑里剔除
    meta: {
      title: "服务管理",
      showLink: false
    },
    children: [
      {
        path: "/service/partners/detail/:id",
        name: "ServicePartnerDetail",
        component: () => import("@/views/service/partners/detail.vue"),
        meta: {
          title: "合作方详情",
          showLink: false
        }
      }
    ]
  },
  // 接口配置页（不在菜单中，由接口管理列表页点击行跳入）
  {
    path: "/service/interfaces/edit",
    component: Layout,
    meta: {
      title: "接口管理",
      showLink: false
    },
    children: [
      {
        path: "/service/interfaces/edit/:id",
        name: "ServiceInterfaceEdit",
        component: () => import("@/views/service/interfaces/edit.vue"),
        meta: {
          title: "调用配置",
          showLink: false
        }
      }
    ]
  },
  {
    path: "/redirect",
    component: Layout,
    meta: {
      title: "加载中...",
      showLink: false
    },
    children: [
      {
        path: "/redirect/:path(.*)",
        name: "Redirect",
        component: () => import("@/layout/redirect.vue")
      }
    ]
  }
] satisfies Array<RouteConfigsTable>;
