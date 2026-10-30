import { apiRequest, ifMatch } from "./client";
import type {
  InterfaceDetail,
  InterfaceInput,
  InterfaceListItem,
  InterfaceListQuery,
  InterfaceStats,
  InterfaceStatusInput,
  InterfaceUpdateInput,
  PageResult
} from "./types";

export function getInterfaceList(query: InterfaceListQuery = {}) {
  return apiRequest<PageResult<InterfaceListItem>>("get", "/interfaces", {
    params: query
  });
}

export function getInterfaceStats() {
  return apiRequest<InterfaceStats>("get", "/interfaces/stats");
}

export function getInterface(interfaceId: number) {
  return apiRequest<InterfaceDetail>("get", `/interfaces/${interfaceId}`);
}

export function createInterface(data: InterfaceInput) {
  return apiRequest<InterfaceDetail>("post", "/interfaces", { data });
}

export function updateInterface(
  interfaceId: number,
  data: InterfaceUpdateInput
) {
  return apiRequest<InterfaceDetail>("put", `/interfaces/${interfaceId}`, {
    data
  });
}

export function updateInterfaceStatus(
  interfaceId: number,
  data: InterfaceStatusInput
) {
  return apiRequest<InterfaceDetail>(
    "patch",
    `/interfaces/${interfaceId}/status`,
    { data }
  );
}

export function deleteInterface(interfaceId: number, revision: number) {
  return apiRequest<void>("delete", `/interfaces/${interfaceId}`, {
    headers: ifMatch(revision)
  });
}
