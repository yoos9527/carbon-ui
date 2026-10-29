/**
 * 合作方数据模型，字段需与后端接口对齐。
 *
 * TODO: 接后端时删除本文件里的 mockPartners，列表页/详情页统一改用
 *   import { getPartnerList, getPartnerDetail } from "@/api/service";
 */
export interface PartnerItem {
  id: number;
  name: string;
  code: string;
  contact: string;
  phone: string;
  status: 0 | 1;
  createTime: string;
}

export const mockPartners: PartnerItem[] = [
  {
    id: 1,
    name: "中科数据科技有限公司",
    code: "PT-0001",
    contact: "张伟",
    phone: "13800001234",
    status: 1,
    createTime: "2026-01-08 09:12:00"
  },
  {
    id: 2,
    name: "华东云计算服务中心",
    code: "PT-0002",
    contact: "李静",
    phone: "13900002345",
    status: 1,
    createTime: "2026-01-15 14:30:00"
  },
  {
    id: 3,
    name: "南方电子档案服务商",
    code: "PT-0003",
    contact: "王强",
    phone: "13700003456",
    status: 0,
    createTime: "2026-02-02 10:05:00"
  },
  {
    id: 4,
    name: "北方工业互联网平台",
    code: "PT-0004",
    contact: "赵敏",
    phone: "13600004567",
    status: 1,
    createTime: "2026-02-19 16:48:00"
  },
  {
    id: 5,
    name: "西南政务数据运营方",
    code: "PT-0005",
    contact: "陈刚",
    phone: "13500005678",
    status: 1,
    createTime: "2026-03-04 08:21:00"
  }
];

/** 按 id 查详情；接后端后换成接口请求 */
export function getPartnerById(id: string | number): PartnerItem | null {
  return mockPartners.find(item => item.id === Number(id)) ?? null;
}
