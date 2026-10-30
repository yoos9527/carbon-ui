import { apiDownload, apiUpload } from "./client";
import { apiRequest } from "./client";
import type {
  DownloadedFile,
  ImportCommitRequest,
  ImportCommitResult,
  ImportValidationResult,
  InterfaceInput,
  InterfaceListQuery,
  PartnerCreateInput,
  PartnerListQuery
} from "./types";

function withoutPaging<T extends { page?: number; pageSize?: number }>(
  query: T
): object {
  const { page: _page, pageSize: _pageSize, ...rest } = query;
  return rest;
}

export function downloadPartnerImportTemplate(): Promise<DownloadedFile> {
  return apiDownload("/partners/import-template");
}

export function exportPartners(
  query: PartnerListQuery = {}
): Promise<DownloadedFile> {
  return apiDownload("/partners/export", withoutPaging(query));
}

export function validatePartnerImport(
  file: File | Blob
): Promise<ImportValidationResult<PartnerCreateInput>> {
  return apiUpload("/partners/import/validate", file);
}

export function commitPartnerImport(
  data: ImportCommitRequest<PartnerCreateInput>
): Promise<ImportCommitResult> {
  return apiRequest<ImportCommitResult>("post", "/partners/import", { data });
}

export function downloadInterfaceImportTemplate(): Promise<DownloadedFile> {
  return apiDownload("/interfaces/import-template");
}

export function exportInterfaces(
  query: InterfaceListQuery = {}
): Promise<DownloadedFile> {
  return apiDownload("/interfaces/export", withoutPaging(query));
}

export function validateInterfaceImport(
  file: File | Blob
): Promise<ImportValidationResult<InterfaceInput>> {
  return apiUpload("/interfaces/import/validate", file);
}

export function commitInterfaceImport(
  data: ImportCommitRequest<InterfaceInput>
): Promise<ImportCommitResult> {
  return apiRequest<ImportCommitResult>("post", "/interfaces/import", { data });
}
