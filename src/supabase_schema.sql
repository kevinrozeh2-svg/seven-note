-- ========================================================
-- SEVEN NOTE: ESQUEMA COMPLETO Y ACTUALIZADO PARA SUPABASE
-- Sistema Robusto de Autenticación, Perfiles y Roles (Admin/Miembro/Lector)
-- Control de Acceso por Filas (Row Level Security - RLS) Estricto
-- Sincronización de Tableros, Documentos y Espacios Compartidos
-- ========================================================

-- 1. Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ========================================================
-- 2. TABLA DE PERFILES DE USUARIOS (user_profiles)
-- ========================================================
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  avatar_url text,
  color text not null default '#2563eb',
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'suspended', 'pending')),
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- Migraciones seguras si la tabla ya existía
alter table public.user_profiles add column if not exists role text not null default 'member';
alter table public.user_profiles add column if not exists status text not null default 'active';
alter table public.user_profiles add column if not exists color text not null default '#2563eb';

-- ========================================================
-- 3. TABLA DE INVITACIONES / LISTA BLANCA (team_invitations)
-- ========================================================
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- ========================================================
-- 4. FUNCIONES DE AYUDA DE ROL Y SEGURIDAD
-- ========================================================
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_profiles
    where id = user_id and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_user_active(user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_profiles
    where id = user_id and status = 'active'
  );
$$;

create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select coalesce(
    (select role from public.user_profiles where id = auth.uid() limit 1),
    'viewer'
  );
$$;

-- ========================================================
-- 5. TRIGGER AUTOMÁTICO AL REGISTRAR UN NUEVO USUARIO
-- ========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  is_first_user boolean;
  invited_role text;
begin
  -- Si no existe ningún perfil en la tabla, el primer usuario se convierte automáticamente en Administrador
  select not exists(select 1 from public.user_profiles) into is_first_user;

  -- Comprobar si el correo ya tenía una invitación con rol preasignado
  select role into invited_role from public.team_invitations where lower(email) = lower(new.email);

  insert into public.user_profiles (id, email, full_name, role, status, color, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case
      when is_first_user then 'admin'
      when lower(new.email) in ('kevin.rozeh@gmail.com', 'kevin.rozeh2@gmail.com', 'badmaik60@gmail.com', 'marcos@sevennote.local') then 'admin'
      when invited_role is not null then invited_role
      else 'member'
    end,
    'active',
    '#2563eb',
    (extract(epoch from now()) * 1000)::bigint,
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case
      when lower(excluded.email) in ('kevin.rozeh@gmail.com', 'kevin.rozeh2@gmail.com', 'badmaik60@gmail.com', 'marcos@sevennote.local') then 'admin'
      else user_profiles.role
    end,
    full_name = case when user_profiles.full_name = '' then excluded.full_name else user_profiles.full_name end,
    updated_at = (extract(epoch from now()) * 1000)::bigint;

  -- Eliminar la invitación si existía
  if invited_role is not null then
    delete from public.team_invitations where lower(email) = lower(new.email);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sincronizar usuarios existentes en auth.users si no tienen perfil aún
insert into public.user_profiles (id, email, full_name, role, status, color, created_at, updated_at)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  'admin',
  'active',
  '#2563eb',
  coalesce((extract(epoch from created_at) * 1000)::bigint, (extract(epoch from now()) * 1000)::bigint),
  (extract(epoch from now()) * 1000)::bigint
from auth.users
on conflict (id) do nothing;

-- Asegurar rol 'admin' en perfiles existentes para los correos autorizados (Kevin, Maikol, etc.)
update public.user_profiles
set role = 'admin'
where lower(email) in ('kevin.rozeh@gmail.com', 'kevin.rozeh2@gmail.com', 'badmaik60@gmail.com', 'marcos@sevennote.local');

-- Pre-autorizar como Administradores en la lista blanca de invitaciones
insert into public.team_invitations (email, role)
values
  ('kevin.rozeh@gmail.com', 'admin'),
  ('kevin.rozeh2@gmail.com', 'admin'),
  ('badmaik60@gmail.com', 'admin'),
  ('marcos@sevennote.local', 'admin')
on conflict (email) do update set role = 'admin';

-- ========================================================
-- 6. TABLAS DE SEVEN NOTE (Espacios, Documentos, Canvas, etc.)
-- ========================================================

-- Tabla de Espacios (Tenants/Entornos Compartidos del Equipo)
create table if not exists public.seven_spaces (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null default 'Workspace',
  icon text default '💼',
  color text default '#1e96eb',
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false,
  is_private boolean not null default false,
  owner_member text
);

alter table public.seven_spaces add column if not exists is_private boolean not null default false;
alter table public.seven_spaces add column if not exists owner_member text;
alter table public.seven_spaces add column if not exists viewed_by text[];

-- Tabla de Páginas / Documentos / Tableros
create table if not exists public.seven_workspaces (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
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
  metadata jsonb not null default '{}'::jsonb,

  -- Modo Privado Estricto por Miembro
  is_private boolean not null default false,
  owner_member text default 'kevin',
  
  -- Compartir con Invitados Externos mediante Enlace Seguro
  is_public_shared boolean not null default false,
  share_token text,
  share_permission text default 'view'
);

alter table public.seven_workspaces add column if not exists is_private boolean not null default false;
alter table public.seven_workspaces add column if not exists owner_member text default 'kevin';
alter table public.seven_workspaces add column if not exists is_public_shared boolean not null default false;
alter table public.seven_workspaces add column if not exists share_token text;
alter table public.seven_workspaces add column if not exists share_permission text default 'view';

-- Tabla de Nodos del Tablero (Notas, Checklists, Imágenes, Shapes, Milanote cards)
create table if not exists public.seven_canvas_nodes (
  id text primary key,
  workspace_id text not null,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
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

-- Tabla de Conexiones Visuales entre Nodos (Flechas / Edges)
create table if not exists public.seven_canvas_edges (
  id text primary key,
  workspace_id text not null,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
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

-- Tabla de Colecciones
create table if not exists public.seven_collections (
  id text primary key,
  space_id text not null,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  icon text default '📁',
  color text default '#1e96eb',
  doc_ids jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false
);

-- Tabla de Tags
create table if not exists public.seven_tags (
  id text primary key,
  space_id text not null,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  color text not null default '#1e96eb',
  created_at bigint not null,
  is_deleted boolean not null default false
);

-- ========================================================
-- 7. ÍNDICES DE RENDIMIENTO Y SINCRONIZACIÓN
-- ========================================================
create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_status on public.user_profiles(status);
create index if not exists idx_seven_workspaces_updated on public.seven_workspaces(updated_at);
create index if not exists idx_seven_workspaces_space on public.seven_workspaces(space_id);
create index if not exists idx_seven_workspaces_private on public.seven_workspaces(is_private, user_id);
create index if not exists idx_seven_workspaces_private_owner on public.seven_workspaces(is_private, owner_member);
create index if not exists idx_seven_workspaces_share on public.seven_workspaces(is_public_shared, share_token);
create index if not exists idx_seven_canvas_nodes_workspace on public.seven_canvas_nodes(workspace_id);
create index if not exists idx_seven_canvas_nodes_updated on public.seven_canvas_nodes(updated_at);
create index if not exists idx_seven_canvas_edges_workspace on public.seven_canvas_edges(workspace_id);
create index if not exists idx_seven_canvas_edges_updated on public.seven_canvas_edges(updated_at);
create index if not exists idx_seven_spaces_updated on public.seven_spaces(updated_at);
create index if not exists idx_seven_spaces_private on public.seven_spaces(is_private, user_id);
create index if not exists idx_seven_spaces_private_owner on public.seven_spaces(is_private, owner_member);
create index if not exists idx_seven_collections_updated on public.seven_collections(updated_at);

-- ========================================================
-- 8. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
-- ========================================================
alter table public.user_profiles enable row level security;
alter table public.team_invitations enable row level security;
alter table public.seven_spaces enable row level security;
alter table public.seven_workspaces enable row level security;
alter table public.seven_canvas_nodes enable row level security;
alter table public.seven_canvas_edges enable row level security;
alter table public.seven_collections enable row level security;
alter table public.seven_tags enable row level security;

-- ========================================================
-- 9. POLÍTICAS RLS ROBUSTAS
-- ========================================================

-- A) PERFILES DE USUARIO
drop policy if exists "Lectura de perfiles autenticados" on public.user_profiles;
create policy "Lectura de perfiles autenticados" on public.user_profiles
  for select to authenticated
  using (true);

drop policy if exists "Actualizacion propia de perfil" on public.user_profiles;
create policy "Actualizacion propia de perfil" on public.user_profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger de seguridad para evitar escalación de privilegios en user_profiles
create or replace function public.check_user_profile_update()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Solo administradores pueden cambiar roles y estados de cuenta
  if not public.is_admin(auth.uid()) then
    if new.role is distinct from old.role then
      raise exception 'No tienes permisos para modificar tu rol de usuario.';
    end if;
    if new.status is distinct from old.status then
      raise exception 'No tienes permisos para modificar el estado de tu cuenta.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_check_user_profile_update on public.user_profiles;
create trigger tr_check_user_profile_update
  before update on public.user_profiles
  for each row execute function public.check_user_profile_update();

drop policy if exists "Admin gestion total de perfiles" on public.user_profiles;
create policy "Admin gestion total de perfiles" on public.user_profiles
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- B) INVITACIONES
drop policy if exists "Admin gestion invitaciones" on public.team_invitations;
create policy "Admin gestion invitaciones" on public.team_invitations
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- C) ESPACIOS DE TRABAJO (SEVEN_SPACES)
drop policy if exists "Acceso total a seven_spaces" on public.seven_spaces;
drop policy if exists "Lectura de seven_spaces" on public.seven_spaces;
create policy "Lectura de seven_spaces" on public.seven_spaces
  for select to authenticated
  using (
    public.is_user_active(auth.uid())
    and (
      is_private = false
      or user_id = auth.uid()
    )
  );

drop policy if exists "Modificacion de seven_spaces" on public.seven_spaces;
create policy "Modificacion de seven_spaces" on public.seven_spaces
  for insert to authenticated
  with check (public.is_user_active(auth.uid()) and public.get_my_role() != 'viewer');

drop policy if exists "Actualizacion de seven_spaces" on public.seven_spaces;
create policy "Actualizacion de seven_spaces" on public.seven_spaces
  for update to authenticated
  using (
    public.is_user_active(auth.uid())
    and public.get_my_role() != 'viewer'
    and (
      is_private = false
      or user_id = auth.uid()
    )
  )
  with check (
    public.is_user_active(auth.uid())
    and public.get_my_role() != 'viewer'
    and (
      is_private = false
      or user_id = auth.uid()
    )
  );

drop policy if exists "Eliminacion de seven_spaces" on public.seven_spaces;
create policy "Eliminacion de seven_spaces" on public.seven_spaces
  for delete to authenticated
  using (
    public.is_user_active(auth.uid())
    and (
      user_id = auth.uid()
      or (is_private = false and public.is_admin(auth.uid()))
    )
  );

-- D) DOCUMENTOS Y PÁGINAS (SEVEN_WORKSPACES)
-- Modo Privado Estricto: ni los administradores pueden ver notas privadas de otros usuarios, y viceversa.
drop policy if exists "Lectura de workspaces" on public.seven_workspaces;
drop policy if exists "Acceso total a seven_workspaces" on public.seven_workspaces;
create policy "Lectura de workspaces" on public.seven_workspaces
  for select using (
    is_public_shared = true
    or (
      auth.role() = 'authenticated'
      and public.is_user_active(auth.uid())
      and (
        is_private = false
        or user_id = auth.uid()
      )
    )
  );

drop policy if exists "Modificacion de workspaces" on public.seven_workspaces;
create policy "Modificacion de workspaces" on public.seven_workspaces
  for insert to authenticated
  with check (
    public.is_user_active(auth.uid())
    and public.get_my_role() != 'viewer'
  );

drop policy if exists "Actualizacion de workspaces" on public.seven_workspaces;
create policy "Actualizacion de workspaces" on public.seven_workspaces
  for update using (
    (is_public_shared = true and share_permission = 'edit')
    or (
      auth.role() = 'authenticated'
      and public.is_user_active(auth.uid())
      and public.get_my_role() != 'viewer'
      and (
        is_private = false
        or user_id = auth.uid()
      )
    )
  )
  with check (
    (is_public_shared = true and share_permission = 'edit')
    or (
      auth.role() = 'authenticated'
      and public.is_user_active(auth.uid())
      and public.get_my_role() != 'viewer'
      and (
        is_private = false
        or user_id = auth.uid()
      )
    )
  );

drop policy if exists "Eliminacion de workspaces" on public.seven_workspaces;
create policy "Eliminacion de workspaces" on public.seven_workspaces
  for delete to authenticated
  using (
    public.is_user_active(auth.uid())
    and (
      user_id = auth.uid()
      or (is_private = false and public.is_admin(auth.uid()))
    )
  );

-- E) CANVAS NODES & EDGES (Protegidos estrictamente por el Workspace padre)
drop policy if exists "Acceso total a seven_canvas_nodes" on public.seven_canvas_nodes;
create policy "Acceso seguro a seven_canvas_nodes" on public.seven_canvas_nodes
  for all using (
    exists (
      select 1 from public.seven_workspaces w
      where w.id = seven_canvas_nodes.workspace_id
      and (
        w.is_public_shared = true
        or (
          auth.role() = 'authenticated'
          and public.is_user_active(auth.uid())
          and (w.is_private = false or w.user_id = auth.uid())
        )
      )
    )
  )
  with check (
    exists (
      select 1 from public.seven_workspaces w
      where w.id = seven_canvas_nodes.workspace_id
      and (
        (w.is_public_shared = true and w.share_permission = 'edit')
        or (
          auth.role() = 'authenticated'
          and public.is_user_active(auth.uid())
          and public.get_my_role() != 'viewer'
          and (w.is_private = false or w.user_id = auth.uid())
        )
      )
    )
  );

drop policy if exists "Acceso total a seven_canvas_edges" on public.seven_canvas_edges;
create policy "Acceso seguro a seven_canvas_edges" on public.seven_canvas_edges
  for all using (
    exists (
      select 1 from public.seven_workspaces w
      where w.id = seven_canvas_edges.workspace_id
      and (
        w.is_public_shared = true
        or (
          auth.role() = 'authenticated'
          and public.is_user_active(auth.uid())
          and (w.is_private = false or w.user_id = auth.uid())
        )
      )
    )
  )
  with check (
    exists (
      select 1 from public.seven_workspaces w
      where w.id = seven_canvas_edges.workspace_id
      and (
        (w.is_public_shared = true and w.share_permission = 'edit')
        or (
          auth.role() = 'authenticated'
          and public.is_user_active(auth.uid())
          and public.get_my_role() != 'viewer'
          and (w.is_private = false or w.user_id = auth.uid())
        )
      )
    )
  );

-- F) COLECCIONES Y ETIQUETAS
drop policy if exists "Acceso total a seven_collections" on public.seven_collections;
create policy "Acceso total a seven_collections" on public.seven_collections
  for all to authenticated
  using (public.is_user_active(auth.uid()))
  with check (public.is_user_active(auth.uid()) and public.get_my_role() != 'viewer');

drop policy if exists "Acceso total a seven_tags" on public.seven_tags;
create policy "Acceso total a seven_tags" on public.seven_tags
  for all to authenticated
  using (public.is_user_active(auth.uid()))
  with check (public.is_user_active(auth.uid()) and public.get_my_role() != 'viewer');

-- ========================================================
-- 10. BUCKET DE ALMACENAMIENTO PARA ADJUNTOS
-- ========================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "Permitir subida y lectura pública en attachments" on storage.objects;
drop policy if exists "Lectura pública de attachments" on storage.objects;
create policy "Lectura pública de attachments"
  on storage.objects for select
  using (bucket_id = 'attachments');

drop policy if exists "Subida de attachments para usuarios autenticados" on storage.objects;
create policy "Subida de attachments para usuarios autenticados"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_user_active(auth.uid()));

drop policy if exists "Actualización de attachments propios" on storage.objects;
create policy "Actualización de attachments propios"
  on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (owner = auth.uid() or public.is_admin(auth.uid())))
  with check (bucket_id = 'attachments');

drop policy if exists "Eliminación de attachments propios" on storage.objects;
create policy "Eliminación de attachments propios"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (owner = auth.uid() or public.is_admin(auth.uid())));

-- ========================================================
-- 11. HABILITACIÓN DE SUPABASE REALTIME
-- ========================================================
do $$
begin
  alter publication supabase_realtime add table public.seven_workspaces, public.seven_canvas_nodes, public.seven_canvas_edges, public.seven_spaces, public.seven_collections, public.seven_tags, public.user_profiles;
exception
  when others then null;
end $$;
