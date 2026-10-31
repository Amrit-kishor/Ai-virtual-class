export async function safeFetchJson<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const headers = new Headers(options?.headers || {});
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
    const res = await fetch(url, {
      credentials: options?.credentials || 'include',
      ...options,
      headers,
    });
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error || data.message || `Request failed with status ${res.status}` };
      }
      return { ok: true, status: res.status, data };
    } else {
      const text = await res.text();
      return {
        ok: false,
        status: res.status,
        error: res.ok ? 'Unexpected non-JSON response from server.' : `Server error (${res.status}): ${text.slice(0, 150)}`,
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, status: 0, error: message };
  }
}
