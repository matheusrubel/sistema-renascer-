# Sistema Renascer

Sistema institucional para cadastro e recepção do Instituto de Ação Social Renascer.

## O que está implementado

- Aplicacao web em Next.js, React, TypeScript e Tailwind CSS.
- API NestJS com verificacao de saúde e encaminhamento seguro ao Supabase.
- Login institucional com perfil ativo, solicitação de acesso e recuperacao de senha.
- Cadastro em sete etapas, consulta, edição, busca, filtros por idade e prioridade, impressao e exportacao CSV.
- Inativacao e reativação de cadastros sem apagar o histórico.
- Relatórios agregados sobre cadastros ativos, faixa etária, sexo informado e forma de entrada.
- Persistencia atomica do cadastro e vinculos atraves da função SQL versionada.
- Controle de acesso no banco por Row Level Security (RLS).

Atendimentos sociais e psicológicos, atividades e frequência, estoque, financeiro, parceiros e patrimonio continuam fora do escopo implementado. O plano de desenvolvimento registra esses módulos, mas eles dependem de regras, formularios e permissões validados pelo Instituto. A navegacao apresenta somente telas implementadas.

## Requisitos

- Node.js 20 ou superior.
- Projeto Supabase configurado.
- Perfil institucional ativo para cada usuario da equipe.

## Configuração local

1. Instale as dependências na raiz do repositório:

   ```bash
   npm install
   ```

2. Copie `backend/.env.example` para `backend/.env` e informe `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Nunca coloque a chave `SUPABASE_SERVICE_ROLE_KEY` no frontend.
3. Execute as migrations `001` a `005`, em ordem, no SQL Editor do Supabase.
4. Crie ou convide usuários pelo Supabase Auth. Insira o UUID, nome e papel do primeiro administrador em `public.perfis_acesso`; o exemplo está comentado ao final da migration `001`.
5. Inicie os dois servicos:

   ```bash
   npm run dev
   ```

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001/api` (status da API)
- Health check: `http://localhost:3001/api/health`

A seed `backend/supabase/seeds/001_dados_mock.sql` e opcional e serve somente para desenvolvimento. Ela cria registros fictícios no banco; não execute em produção.

## Comandos

- `npm run dev`: inicia Next.js e NestJS em conjunto.
- `npm run build`: compila frontend e backend.
- `npm run start`: inicia os builds de produção.

Em hospedagem, configure `API_URL` no ambiente do frontend e `WEB_ORIGIN` no backend. `PORT`, `HOST` e `SUPABASE_URL`/`SUPABASE_ANON_KEY` tambem devem ser definidos conforme o ambiente.

## Estrutura

- `frontend/app`: rotas, telas e componentes React.
- `frontend/src/supabase.ts`: chamadas de autenticacao e persistencia.
- `frontend/public`: arquivos estáticos usados pela interface.
- `backend/src`: API NestJS e carregamento de configuração.
- `backend/supabase/migrations`: schema, políticas RLS e operacoes atomicas.
- `backend/supabase/seeds`: dados demonstrativos opcionais.
- `PLANO_DESENVOLVIMENTO.md`: escopo futuro e dependências de validação com o Instituto.

O sistema nao envia fotos nem armazena documentos assinados. Esses fluxos precisam de configuração de armazenamento privado e validação institucional antes de serem habilitados.
