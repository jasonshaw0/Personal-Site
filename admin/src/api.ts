let csrf = "";
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    signal: options.signal,
    headers: {
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(!["GET", "HEAD"].includes(method)
        ? { "X-CSRF-Token": csrf, "Idempotency-Key": crypto.randomUUID() }
        : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json"))
    throw new RequestError(
      "Your Access session needs to be renewed. Reload and sign in again.",
      401,
      "session_expired",
    );
  const result = (await response.json()) as { error?: string; code?: string };
  if (!response.ok)
    throw new RequestError(
      result.error ?? "Request failed.",
      response.status,
      result.code,
    );
  return result as T;
}
export type Session = {
  email: string;
  csrf: string;
  version: string;
  origin: string;
};
export async function session() {
  const result = await api<Session>("/session");
  csrf = result.csrf;
  return result;
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The request could not be completed.";
export const number = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        value,
      );
export const dateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
export function dateRange(days = 7) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    start: new Date(end.valueOf() - days * 86400000).toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
export async function uploadImage(file: File) {
  if (file.size > 1_048_576)
    throw new Error(
      "Images must be 1 MiB or smaller. Resize or use WebP before uploading.",
    );
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
  return api<{ id: string; url: string; name: string; size: number }>(
    "/media",
    { method: "POST", body: { name: file.name, mime: file.type, content } },
  );
}
