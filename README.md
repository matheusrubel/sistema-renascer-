# Sistema Renascer

Módulo institucional de cadastro e recepção. Inclui autenticação Supabase, controle de acesso por perfil, cadastro de pessoas e famílias, vínculos com responsáveis, benefícios, atividades, programas e consentimentos.

## Executar

Requer Node.js 18 ou superior. Configure `backend/.env` com `SUPABASE_URL` e `SUPABASE_ANON_KEY`, aplique as migrations e inicie o servidor:

```bash
npm start
```

Abra o endereço local exibido no terminal, normalmente `http://127.0.0.1:4173`.

## Configurar o Supabase

1. Aplique, nesta ordem, os arquivos em `backend/supabase/migrations/` (`001` a `005`).
2. Crie a conta inicial no Supabase Authentication.
3. Como administradora, inclua o UUID dessa conta em `public.perfis_acesso` com o papel `admin`.
4. Entre no sistema e crie os demais perfis pela área administrativa do Supabase.

O pedido de cadastro de usuário fica pendente e não cria uma conta automaticamente. Não habilite o cadastro público no Supabase Auth. A chave `SUPABASE_SERVICE_ROLE_KEY` não é necessária para o uso da aplicação e nunca deve ser disponibilizada no navegador.

O caminho `/?visualizar=mockados` mostra somente dados fictícios em memória para prévia visual. Esses registros não são enviados ao Supabase.

Fotos e documentos assinados ainda não são enviados ao Storage. Configure um bucket privado e políticas específicas antes de habilitar esses uploads. O texto do termo de consentimento deve ser fornecido e aprovado pelo Instituto.
