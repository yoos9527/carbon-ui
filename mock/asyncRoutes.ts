// 模拟后端动态生成路由
import { defineFakeRoute } from "vite-plugin-fake-server/client";

/**
 * 动态菜单为空：业务菜单后续由真实后端下发。
 * 新增菜单请参考 docs/UPSTREAM.md 里的「后端菜单接口返回示例」。
 */
export default defineFakeRoute([
  {
    url: "/get-async-routes",
    method: "get",
    response: () => {
      return {
        success: true,
        data: []
      };
    }
  }
]);
