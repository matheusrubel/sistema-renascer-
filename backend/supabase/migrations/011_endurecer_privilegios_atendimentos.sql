-- Segunda camada de proteção para os registros de atendimento.
-- O Supabase concede privilégios amplos ao papel "authenticated" por padrão; hoje a imutabilidade
-- depende apenas de não existirem políticas de UPDATE e DELETE (RLS). Aqui os privilégios também são retirados.
-- Aplicar no SQL Editor depois da migration 010. É segura para repetir.

-- O papel anônimo nunca acessa estas tabelas.
revoke all on table
  public.atendimentos, public.atendimento_versoes,
  public.encaminhamentos, public.encaminhamento_eventos,
  public.acessos_historico, public.emissoes_historico,
  public.acessos_temporarios, public.tipos_atendimento, public.destinos_encaminhamento
from anon;

-- Registros de atendimento são imutáveis: só consulta e inclusão. Correções entram como nova versão.
revoke update, delete, truncate on table
  public.atendimentos, public.atendimento_versoes,
  public.encaminhamentos, public.encaminhamento_eventos,
  public.acessos_historico, public.emissoes_historico
from authenticated;

-- Acessos temporários e catálogos podem ser alterados (revogar, desativar), mas nunca apagados em massa.
revoke delete, truncate on table
  public.acessos_temporarios, public.tipos_atendimento, public.destinos_encaminhamento
from authenticated;

notify pgrst, 'reload schema';
