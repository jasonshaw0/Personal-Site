import ipaddr from "ipaddr.js";
import { ApiError } from "./http.ts";

export type CloudflareConfig = {
  CF_ACCOUNT_ID: string;
  CF_ZONE_ID: string;
  CF_SITE_TAG: string;
  CF_PUBLIC_WORKER_TAG: string;
  CF_BLOCK_LIST_ID: string;
  CF_BLOCK_RULESET_ID: string;
  CF_BLOCK_RULE_ID: string;
  CF_ANALYTICS_TOKEN?: string;
  CF_SECURITY_TOKEN?: string;
};
type ApiEnvelope<T> = {
  success: boolean;
  result: T;
  errors?: { message: string; code?: number }[];
  result_info?: { cursors?: { after?: string } };
};
type DatasetSettings = {
  enabled: boolean;
  maxDuration: number;
  notOlderThan: number;
  maxPageSize: number;
};
type Settings = {
  rum: DatasetSettings;
  edge: DatasetSettings;
  events: DatasetSettings;
  adaptive: DatasetSettings;
};
type RUMRow = {
  count: number;
  sum: { visits: number };
  avg?: { sampleInterval: number };
  dimensions?: Record<string, string | number>;
};
type EdgeRow = {
  dimensions: { date: string };
  sum: {
    requests: number;
    pageViews: number;
    responseStatusMap: { edgeResponseStatus: number; requests: number }[];
  };
  uniq: { uniques: number };
};
type Event = {
  datetime: string;
  action: string;
  clientIP: string;
  clientCountryName: string;
  clientRequestPath: string;
  clientRequestHTTPHost: string;
  source: string;
  rayName: string;
  sampleInterval: number;
};

export class Cloudflare {
  constructor(
    private config: CloudflareConfig,
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}
  async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    security = false,
  ) {
    const token = security
      ? this.config.CF_SECURITY_TOKEN
      : this.config.CF_ANALYTICS_TOKEN;
    if (!token)
      throw new ApiError(
        503,
        `${security ? "Security" : "Analytics"} credentials have not been configured.`,
        "cloudflare_unconfigured",
      );
    const response = await this.fetcher(
      `https://api.cloudflare.com/client/v4${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      throw new ApiError(
        502,
        `Cloudflare ${security ? "security" : "analytics"} API could not complete this request (${response.status}). Check permissions, limits, and token expiration.`,
        "cloudflare_unavailable",
      );
    const data = (await response.json()) as ApiEnvelope<T> & { data?: T };
    if (data.errors?.length || data.success === false)
      throw new ApiError(
        422,
        data.errors
          ?.map((error) => error.message)
          .join("; ")
          .slice(0, 600) || "Cloudflare rejected this query.",
        "cloudflare_query_failed",
      );
    return { result: data.result ?? (data.data as T), info: data.result_info };
  }
  async graphql<T>(query: string, variables: Record<string, unknown> = {}) {
    return (await this.request<T>("/graphql", "POST", { query, variables }))
      .result;
  }
  async capabilities(): Promise<Settings> {
    const data = await this.graphql<{
      viewer: {
        accounts: {
          settings: { rumPageloadEventsAdaptiveGroups: DatasetSettings };
        }[];
        zones: {
          settings: {
            httpRequests1dGroups: DatasetSettings;
            firewallEventsAdaptive: DatasetSettings;
            httpRequestsAdaptiveGroups: DatasetSettings;
          };
        }[];
      };
    }>(
      `query($account: String!, $zone: String!){viewer{accounts(filter:{accountTag:$account}){settings{rumPageloadEventsAdaptiveGroups{enabled maxDuration notOlderThan maxPageSize}}}zones(filter:{zoneTag:$zone}){settings{httpRequests1dGroups{enabled maxDuration notOlderThan maxPageSize}firewallEventsAdaptive{enabled maxDuration notOlderThan maxPageSize}httpRequestsAdaptiveGroups{enabled maxDuration notOlderThan maxPageSize}}}}}`,
      { account: this.config.CF_ACCOUNT_ID, zone: this.config.CF_ZONE_ID },
    );
    const account = data.viewer.accounts[0]?.settings,
      zone = data.viewer.zones[0]?.settings;
    if (!account || !zone)
      throw new ApiError(
        503,
        "The analytics credential cannot access this account and zone.",
      );
    return {
      rum: account.rumPageloadEventsAdaptiveGroups,
      edge: zone.httpRequests1dGroups,
      events: zone.firewallEventsAdaptive,
      adaptive: zone.httpRequestsAdaptiveGroups,
    };
  }
  async analytics(start: string, end: string, compare: boolean) {
    const settings = await this.capabilities();
    validateRange(start, end, settings.rum);
    const variables = {
      account: this.config.CF_ACCOUNT_ID,
      zone: this.config.CF_ZONE_ID,
      rum: {
        siteTag: this.config.CF_SITE_TAG,
        datetime_geq: `${start}T00:00:00Z`,
        datetime_lt: `${end}T00:00:00Z`,
      },
      edge: { date_geq: start, date_lt: end },
    };
    const query = `query($account:String!,$zone:String!,$rum:AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!,$edge:ZoneHttpRequests1dGroupsFilter_InputObject!){viewer{accounts(filter:{accountTag:$account}){
      totals:rumPageloadEventsAdaptiveGroups(limit:1,filter:$rum){count sum{visits} avg{sampleInterval}}
      daily:rumPageloadEventsAdaptiveGroups(limit:200,filter:$rum,orderBy:[date_ASC]){count sum{visits} dimensions{date} avg{sampleInterval}}
      pages:rumPageloadEventsAdaptiveGroups(limit:30,filter:$rum,orderBy:[count_DESC]){count sum{visits} dimensions{requestPath}}
      referrers:rumPageloadEventsAdaptiveGroups(limit:15,filter:$rum,orderBy:[count_DESC]){count sum{visits} dimensions{refererHost}}
      countries:rumPageloadEventsAdaptiveGroups(limit:15,filter:$rum,orderBy:[count_DESC]){count sum{visits} dimensions{countryName}}
      browsers:rumPageloadEventsAdaptiveGroups(limit:12,filter:$rum,orderBy:[count_DESC]){count sum{visits} dimensions{userAgentBrowser}}
      devices:rumPageloadEventsAdaptiveGroups(limit:10,filter:$rum,orderBy:[count_DESC]){count sum{visits} dimensions{deviceType}}
      bots:rumPageloadEventsAdaptiveGroups(limit:10,filter:$rum){count sum{visits} dimensions{bot}}
    }zones(filter:{zoneTag:$zone}){daily:httpRequests1dGroups(limit:200,filter:$edge,orderBy:[date_ASC]){dimensions{date}sum{requests pageViews responseStatusMap{edgeResponseStatus requests}}uniq{uniques}}}}}`;
    const data = await this.graphql<{
      viewer: {
        accounts: {
          totals: RUMRow[];
          daily: RUMRow[];
          pages: RUMRow[];
          referrers: RUMRow[];
          countries: RUMRow[];
          browsers: RUMRow[];
          devices: RUMRow[];
          bots: RUMRow[];
        }[];
        zones: { daily: EdgeRow[] }[];
      };
    }>(query, variables);
    const rum = data.viewer.accounts[0],
      edge = data.viewer.zones[0]?.daily;
    if (!rum || !edge)
      throw new ApiError(
        503,
        "Analytics data is unavailable for this account.",
      );
    let previous: { pageViews: number; visits: number } | null = null;
    if (compare) {
      const days = (Date.parse(end) - Date.parse(start)) / 86400000;
      const previousStart = new Date(Date.parse(start) - days * 86400000)
        .toISOString()
        .slice(0, 10);
      validateRange(previousStart, start, settings.rum);
      const data = await this.graphql<{
        viewer: { accounts: { rows: RUMRow[] }[] };
      }>(
        `query($account:String!,$filter:AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!){viewer{accounts(filter:{accountTag:$account}){rows:rumPageloadEventsAdaptiveGroups(limit:1,filter:$filter){count sum{visits}}}}}`,
        {
          account: this.config.CF_ACCOUNT_ID,
          filter: {
            ...variables.rum,
            datetime_geq: `${previousStart}T00:00:00Z`,
            datetime_lt: `${start}T00:00:00Z`,
          },
        },
      );
      previous = {
        pageViews: data.viewer.accounts[0]?.rows[0]?.count ?? 0,
        visits: data.viewer.accounts[0]?.rows[0]?.sum.visits ?? 0,
      };
    }
    return {
      start,
      end,
      settings,
      rum,
      edge,
      previous,
      visitors: null,
      fetchedAt: new Date().toISOString(),
      notes: [
        "Web Analytics visits count page loads arriving from another website; they are not unique people.",
        "Raw HTTP requests include assets, bots, errors, and redirects. Edge page views are a separate server-side metric.",
        "Daily unique IP counts are not unique visitors and cannot be added across days.",
        "Cloudflare adaptively samples Web Analytics and security datasets. Sampling intervals and account retention limits are reported where available.",
      ],
    };
  }
  async events(start: string, end: string, action?: string, country?: string) {
    const settings = await this.capabilities();
    validateRange(start, end, settings.events);
    const filter: Record<string, string> = {
      datetime_geq: `${start}T00:00:00Z`,
      datetime_lt: `${end}T00:00:00Z`,
    };
    if (action) filter.action = action;
    if (country) filter.clientCountryName = country;
    const data = await this.graphql<{
      viewer: { zones: { events: Event[] }[] };
    }>(
      `query($zone:String!,$filter:ZoneFirewallEventsAdaptiveFilter_InputObject!){viewer{zones(filter:{zoneTag:$zone}){events:firewallEventsAdaptive(limit:500,filter:$filter,orderBy:[datetime_DESC]){datetime action clientIP clientCountryName clientRequestPath clientRequestHTTPHost source rayName sampleInterval}}}}`,
      { zone: this.config.CF_ZONE_ID, filter },
    );
    const events = data.viewer.zones[0]?.events ?? [];
    const counts = new Map<
      string,
      { count: number; dimensions: { date: string; action: string } }
    >();
    for (const event of events) {
      const date = event.datetime.slice(0, 10),
        key = `${date}:${event.action}`;
      const row = counts.get(key) ?? {
        count: 0,
        dimensions: { date, action: event.action },
      };
      row.count++;
      counts.set(key, row);
    }
    // The grouped firewall dataset is not entitled on this zone. Count only the
    // returned rows, without inventing zone-wide totals from a sampled subset.
    return {
      events,
      trend: [...counts.values()].sort((a, b) =>
        a.dimensions.date.localeCompare(b.dimensions.date),
      ),
      trendScope:
        "Returned events only; maximum 500 rows. These counts are not zone-wide totals.",
      settings: settings.events,
      limit: 500,
      fetchedAt: new Date().toISOString(),
    };
  }
  async blocks() {
    if (!this.config.CF_BLOCK_LIST_ID)
      throw new ApiError(503, "The dedicated IP list has not been configured.");
    let cursor = "",
      pages = 0;
    const result: {
      id: string;
      ip: string;
      comment?: string;
      created_on: string;
    }[] = [];
    do {
      const response = await this.request<typeof result>(
        `/accounts/${this.config.CF_ACCOUNT_ID}/rules/lists/${this.config.CF_BLOCK_LIST_ID}/items?per_page=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        "GET",
        undefined,
        true,
      );
      result.push(...response.result);
      cursor = response.info?.cursors?.after ?? "";
      pages++;
    } while (cursor && pages < 200);
    if (cursor)
      throw new ApiError(
        422,
        "The list exceeds this dashboard’s listing limit. Use Cloudflare to manage the complete list.",
      );
    return result;
  }
  async changeBlock(
    ip: string,
    currentIP: string,
    comment: string,
    removeId?: string,
  ) {
    await this.blockRule();
    const address = normalizeIP(ip);
    if (!removeId && currentIP && normalizeIP(currentIP) === address)
      throw new ApiError(
        400,
        "You cannot block the address used by your current administrative session.",
      );
    const blocks = await this.blocks();
    if (removeId) {
      const item = blocks.find((item) => item.id === removeId);
      if (!item || normalizeIP(item.ip) !== address)
        throw new ApiError(
          409,
          "The selected block changed. Refresh the list.",
        );
    } else if (blocks.some((item) => normalizeIP(item.ip) === address))
      throw new ApiError(409, "This address is already blocked.");
    const path = `/accounts/${this.config.CF_ACCOUNT_ID}/rules/lists/${this.config.CF_BLOCK_LIST_ID}/items`;
    const response = await this.request<{ operation_id: string }>(
      path,
      removeId ? "DELETE" : "POST",
      removeId ? { items: [{ id: removeId }] } : [{ ip: address, comment }],
      true,
    );
    // List changes are asynchronous. Do not claim enforcement until it completes.
    return { operationId: response.result.operation_id, ip: address };
  }
  async blockRule() {
    const { result } = await this.request<{
      rules: {
        id: string;
        enabled: boolean;
        action: string;
        expression: string;
      }[];
    }>(
      `/zones/${this.config.CF_ZONE_ID}/rulesets/${this.config.CF_BLOCK_RULESET_ID}`,
    );
    const rule = result.rules.find(
      (rule) => rule.id === this.config.CF_BLOCK_RULE_ID,
    );
    const expected =
      '(http.host in {"jason-shaw.com" "www.jason-shaw.com"} and ip.src in $jasonshaw_admin_blocked_ips)';
    if (
      !rule?.enabled ||
      rule.action !== "block" ||
      rule.expression !== expected
    )
      throw new ApiError(
        409,
        "The dedicated blocking rule changed or is disabled. Review its scope in Cloudflare before managing addresses.",
        "rule_changed",
      );
    return { adminExcluded: true, verified: true };
  }
  async blockOperation(id: string) {
    if (!/^[a-f0-9-]{32,36}$/i.test(id))
      throw new ApiError(400, "Invalid operation ID.");
    return (
      await this.request<{ status: string; error?: string }>(
        `/accounts/${this.config.CF_ACCOUNT_ID}/rules/lists/bulk_operations/${id}`,
        "GET",
        undefined,
        true,
      )
    ).result;
  }
  async builds() {
    const response = await this.request<
      {
        build_uuid: string;
        status: string;
        build_outcome: string | null;
        created_on: string;
        stopped_on: string | null;
        build_trigger_metadata: {
          branch: string;
          deploy_command: string;
          commit_hash: string;
          commit_message: string;
        };
      }[]
    >(
      `/accounts/${this.config.CF_ACCOUNT_ID}/builds/workers/${this.config.CF_PUBLIC_WORKER_TAG}/builds?per_page=30`,
    );
    return response.result
      .filter(
        (build) =>
          build.build_trigger_metadata?.branch === "main" &&
          !build.build_trigger_metadata.deploy_command?.includes(
            "versions upload",
          ),
      )
      .slice(0, 8)
      .map((build) => ({
        id: build.build_uuid,
        status: build.status,
        outcome: build.build_outcome,
        createdAt: build.created_on,
        finishedAt: build.stopped_on,
        commit: build.build_trigger_metadata?.commit_hash,
        message: build.build_trigger_metadata?.commit_message,
      }));
  }
}
export function validateRange(
  start: string,
  end: string,
  settings?: DatasetSettings,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end))
  )
    throw new ApiError(400, "Use valid YYYY-MM-DD dates.");
  const seconds = (Date.parse(end) - Date.parse(start)) / 1000;
  if (
    seconds <= 0 ||
    seconds > Math.min(settings?.maxDuration ?? 8035200, 8035200)
  )
    throw new ApiError(
      400,
      "The selected date range exceeds this dataset’s supported duration.",
    );
  if (Date.parse(end) > Date.now() + 86400000)
    throw new ApiError(400, "The end date cannot be in the future.");
  if (
    settings &&
    (!settings.enabled ||
      Date.parse(start) < Date.now() - settings.notOlderThan * 1000)
  )
    throw new ApiError(
      400,
      "This dataset is unavailable for the requested dates. Choose a more recent period.",
    );
}
export function normalizeIP(ip: string) {
  if (!ip || ip.includes("/") || ip.includes("%") || !ipaddr.isValid(ip))
    throw new ApiError(400, "Enter a single valid IPv4 or IPv6 address.");
  const parsed = ipaddr.process(ip);
  if (parsed.range() !== "unicast")
    throw new ApiError(400, "Only public unicast addresses can be blocked.");
  return parsed.toString();
}
