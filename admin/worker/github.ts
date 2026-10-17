import { ApiError } from "./http.ts";
import { parseSource, type RepositoryPost } from "../shared/content.ts";

export type GitHubConfig = {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  GITHUB_TOKEN?: string;
};
type TreeItem = { path: string; sha: string; type: string };
export class GitHub {
  private root: string;
  constructor(
    private config: GitHubConfig,
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {
    this.root = `/repos/${encodeURIComponent(config.GITHUB_OWNER)}/${encodeURIComponent(config.GITHUB_REPO)}`;
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    if (!this.config.GITHUB_TOKEN)
      throw new ApiError(
        503,
        "GitHub publishing credentials have not been configured.",
        "github_unconfigured",
      );
    const response = await this.fetcher(
      `https://api.github.com${this.root}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${this.config.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "jasonshaw-admin",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      if (response.status === 404)
        throw new ApiError(
          404,
          "GitHub file or repository was not found.",
          "github_not_found",
        );
      if (response.status === 409 || response.status === 422)
        throw new ApiError(
          409,
          "The repository changed. Refresh the article and compare before retrying.",
          "conflict",
        );
      if (response.status === 401 || response.status === 403)
        throw new ApiError(
          503,
          "GitHub access was denied or rate limited. Check integration permissions and token expiration.",
          "github_access_denied",
        );
      throw new ApiError(
        502,
        "GitHub is temporarily unavailable. Your private draft is safe.",
        "github_unavailable",
      );
    }
    return response.json() as Promise<T>;
  }
  async tree(ref = this.config.GITHUB_BRANCH) {
    const result = await this.request<{ tree: TreeItem[]; truncated: boolean }>(
      `/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    );
    if (result.truncated)
      throw new ApiError(
        502,
        "Repository listing was truncated; narrow the content tree before continuing.",
      );
    return result.tree;
  }
  async file(path: string, ref = this.config.GITHUB_BRANCH) {
    validateContentPath(path);
    const file = await this.request<{
      type: string;
      encoding: string;
      content: string;
      sha: string;
      size: number;
    }>(`/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
    if (
      file.type !== "file" ||
      file.size > 400_000 ||
      file.encoding !== "base64"
    )
      throw new ApiError(
        422,
        "Article is too large or has an unsupported encoding.",
      );
    return {
      source: Buffer.from(file.content, "base64").toString("utf8"),
      sha: file.sha,
    };
  }
  async posts(): Promise<RepositoryPost[]> {
    const tree = await this.tree();
    const paths = tree.filter(
      (item) =>
        item.type === "blob" &&
        /^blog\/content\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.mdx?$/.test(
          item.path,
        ),
    );
    if (paths.length > 500)
      throw new ApiError(
        422,
        "The content collection exceeds this dashboard’s 500-article safety limit.",
      );
    const posts: RepositoryPost[] = [];
    // Keep GitHub concurrency bounded for larger archives.
    for (let index = 0; index < paths.length; index += 8) {
      posts.push(
        ...(await Promise.all(
          paths.slice(index, index + 8).map(async (item) => {
            const { source } = await this.file(item.path);
            const parsed = parseSource(source, item.path);
            return {
              ...parsed.metadata,
              path: item.path,
              sha: item.sha,
              format: parsed.format,
              status:
                parsed.raw.status === "published"
                  ? Date.parse(parsed.metadata.date) > Date.now()
                    ? "scheduled"
                    : "published"
                  : "repository draft",
            };
          }),
        )),
      );
    }
    return posts.sort((a, b) => b.date.localeCompare(a.date));
  }
  async commit(
    message: string,
    changes: {
      path: string;
      content?: string;
      base64?: string;
      remove?: boolean;
    }[],
    expected: { path: string; sha: string | null }[],
  ) {
    const refPath = `heads/${this.config.GITHUB_BRANCH.split("/").map(encodeURIComponent).join("/")}`;
    const ref = await this.request<{ object: { sha: string } }>(
      `/git/ref/${refPath}`,
    );
    const head = ref.object.sha;
    const tree = await this.tree(head);
    for (const file of expected) {
      const current = tree.find((item) => item.path === file.path)?.sha ?? null;
      if (current !== file.sha)
        throw new ApiError(
          409,
          "This article changed on GitHub. Save your private changes, then load the latest revision to compare.",
          "conflict",
        );
    }
    const commit = await this.request<{ tree: { sha: string } }>(
      `/git/commits/${head}`,
    );
    const entries = [];
    for (const change of changes) {
      if (
        !/^(blog\/content\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.mdx?|public\/blog\/images\/[a-zA-Z0-9_.-]+)$/.test(
          change.path,
        )
      )
        throw new ApiError(400, "Invalid publishing path.");
      if (change.remove) {
        entries.push({
          path: change.path,
          mode: "100644",
          type: "blob",
          sha: null,
        });
        continue;
      }
      const blob = await this.request<{ sha: string }>("/git/blobs", "POST", {
        content: change.base64 ?? change.content ?? "",
        encoding: change.base64 ? "base64" : "utf-8",
      });
      entries.push({
        path: change.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }
    const newTree = await this.request<{ sha: string }>("/git/trees", "POST", {
      base_tree: commit.tree.sha,
      tree: entries,
    });
    const newCommit = await this.request<{ sha: string }>(
      "/git/commits",
      "POST",
      { message, tree: newTree.sha, parents: [head] },
    );
    try {
      await this.request(`/git/refs/${refPath}`, "PATCH", {
        sha: newCommit.sha,
        force: false,
      });
    } catch (error) {
      // A response can be lost after GitHub accepts the commit. Reconcile the
      // branch before reporting failure or encouraging a duplicate publication.
      const current = await this.request<{ object: { sha: string } }>(
        `/git/ref/${refPath}`,
      ).catch(() => null);
      if (current?.object.sha !== newCommit.sha) throw error;
    }
    return { commit: newCommit.sha, files: entries };
  }
  async revisions(path: string) {
    validateContentPath(path);
    return this.request<
      {
        sha: string;
        html_url: string;
        commit: { message: string; author: { date: string; name: string } };
      }[]
    >(
      `/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(this.config.GITHUB_BRANCH)}&per_page=20`,
    );
  }
}
export function validateContentPath(path: string) {
  if (!/^blog\/content\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.mdx?$/.test(path))
    throw new ApiError(400, "Invalid article path.");
}
const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");
