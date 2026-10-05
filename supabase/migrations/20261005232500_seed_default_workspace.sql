-- ============================================================
-- Default workspace for initial Prospect Intelligence MVP
-- ============================================================

insert into public.workspaces (
  id,
  name
)
values (
  '00000000-0000-0000-0000-000000000001',
  'DesireTech Default Workspace'
)
on conflict (id) do nothing;