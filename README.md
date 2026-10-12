# Sistema Renascer — módulo de cadastro e recepção

Prévia navegável do primeiro módulo, com formulário em etapas para crianças, adolescentes e famílias, consulta, filtros, edição, impressão de ficha e exportação CSV da sessão.

## Executar a prévia

Requer Node.js 18 ou superior. Na pasta do projeto, execute:

```bash
npm start
```

Abra o endereço local exibido no terminal (por padrão, `http://127.0.0.1:4173`). A prévia não precisa de dependências adicionais.

Os cadastros ficam apenas na memória da aba e são apagados ao recarregar ou fechar. Não insira dados reais ou sensíveis nesta prévia. Ela ainda não autentica usuários nem se conecta ao Supabase.

## Supabase

A migration inicial está em [`backend/supabase/migrations/001_cadastro_entrada.sql`](backend/supabase/migrations/001_cadastro_entrada.sql). Ela cria perfis de acesso, famílias, pessoas atendidas, responsáveis, catálogos de atividades/benefícios e vínculos, com políticas RLS.

Revise a migration e os papéis com a equipe responsável antes de executar no projeto Supabase. Após criar uma conta em Authentication, um administrador precisa inserir o UUID da conta em `public.perfis_acesso` usando o SQL Editor administrativo. Não habilite cadastro público de usuários.

Fotos e documentos assinados usam apenas campos para seus caminhos no Storage; ainda é necessário criar bucket privado e políticas antes de habilitar uploads. O termo jurídico não foi incluído porque a reunião diz que o Instituto ainda revisaria/forneceria o texto. A conexão entre a interface e o Supabase, assim como login e controle de sessão, também é uma etapa posterior.

## Protótipo anterior

O código da interface está em `frontend/`. O código e os recursos do backend ficam em `backend/`.

Para executar o protótipo de cadastro em terminal:

```bash
npm run cadastro:terminal
```
