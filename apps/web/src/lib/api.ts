const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Set by AuthProvider after Keycloak initialises so every request carries the token.
let _getToken: (() => string | undefined) | null = null;
export function setTokenProvider(fn: () => string | undefined) {
  _getToken = fn;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = _getToken?.();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  // 204 No Content has no body
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function fetchProjects() {
  return request<Project[]>('/api/projects');
}

export function createProject(data: { name: string; description?: string; project_type?: string }) {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── IGC Nodes ─────────────────────────────────────────────────────────────────

export function fetchNodes(projectId: string) {
  return request<IGCNode[]>(`/api/projects/${projectId}/nodes`);
}

export function saveNode(
  projectId: string,
  node: { id?: string; node_type?: string; intent?: object; graph?: object; code?: object; parent_id?: string }
) {
  return request<IGCNode>(`/api/projects/${projectId}/nodes`, {
    method: 'POST',
    body: JSON.stringify(node),
  });
}

export function deleteAllNodes(projectId: string) {
  return request<void>(`/api/projects/${projectId}/nodes`, { method: 'DELETE' });
}

export function updateNode(
  nodeId: string,
  data: { intent?: object; graph?: object; code?: object; meta?: object }
) {
  return request<IGCNode>(`/api/nodes/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteNodeApi(nodeId: string) {
  return request<void>(`/api/nodes/${nodeId}`, { method: 'DELETE' });
}

// ── Edges ─────────────────────────────────────────────────────────────────────

export function fetchEdges(projectId: string) {
  return request<ApiEdge[]>(`/api/projects/${projectId}/edges`);
}

export function saveEdge(
  projectId: string,
  edge: {
    id?: string;
    source_node_id: string;
    source_port_id: string;
    target_node_id: string;
    target_port_id: string;
    edge_type?: string;
    properties?: object;
  }
) {
  return request<ApiEdge>(`/api/projects/${projectId}/edges`, {
    method: 'POST',
    body: JSON.stringify(edge),
  });
}

export function deleteAllEdges(projectId: string) {
  return request<void>(`/api/projects/${projectId}/edges`, { method: 'DELETE' });
}

// ── Response types ─────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  project_type: string;
  settings: Record<string, unknown>;
  health_score: number;
  created_at: string;
  updated_at: string;
}

export interface IGCNode {
  id: string;
  parent_id: string | null;
  project_id: string;
  node_type: string;
  intent: Record<string, unknown>;
  graph: Record<string, unknown>;
  code: Record<string, unknown>;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApiEdge {
  id: string;
  project_id: string;
  source_node_id: string;
  source_port_id: string;
  target_node_id: string;
  target_port_id: string;
  edge_type: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
}
