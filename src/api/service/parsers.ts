import { apiRequest, ifMatch } from "./client";
import type {
  PageResult,
  ParserInput,
  ParserItem,
  ParserListQuery,
  ParserStats,
  ParserStatusInput,
  ParserUpdateInput,
  ParserVersion
} from "./types";

export function getParserList(query: ParserListQuery = {}) {
  return apiRequest<PageResult<ParserItem>>("get", "/parsers", {
    params: query
  });
}

export function getParserStats() {
  return apiRequest<ParserStats>("get", "/parsers/stats");
}

export function getParser(parserId: number) {
  return apiRequest<ParserItem>("get", `/parsers/${parserId}`);
}

export function createParser(data: ParserInput) {
  return apiRequest<ParserItem>("post", "/parsers", { data });
}

export function updateParser(parserId: number, data: ParserUpdateInput) {
  return apiRequest<ParserItem>("put", `/parsers/${parserId}`, { data });
}

export function updateParserStatus(parserId: number, data: ParserStatusInput) {
  return apiRequest<ParserItem>("patch", `/parsers/${parserId}/status`, {
    data
  });
}

export function deleteParser(parserId: number, revision: number) {
  return apiRequest<void>("delete", `/parsers/${parserId}`, {
    headers: ifMatch(revision)
  });
}

export function getParserVersions(parserId: number) {
  return apiRequest<{ items: ParserVersion[] }>(
    "get",
    `/parsers/${parserId}/versions`
  );
}
