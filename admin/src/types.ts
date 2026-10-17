import type { Cloudflare } from "../worker/cloudflare";
import type { DraftSummary, RepositoryPost } from "../shared/content";
export type AnalyticsData = Awaited<ReturnType<Cloudflare["analytics"]>>;
export type EventsData = Awaited<ReturnType<Cloudflare["events"]>>;
export type Deployment = Awaited<ReturnType<Cloudflare["builds"]>>[number];
export type BlocksData = {
  blocks: { id: string; ip: string; comment?: string; created_on: string }[];
  currentIP: string;
  adminExcluded: boolean;
};
export type PostData = {
  drafts: DraftSummary[];
  repository: { available: boolean; data?: RepositoryPost[]; error?: string };
};
export type Media = {
  id: string;
  name: string;
  mime: string;
  size: number;
  public_path: string | null;
  created_at: string;
};
export type AuditItem = {
  id: string;
  actor: string;
  action: string;
  target: string;
  outcome: string;
  detail: string;
  created_at: string;
};
export type Integration<T> = { available: boolean; data?: T; error?: string };
export type SettingsData = {
  version: string;
  origin: string;
  email: string;
  repository: string;
  branch: string;
  publicSite: string;
  github: Integration<{ repository: string; canPush: boolean | null }>;
  analytics: Integration<AnalyticsData["settings"]>;
  security: Integration<{ blockCount: number }>;
  deployments: Integration<Deployment[]>;
  credentials: { github: boolean; analytics: boolean; security: boolean };
  limits: {
    imageBytes: number;
    markdownCharacters: number;
    articles: number;
    draftList: number;
  };
  access: { audience: string; issuer: string; alternateHosts: string };
};
