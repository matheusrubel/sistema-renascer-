-- Armazenamento privado de fotos de identificação e termos de consentimento assinados.
-- Aplicar no SQL Editor do Supabase depois da migration 005.
-- Caminhos usados pela aplicação:
--   fotos/{pessoa_atendida_id}/{uuid}.jpg|png
--   termos/{pessoa_atendida_id}/{uuid}.pdf|jpg|png

-- Bucket privado: sem URL pública, limite de 5 MB e somente tipos esperados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cadastros-privados',
  'cadastros-privados',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Somente a equipe autorizada lê, envia, substitui e remove arquivos deste bucket.
drop policy if exists "equipe autorizada le arquivos de cadastro" on storage.objects;
create policy "equipe autorizada le arquivos de cadastro"
on storage.objects for select to authenticated
using (
  bucket_id = 'cadastros-privados'
  and (select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social']))
);

drop policy if exists "equipe autorizada envia arquivos de cadastro" on storage.objects;
create policy "equipe autorizada envia arquivos de cadastro"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'cadastros-privados'
  and (select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social']))
);

drop policy if exists "equipe autorizada atualiza arquivos de cadastro" on storage.objects;
create policy "equipe autorizada atualiza arquivos de cadastro"
on storage.objects for update to authenticated
using (
  bucket_id = 'cadastros-privados'
  and (select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social']))
)
with check (
  bucket_id = 'cadastros-privados'
  and (select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social']))
);

drop policy if exists "equipe autorizada remove arquivos de cadastro" on storage.objects;
create policy "equipe autorizada remove arquivos de cadastro"
on storage.objects for delete to authenticated
using (
  bucket_id = 'cadastros-privados'
  and (select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social']))
);

-- Um termo só pode passar a "assinado" com o documento digitalizado anexado.
-- Registros antigos que já estavam assinados continuam editáveis sem documento.
-- A regra vale para usuários autenticados no sistema; cargas administrativas
-- (SQL Editor, seeds de dados fictícios) não têm auth.uid() e não são bloqueadas.
create or replace function public.exigir_documento_termo_assinado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and new.status = 'assinado'
     and new.documento_storage_path is null
     and (tg_op = 'INSERT' or old.status is distinct from 'assinado') then
    raise exception 'Anexe o termo assinado e digitalizado antes de marcá-lo como assinado.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists consentimentos_exigem_documento on public.consentimentos_cadastro;
create trigger consentimentos_exigem_documento
before insert or update on public.consentimentos_cadastro
for each row execute function public.exigir_documento_termo_assinado();
