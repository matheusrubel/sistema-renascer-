-- Garante que o sistema nunca fique sem um administrador ativo.
-- Vale para qualquer caminho: tela de usuários, SQL Editor ou API.
create or replace function public.proteger_ultimo_administrador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.papel = 'admin' and old.ativo
     and (tg_op = 'DELETE' or new.papel <> 'admin' or not new.ativo) then
    if not exists (
      select 1 from public.perfis_acesso p
      where p.papel = 'admin' and p.ativo and p.user_id <> old.user_id
    ) then
      raise exception 'O sistema precisa de ao menos um administrador ativo.' using errcode = '23514';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists perfis_protegem_ultimo_administrador on public.perfis_acesso;
create trigger perfis_protegem_ultimo_administrador
before update or delete on public.perfis_acesso
for each row execute function public.proteger_ultimo_administrador();
