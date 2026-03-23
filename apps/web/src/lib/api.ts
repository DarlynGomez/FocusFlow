const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("focusflow_token");
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token = getToken(), ...rest } = options;
  const headers: HeadersInit = {
    ...(rest.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const auth = {
  register: (email: string, password: string) =>
    api<{ id: string; email: string }>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      token: null,
    }),
  login: (email: string, password: string) =>
    api<{ access_token: string }>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      token: null,
    }),
};

export const documents = {
  list: () => api<DocListItem[]>("/documents"),
  get: (id: string) => api<DocDetail>(`/documents/${id}`),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api<DocDetail>("/documents/upload", {
      method: "POST",
      body: form,
    });
  },
  chunks: (id: string) => api<ChunkOut[]>(`/documents/${id}/chunks`),
  outline: (id: string) => api<DocumentOutline>(`/documents/${id}/outline`),
};

export const sessions = {
  start: (document_id: string, support_mode: string = "medium") =>
    api<SessionResponse>("/sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id, support_mode }),
    }),
  get: (id: string) => api<SessionResponse>(`/sessions/${id}`),
  event: (id: string, event_type: string, chunk_id?: string, event_value?: string) =>
    api<void>(`/sessions/${id}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type, chunk_id, event_value }),
    }),
  supportCurrent: (id: string) => api<SupportMessageResponse | null>(`/sessions/${id}/support/current`),
};

export const chunks = {
  explain: (chunk_id: string) =>
    api<{ content: string }>(`/chunks/${chunk_id}/explain`, { method: "POST" }),
  recap: (chunk_id: string) =>
    api<{ content: string }>(`/chunks/${chunk_id}/recap`, { method: "POST" }),
  orient: (chunk_id: string) =>
    api<{ content: string }>(`/chunks/${chunk_id}/orient`, { method: "POST" }),
  whyItMatters: (chunk_id: string) =>
    api<{ content: string }>(`/chunks/${chunk_id}/why-it-matters`, { method: "POST" }),
};

export interface DocListItem {
  id: string;
  title: string;
  original_filename: string;
  status: string;
  page_count?: number;
  created_at: string;
}

export interface DocDetail {
  id: string;
  title: string;
  original_filename: string;
  file_path: string;
  status: string;
  page_count?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ChunkOut {
  id: string;
  chunk_index: number;
  page_start: number;
  page_end: number;
  section_title?: string;
  parent_section_title?: string;
  title: string;
  key_idea?: string;
  why_it_matters?: string;
  chunk_text: string;
  simplified_text?: string;
  estimated_read_time_seconds?: number;
  difficulty_score?: number;
  reading_order: number;
}

export interface OutlineNode {
  section_title: string;
  parent_section_title?: string;
  chunk_ids: string[];
  chunk_titles: string[];
}

export interface DocumentOutline {
  document_id: string;
  nodes: OutlineNode[];
}

export interface SessionResponse {
  id: string;
  document_id: string;
  started_at: string;
  last_active_at: string;
  current_chunk_id?: string;
  support_mode: string;
  completed: boolean;
}

export interface SupportMessageResponse {
  id: string;
  chunk_id?: string;
  support_type: string;
  content: string;
  trigger_source: string;
  created_at: string;
}
