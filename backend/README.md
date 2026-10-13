# Configuração do Supabase

1. Copie `backend/.env.example` para `backend/.env`.
2. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` com os dados do projeto Supabase.
3. Só preencha `SUPABASE_SERVICE_ROLE_KEY` para tarefas administrativas no servidor. Essa chave concede acesso elevado e nunca deve ser enviada ao navegador, versionada ou exibida em logs.

`backend/.env` é ignorado pelo Git. O helper `src/env.ts` lê o arquivo sem sobrescrever variáveis já definidas no ambiente e valida a URL e a chave pública antes da conexão.

O servidor `frontend/server.mjs` lê `backend/.env` ao iniciar e disponibiliza somente a URL do projeto e a chave anon no endpoint local `/api/config`. A chave `service_role` nunca é enviada ao navegador.

O login usa o Supabase Auth e exige um perfil ativo em `public.perfis_acesso`. O pedido de acesso cria apenas uma solicitação pendente; a conta precisa ser criada e liberada por uma pessoa administradora. O módulo de cadastros lê e grava os dados usando o token do usuário e as políticas RLS.

Antes de usar, aplique as migrations `001` a `005` em ordem no projeto Supabase. Depois reinicie o servidor com `npm start`. Não habilite cadastro público de usuários no Supabase Auth.
