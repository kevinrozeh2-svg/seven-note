-- ========================================================
-- SEVEN NOTE: ESQUEMA COMPLETO Y ACTUALIZADO PARA SUPABASE
-- Tablas con prefijo seven_ correspondientes a IndexedDB
-- ========================================================

-- 1. Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- 2. Tabla de Espacios (Tenants/Entornos)
create table if not exists public.seven_spaces (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null default 'Workspace',
  icon text default '💼',
  color text default '#1e96eb',
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false
);

-- 3. Tabla de Páginas / Documentos / Tableros
create table if not exists public.seven_workspaces (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  parent_id text,
  space_id text default 'default-workspace',
  folder text,
  title text not null default 'Sin título',
  icon text default '📄',
  color text default '#6366f1',
  view_mode text not null default 'doc',
  doc_content text not null default '',
  created_at bigint not null,
  updated_at bigint not null,
  is_favorite boolean not null default false,
  is_deleted boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

-- 4. Tabla de Nodos del Tablero (Notas, Checklists, Imágenes, Shapes, Milanote cards)
create table if not exists public.seven_canvas_nodes (
  id text primary key,
  workspace_id text not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  type text not null default 'note',
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  width double precision,
  height double precision,
  data jsonb not null default '{}'::jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false
);

-- 5. Tabla de Conexiones Visuales entre Nodos (Flechas / Edges)
create table if not exists public.seven_canvas_edges (
  id text primary key,
  workspace_id text not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  source text not null,
  target text not null,
  source_handle text,
  target_handle text,
  label text,
  animated boolean default false,
  color text default '#6366f1',
  edge_type text default 'default',
  marker_end_type text default 'arrow',
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false
);

-- 6. Tabla de Colecciones
create table if not exists public.seven_collections (
  id text primary key,
  space_id text not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  icon text default '📁',
  color text default '#1e96eb',
  doc_ids jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false
);

-- 7. Tabla de Tags
create table if not exists public.seven_tags (
  id text primary key,
  space_id text not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text not null default '#1e96eb',
  created_at bigint not null,
  is_deleted boolean not null default false
);

-- 8. Índices para sincronización veloz por timestamp
create index if not exists idx_seven_workspaces_updated on public.seven_workspaces(updated_at);
create index if not exists idx_seven_workspaces_space on public.seven_workspaces(space_id);
create index if not exists idx_seven_canvas_nodes_workspace on public.seven_canvas_nodes(workspace_id);
create index if not exists idx_seven_canvas_nodes_updated on public.seven_canvas_nodes(updated_at);
create index if not exists idx_seven_canvas_edges_workspace on public.seven_canvas_edges(workspace_id);
create index if not exists idx_seven_canvas_edges_updated on public.seven_canvas_edges(updated_at);
create index if not exists idx_seven_spaces_updated on public.seven_spaces(updated_at);
create index if not exists idx_seven_collections_updated on public.seven_collections(updated_at);

-- 9. Habilitar Row Level Security (RLS)
alter table public.seven_spaces enable row level security;
alter table public.seven_workspaces enable row level security;
alter table public.seven_canvas_nodes enable row level security;
alter table public.seven_canvas_edges enable row level security;
alter table public.seven_collections enable row level security;
alter table public.seven_tags enable row level security;

-- 10. Políticas de Acceso RLS (Soporte local offline / clave anónima o autenticado)
drop policy if exists "Acceso total a seven_spaces" on public.seven_spaces;
create policy "Acceso total a seven_spaces" on public.seven_spaces for all using (true) with check (true);

drop policy if exists "Acceso total a seven_workspaces" on public.seven_workspaces;
create policy "Acceso total a seven_workspaces" on public.seven_workspaces for all using (true) with check (true);

drop policy if exists "Acceso total a seven_canvas_nodes" on public.seven_canvas_nodes;
create policy "Acceso total a seven_canvas_nodes" on public.seven_canvas_nodes for all using (true) with check (true);

drop policy if exists "Acceso total a seven_canvas_edges" on public.seven_canvas_edges;
create policy "Acceso total a seven_canvas_edges" on public.seven_canvas_edges for all using (true) with check (true);

drop policy if exists "Acceso total a seven_collections" on public.seven_collections;
create policy "Acceso total a seven_collections" on public.seven_collections for all using (true) with check (true);

drop policy if exists "Acceso total a seven_tags" on public.seven_tags;
create policy "Acceso total a seven_tags" on public.seven_tags for all using (true) with check (true);

-- 11. Bucket de almacenamiento para archivos adjuntos
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "Permitir subida y lectura pública en attachments" on storage.objects;
create policy "Permitir subida y lectura pública en attachments"
  on storage.objects for all
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');
