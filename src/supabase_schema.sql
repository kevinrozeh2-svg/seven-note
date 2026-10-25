-- ========================================================
-- SEVEN NOTE: ESQUEMA COMPLETO PARA SUPABASE
-- Ejecutar en el SQL Editor de tu proyecto Supabase
-- ========================================================

-- 1. Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- 2. Tabla de Espacios de Trabajo / Páginas / Tableros
create table if not exists public.workspaces (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  parent_id text,
  title text not null default 'Sin título',
  icon text default '📄',
  color text default '#6366f1',
  view_mode text not null default 'both' check (view_mode in ('doc', 'canvas', 'split', 'both')),
  doc_content text not null default '',
  created_at bigint not null,
  updated_at bigint not null,
  is_favorite boolean not null default false,
  is_deleted boolean not null default false
);

-- 3. Tabla de Nodos del Tablero (Notas, Checklists, Imágenes, Enlaces, Sub-tableros)
create table if not exists public.canvas_nodes (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
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

-- 4. Tabla de Conexiones Visuales entre Nodos (Flechas)
create table if not exists public.canvas_edges (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  source text not null,
  target text not null,
  source_handle text,
  target_handle text,
  label text,
  animated boolean default false,
  color text default '#6366f1',
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false
);

-- 5. Índices para consultas eficientes
create index if not exists idx_workspaces_updated on public.workspaces(updated_at);
create index if not exists idx_workspaces_parent on public.workspaces(parent_id);
create index if not exists idx_canvas_nodes_workspace on public.canvas_nodes(workspace_id);
create index if not exists idx_canvas_edges_workspace on public.canvas_edges(workspace_id);

-- 6. Habilitar Row Level Security (RLS)
alter table public.workspaces enable row level security;
alter table public.canvas_nodes enable row level security;
alter table public.canvas_edges enable row level security;

-- 7. Políticas de Acceso RLS (Soporta usuarios autenticados o clave anónima de prueba)
drop policy if exists "Acceso total a workspaces" on public.workspaces;
create policy "Acceso total a workspaces"
  on public.workspaces for all
  using (true)
  with check (true);

drop policy if exists "Acceso total a canvas_nodes" on public.canvas_nodes;
create policy "Acceso total a canvas_nodes"
  on public.canvas_nodes for all
  using (true)
  with check (true);

drop policy if exists "Acceso total a canvas_edges" on public.canvas_edges;
create policy "Acceso total a canvas_edges"
  on public.canvas_edges for all
  using (true)
  with check (true);

-- 8. Bucket de almacenamiento para imágenes y archivos offline
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "Permitir subida y lectura pública en attachments"
  on storage.objects for all
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');
