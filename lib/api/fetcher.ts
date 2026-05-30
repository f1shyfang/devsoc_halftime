"use client";

/** POST JSON to an API route; returns { data, error } to mirror the old
 *  supabase-js call ergonomics so call-site changes stay minimal. */
export async function postJson<T = unknown>(
  url: string,
  body?: unknown,
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { data: null, error: { message: (json && json.error) || res.statusText } };
    }
    return { data: json as T, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "network_error" } };
  }
}

/** SWR fetcher for GET polling endpoints. */
export async function swrFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return res.json() as Promise<T>;
}
