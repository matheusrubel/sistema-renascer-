# Roteiro de testes — Sprint 3 (atendimentos e sigilo)

Use este roteiro para validar, com perfis reais, o que foi construído no Sprint 3. Marque cada item. Anote ao lado o que falhar (tela, perfil, mensagem de erro). **Use apenas dados fictícios.**

## 0. Preparação

- [ ] Migrations 006, 007, 008, 009 e 010 aplicadas (nessa ordem) e a API reiniciada.
- [ ] Quatro usuários criados em **Usuários e acessos**, um de cada perfil:
  - Coordenação (administrador)
  - Recepção
  - Psicologia
  - Serviço social
- [ ] Uma pessoa fictícia cadastrada em **Cadastros** (entre como Recepção ou Coordenação para criar).
- [ ] Use **janelas anônimas diferentes** (ou navegadores diferentes) para ficar logado em mais de um perfil ao mesmo tempo.

## 1. Menu e acesso por perfil

| Perfil | Cadastros | Relatórios | Atendimentos | Usuários |
|---|---|---|---|---|
| Coordenação | cria e edita | vê | vê só o social, leitura | **vê o item no menu** |
| Recepção | cria e edita | vê | **não acessa** (aviso) | não aparece |
| Psicologia | **só leitura** | vê | registra e vê o psicológico | não aparece |
| Serviço social | **só leitura** | vê | registra e vê o social | não aparece |

- [ ] **Coordenação:** em Atendimentos aparece o aviso "Como coordenação, você visualiza somente os atendimentos sociais" e **não** existe o botão "+ Novo atendimento".
- [ ] **Recepção:** em Atendimentos aparece o aviso "Seu perfil não acessa atendimentos" e nenhum registro é mostrado.
- [ ] **Psicologia e Serviço social:** em Cadastros não aparecem "+ Novo cadastro", editar e inativar (só imprimir ficha e termo).
- [ ] Acessar `/usuarios` com um perfil que não é Coordenação mostra "Somente a coordenação gerencia usuários".

## 2. Registrar atendimentos

- [ ] **Psicologia:** buscar a pessoa, clicar em "+ Novo atendimento", preencher data, hora, tipo, motivo, relato, combinados e **um encaminhamento** (CRAS). Salvar.
- [ ] O atendimento aparece no histórico com a marca "Psicológico", o nome da profissional e "versão 1 de 1".
- [ ] **Serviço social:** registrar um atendimento **social** para a mesma pessoa, com um encaminhamento.
- [ ] Tentar salvar sem motivo e sem relato mostra a mensagem pedindo ao menos um dos dois.

## 3. Quem vê o quê (sigilo)

Abra o histórico da mesma pessoa em cada perfil.

- [ ] **Psicologia** vê só o atendimento psicológico (o social **não** aparece).
- [ ] **Serviço social** vê só o atendimento social (o psicológico **não** aparece).
- [ ] **Coordenação** vê só o social, sem botões de editar.
- [ ] **Recepção** não vê nenhum atendimento.
- [ ] A busca por nome em Atendimentos mostra só nome e data de nascimento (nunca conteúdo de relato).

## 4. Correção em versões

- [ ] A profissional que escreveu vê o botão de corrigir (lápis) no próprio atendimento.
- [ ] Corrigir e salvar: o registro passa a "versão 2 de 2" e mostra o texto novo.
- [ ] Coordenação **não** vê o botão de corrigir no atendimento social.
- [ ] Verificar no Supabase que a versão 1 continua guardada (SQL na seção 9, consulta 3).

## 5. Encaminhamentos

- [ ] Trocar a situação (Encaminhado, Em andamento, Concluído, Sem retorno) funciona e permanece depois de recarregar.
- [ ] "Anotar retorno" (ícone de balão) abre o diálogo, salva o texto e ele aparece como "Retorno: …".
- [ ] A coordenação vê a situação do encaminhamento social, mas **não** consegue alterar.

## 6. Emitir histórico (Vara da Infância etc.)

- [ ] Em Psicologia ou Serviço social, "Emitir histórico" abre um diálogo pedindo o destinatário (obrigatório).
- [ ] Informar "Vara da Infância" abre a janela de impressão com o histórico da área, o nome de quem emitiu e o destinatário.
- [ ] Cancelar o diálogo não abre nada nem registra nada.
- [ ] A emissão aparece registrada no banco (SQL, seção 9, consulta 2).

## 7. Registro de acessos

- [ ] Depois de abrir o histórico de uma pessoa, aparece uma linha em `acessos_historico` com o usuário e a área (SQL, seção 9, consulta 1).

## 8. Acesso temporário (coordenação)

- [ ] Em Atendimentos (como Coordenação), no bloco "Acessos temporários": escolher a Recepção, área **Psicológico**, 1 dia, "Liberar".
- [ ] A Recepção passa a **ler** os atendimentos psicológicos da pessoa (e continua sem botões de registrar).
- [ ] "Revogar acesso" (ícone de escudo) remove o acesso e a Recepção volta a não ver nada.

## 9. Conferências no banco (SQL Editor)

```sql
-- 1. Quem abriu o histórico de quem, e quando
select a.acessado_em, p.nome, a.area
from public.acessos_historico a
left join public.perfis_acesso p on p.user_id = a.usuario_id
order by a.acessado_em desc limit 10;

-- 2. Emissões de histórico
select e.emitido_em, p.nome, e.area, e.destinatario
from public.emissoes_historico e
left join public.perfis_acesso p on p.user_id = e.emitido_por
order by e.emitido_em desc limit 10;

-- 3. Versões de cada atendimento (nada some)
select atendimento_id, versao, left(motivo, 40) as motivo, criado_em
from public.atendimento_versoes
order by atendimento_id, versao;
```

## 10. Tentativas de burla (as proteções valem no banco)

No navegador, logado como **Psicologia**, abra o console (F12 → Console) e cole um por vez:

```js
// a) Lista os atendimentos que o perfil consegue ler: só devem aparecer da área "psicologico"
const t = JSON.parse(sessionStorage.getItem("renascer.supabase.session")).access_token;
const h = { Authorization: `Bearer ${t}`, apikey: "server-managed", "Content-Type": "application/json" };
fetch("/api/supabase/rest/v1/atendimentos?select=id,area", { headers: h }).then(r => r.json()).then(console.log);
```
- [ ] Só aparecem atendimentos com `area: "psicologico"`.

```js
// b) Tentar apagar um atendimento (troque o id por um real): deve ser recusado
fetch("/api/supabase/rest/v1/atendimentos?id=eq.COLE_UM_ID", { method: "DELETE", headers: h }).then(r => console.log(r.status));
```
- [ ] A resposta **não** é 200/204 com o registro apagado (esperado: erro de permissão). O atendimento continua na tela depois de recarregar.

```js
// c) Tentar registrar um atendimento SOCIAL sendo psicóloga: deve ser recusado
fetch("/api/supabase/rest/v1/atendimentos", { method: "POST", headers: h,
  body: JSON.stringify({ pessoa_atendida_id: "COLE_O_ID_DA_PESSOA", area: "social" }) }).then(r => r.json()).then(console.log);
```
- [ ] Retorna erro (política de segurança), nada é criado.

## 11. Usuários e acessos

- [ ] **Desativar** a psicóloga: ela não consegue mais ver dados (e não entra de novo). **Reativar** devolve o acesso.
- [ ] "Nova senha" gera uma senha temporária mostrada uma única vez; o login com ela funciona e a troca de senha volta para a página inicial (não para `/usuarios`).
- [ ] Tentar desativar ou rebaixar o **único** administrador ativo é recusado.
- [ ] Você não consegue desativar a si mesmo pela tela.

## 12. Itens já validados antes (conferir só se algo mudar)

- [ ] Cadastro com foto e termo de consentimento (anexo assinado e "Ver assinado").
- [ ] Relatórios com filtros e exportação CSV.

## Resultado

| Seção | OK | Falhou | Observações |
|---|---|---|---|
| 1. Menu e acesso | | | |
| 2. Registrar | | | |
| 3. Sigilo | | | |
| 4. Versões | | | |
| 5. Encaminhamentos | | | |
| 6. Emitir histórico | | | |
| 7. Registro de acessos | | | |
| 8. Acesso temporário | | | |
| 9. Banco | | | |
| 10. Burla | | | |
| 11. Usuários | | | |

Depois dos testes, os cards 12, 13 e 14 do Trello podem ser marcados como concluídos. O card 15 depende das respostas da equipe ao documento da proposta.
