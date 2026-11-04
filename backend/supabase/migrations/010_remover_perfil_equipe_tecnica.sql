-- Remove o perfil "tecnico_social" (equipe técnica), que só existia por compatibilidade.
-- Os perfis vigentes são: admin, recepcao, psicologo e assistente_social.
-- Aplicar no SQL Editor do Supabase. Rode ANTES de publicar a versão nova do sistema.

-- Quem ainda tinha o perfil antigo passa a ser assistente social (o perfil técnico original era o do serviço social).
-- Depois, ajuste manualmente na tela de Usuários quem for psicóloga ou de outra função.
do $$
declare
  v_total integer;
begin
  select count(*) into v_total from public.perfis_acesso where papel = 'tecnico_social';
  update public.perfis_acesso set papel = 'assistente_social' where papel = 'tecnico_social';
  if v_total > 0 then
    raise notice '% usuário(s) do perfil antigo passaram a assistente_social. Revise em Usuários e acessos.', v_total;
  end if;
end $$;

alter table public.perfis_acesso drop constraint if exists perfis_acesso_papel_check;
alter table public.perfis_acesso add constraint perfis_acesso_papel_check
  check (papel in ('admin', 'recepcao', 'psicologo', 'assistente_social'));

-- As políticas antigas do cadastro ainda citam 'tecnico_social' em suas listas; sem usuários nesse perfil, não têm efeito.
