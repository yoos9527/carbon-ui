import { apiRequest, ifMatch } from "./client";
import type {
  AuthConfig,
  AuthConfigInput,
  AuthConfigUpdateInput,
  BillingConfig,
  BillingConfigInput,
  NetworkConfig,
  NetworkConfigInput,
  PageResult,
  PartnerCreateInput,
  PartnerDetail,
  PartnerEnv,
  PartnerEnvInput,
  PartnerListQuery,
  PartnerListItem,
  PartnerStatusInput,
  PartnerUpdateInput,
  PolicyConfig,
  PolicyConfigInput,
  RevisionedCollectionResult,
  ScriptValidationResult
} from "./types";

export function getPartnerList(query: PartnerListQuery = {}) {
  return apiRequest<PageResult<PartnerListItem>>("get", "/partners", {
    params: query
  });
}

export function getPartner(partnerId: number) {
  return apiRequest<PartnerDetail>("get", `/partners/${partnerId}`);
}

export function createPartner(data: PartnerCreateInput) {
  return apiRequest<PartnerDetail>("post", "/partners", { data });
}

export function updatePartner(partnerId: number, data: PartnerUpdateInput) {
  return apiRequest<PartnerDetail>("put", `/partners/${partnerId}`, { data });
}

export function updatePartnerStatus(
  partnerId: number,
  data: PartnerStatusInput
) {
  return apiRequest<PartnerDetail>("patch", `/partners/${partnerId}/status`, {
    data
  });
}

export function deletePartner(partnerId: number, revision: number) {
  return apiRequest<void>("delete", `/partners/${partnerId}`, {
    headers: ifMatch(revision)
  });
}

export function getPartnerEnvironments(partnerId: number) {
  return apiRequest<RevisionedCollectionResult<PartnerEnv>>(
    "get",
    `/partners/${partnerId}/environments`
  );
}

export function replacePartnerEnvironments(
  partnerId: number,
  revision: number,
  items: PartnerEnvInput[]
) {
  return apiRequest<RevisionedCollectionResult<PartnerEnv>>(
    "put",
    `/partners/${partnerId}/environments`,
    { data: { revision, items } }
  );
}

export function getPartnerNetwork(partnerId: number) {
  return apiRequest<NetworkConfig>("get", `/partners/${partnerId}/network`);
}

export function updatePartnerNetwork(
  partnerId: number,
  data: NetworkConfigInput
) {
  return apiRequest<NetworkConfig>("put", `/partners/${partnerId}/network`, {
    data
  });
}

export function getPartnerPolicy(partnerId: number) {
  return apiRequest<PolicyConfig>("get", `/partners/${partnerId}/policy`);
}

export function updatePartnerPolicy(
  partnerId: number,
  data: PolicyConfigInput
) {
  return apiRequest<PolicyConfig>("put", `/partners/${partnerId}/policy`, {
    data
  });
}

export function getPartnerBilling(partnerId: number) {
  return apiRequest<BillingConfig>("get", `/partners/${partnerId}/billing`);
}

export function updatePartnerBilling(
  partnerId: number,
  data: BillingConfigInput
) {
  return apiRequest<BillingConfig>("put", `/partners/${partnerId}/billing`, {
    data
  });
}

export function getAuthConfigs(partnerId: number) {
  return apiRequest<{ items: AuthConfig[] }>(
    "get",
    `/partners/${partnerId}/auth-configs`
  );
}

export function createAuthConfig(partnerId: number, data: AuthConfigInput) {
  return apiRequest<AuthConfig>("post", `/partners/${partnerId}/auth-configs`, {
    data
  });
}

export function updateAuthConfig(
  partnerId: number,
  authId: number,
  data: AuthConfigUpdateInput
) {
  return apiRequest<AuthConfig>(
    "put",
    `/partners/${partnerId}/auth-configs/${authId}`,
    { data }
  );
}

export function deleteAuthConfig(
  partnerId: number,
  authId: number,
  revision: number
) {
  return apiRequest<void>(
    "delete",
    `/partners/${partnerId}/auth-configs/${authId}`,
    { headers: ifMatch(revision) }
  );
}

export function validateAuthScript(
  partnerId: number,
  data: { scriptCode: string; scriptTimeout: number }
) {
  return apiRequest<ScriptValidationResult>(
    "post",
    `/partners/${partnerId}/auth-configs/script-validations`,
    { data }
  );
}
