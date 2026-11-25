export class ClientApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ClientApiError(data?.error?.message || "কাজটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।", response.status, data?.error?.code);
  return data as T;
}
