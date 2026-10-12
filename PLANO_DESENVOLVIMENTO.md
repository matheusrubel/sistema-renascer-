# Plano de desenvolvimento — Sistema Instituto Renascer

## Direção do projeto

Desenvolver um sistema web próprio, sob domínio e propriedade do Instituto, que integre as informações sociais e administrativas hoje mantidas em fichas impressas, cadernos e planilhas. Os dados sociais alimentam também relatórios e prestação de contas dos projetos; por isso, os módulos precisam compartilhar cadastros e regras de acesso.

Este plano foi organizado a partir da transcrição e do resumo da reunião, além do protótipo atual em `backend/src/cadastro.ts`. A reunião definiu começar pelo fluxo de entrada/cadastro, que já tem processo mais claro, e evoluir módulo por módulo com demonstrações e validações periódicas da equipe do Instituto. Não há prazos neste plano.

## Divisão entre dois desenvolvedores

Os dois desenvolvedores trabalham em incrementos integrados: cada módulo deve ter interface utilizável, persistência, permissões e validação com a equipe.

- **Desenvolvedor A — backend, dados e infraestrutura:** arquitetura de dados, Supabase, autenticação e permissões, regras de negócio, armazenamento, consultas, integrações, relatórios, segurança e publicação da camada de dados.
- **Desenvolvedor B — frontend e experiência de uso:** fluxos e telas, formulários, navegação, listas, gráficos, exportação e impressão na interface, responsividade, acessibilidade e integração com os serviços do backend.
- **Compartilhado:** refinamento dos requisitos de cada módulo com a equipe correspondente do Instituto, desenho dos contratos entre interface e dados, revisão de código, demonstração, ajustes e documentação.

## Etapa 1 — Preparação e arquitetura

### Trabalho conjunto

- Reunir os materiais citados na reunião: fichas e planilhas atuais (podem ser fictícias), modelos de controle financeiro e de estoque, termo de consentimento, referências de sistemas, prints, logo, paleta de cores e calendário institucional.
- Organizar requisitos e campos por módulo, identificando o fluxo atual, quem usa cada parte e quais relatórios precisam sair dela.
- Criar um grupo/canal de comunicação com representantes do Instituto e combinar validações curtas ao concluir cada módulo.
- Desenhar arquitetura e navegação que permitam módulos relacionados compartilharem cadastros, projetos, pessoas e relatórios sem misturar permissões sigilosas.
- Definir ambientes de desenvolvimento, homologação e produção, fluxo Git, revisão de mudanças, configuração local e documentação de execução.
- Escolher framework e linguagem considerando manutenção pela equipe, hospedagem e custo baixo. O protótipo existente é Node.js com TypeScript e execução em terminal; avaliar sua evolução ou substituição como aplicação web.

### Desenvolvedor A — dados e Supabase

- Criar o projeto Supabase e ambientes, mantendo o projeto e as contas sob controle do Instituto/equipe responsável.
- Planejar migrations versionadas, dados de referência, backups, região, custos e limites do plano escolhido.
- Desenhar modelo comum para cadastros, usuários, atividades, atendimentos, projetos, doações e estoque, aprofundando cada domínio antes da implementação.
- Configurar autenticação e perfis de acesso. Aplicar autorização também no banco (RLS), em especial no conteúdo social e psicológico.
- Separar segredos por ambiente; manter chaves administrativas fora do frontend.
- Definir o que ficará no banco e o que será armazenado em espaço de arquivos; a reunião prevê principalmente dados textuais, com necessidade eventual de imagens e documentos institucionais.

### Desenvolvedor B — interface e experiência

- Criar estrutura da aplicação, navegação por módulos e identidade visual com os materiais do Instituto.
- Preparar componentes comuns para formulários, tabelas/listas, busca, filtros, confirmação, mensagens, carregamento e erros.
- Implementar layout responsivo e acessível, com interface em português e linguagem adequada à equipe.
- Prototipar o fluxo inicial de recepção/cadastro e validar o protótipo com a equipe antes de fechar detalhes visuais.

**Entrega da etapa:** arquitetura acordada, ambientes funcionando, Supabase inicializado, identidade e navegação base prontas e primeiro fluxo desenhado.

## Etapa 2 — Cadastro e recepção (primeiro módulo)

Este é o ponto de partida definido na reunião. O objetivo é registrar a entrada de crianças e famílias, com dados que depois possam ser usados nos atendimentos, atividades e estatísticas.

### Escopo funcional

- Registrar pré-cadastro com dados pessoais básicos mencionados: nome, escola, idade/data de nascimento, foto e RG; confirmar com a ficha atual os demais campos, como NIS, endereço, telefone, responsáveis e composição familiar.
- Registrar origem/encaminhamento (por exemplo, escola, Conselho Tutelar ou outra instituição), motivo de busca e situação prioritária da criança.
- Registrar benefícios e atividades escolhidas, incluindo dia/horário quando aplicável, para uso nos módulos seguintes.
- Permitir consultar cadastro por nome, corrigir informações e manter dados organizados para gerar listas, tabelas e gráficos.
- Imprimir ficha inicial para identificação, conforme o processo descrito na reunião.
- Anexar foto da criança. Digitalização e guarda de documentos pessoais das famílias não é requisito inicial confirmado; a equipe indicou que pode manter esses documentos separados e impressos.
- Gerar/registrar termo de consentimento a partir do modelo revisado pelo Instituto; definir assinatura e guarda do documento com a equipe.

### Desenvolvedor A

- Modelar pessoa atendida, responsável/família, origem e motivo de encaminhamento, situação prioritária, benefícios e escolhas de atividades, evitando duplicar a pessoa quando ela aparecer em outros módulos.
- Definir campos obrigatórios, validações, identificadores, possíveis duplicidades e histórico de alterações com base na ficha revisada.
- Criar persistência, busca por nome e operações de criar, consultar, editar e inativar.
- Configurar upload privado da foto e termo, se aprovado, com controle de acesso e limites de arquivo.
- Garantir que consultas e armazenamento respeitem as permissões institucionais.

### Desenvolvedor B

- Implementar formulário de pré-cadastro dividido por seções, campos condicionais e validação clara.
- Criar pesquisa por nome, listagem, detalhe, edição e impressão da ficha.
- Implementar seleção de atividade/dia/horário e listas de benefícios/situações conforme os catálogos validados.
- Criar gráficos e tabelas iniciais a partir dos dados cadastrados: faixa etária, sexo, território, escola, situação prioritária e motivo de encaminhamento, com filtros e seleção dos dados a exportar.
- Fazer revisão do fluxo com recepção/equipe social e ajustar conforme a validação.

**Entrega da etapa:** equipe consegue cadastrar, localizar, corrigir e imprimir um pré-cadastro, com dados reaproveitáveis pelos módulos seguintes.

## Etapa 3 — Atendimentos sociais e psicológicos

Registrar atendimentos individuais e encaminhamentos feitos por assistente social e psicóloga, permitindo consulta do histórico por nome quando necessário, inclusive para responder solicitações da Vara da Infância.

### Desenvolvedor A

- Modelar registros de atendimento com profissional, área, data, tipo, encaminhamentos e conteúdo definido pela equipe técnica.
- Definir perfis e regras para que registros psicológicos e outros dados sigilosos só sejam acessíveis às pessoas autorizadas; validar políticas diretamente no Supabase.
- Criar histórico consultável por pessoa atendida, com acesso mínimo necessário e trilha de alterações pertinente.
- Prevenir exposição de conteúdo em logs, notificações, buscas gerais e relatórios sem autorização.

### Desenvolvedor B

- Criar área de atendimentos individuais, busca e histórico.
- Restringir navegação e ações visualmente conforme o perfil, além da proteção efetiva no backend.
- Implementar formulário de registro e visualização dos encaminhamentos.
- Validar o fluxo com assistente social e psicóloga, incluindo o que outros profissionais podem ou não visualizar.

**Entrega da etapa:** profissionais registram e consultam atendimentos conforme o sigilo definido pelo Instituto.

## Etapa 4 — Atividades, turmas, frequência e diário

As crianças escolhem atividades no cadastro; a partir dessas escolhas, o sistema deve apoiar a formação de turmas por atividade, dia e horário.

### Desenvolvedor A

- Modelar atividades, turmas, horários, educadores e vínculos das pessoas atendidas, preservando histórico de alterações e encerramento.
- Criar formação/organização de turmas e geração da lista de frequência por turma e encontro.
- Criar registro de planejamento e diário das atividades, autoria, data e associação a turma/projeto.
- Preparar saída consolidada para relatório final do grupo, com registros e fotos autorizadas.

### Desenvolvedor B

- Criar telas de atividades, organização das turmas, horários e lista de participantes.
- Construir interface prática para educadores consultarem e marcarem presença/ausência.
- Implementar registro do planejamento e diário por encontro, com inclusão de fotos se aprovada e permitida.
- Criar visualização e impressão/exportação do relatório final das atividades.

**Entrega da etapa:** educadores encontram suas turmas, registram frequência e atividades, e a equipe consegue produzir o relatório do período.

## Etapa 5 — Estoque, doações recebidas e bazar

Controlar entradas e saídas de alimentos e itens diversos, contemplando os destinos mencionados: uso próprio da instituição, doação a famílias, bazar/venda e descarte. Os tipos e destinos devem ser configuráveis para incluir novas categorias no futuro.

### Desenvolvedor A

- Modelar itens/categorias, unidades, entradas, movimentações, origem da doação, quantidade, destino e responsável.
- Implementar saldo calculado a partir das movimentações, com registro de ajustes e justificativa para conciliação entre estoque físico e sistema.
- Controlar validade de perecíveis e gerar alertas de vencimento próximo e produto vencido.
- Definir filtros e relatórios de entrada, saída, saldo, destino e validade.

### Desenvolvedor B

- Criar cadastro de categorias/itens e formulário de entrada de doação.
- Implementar saídas com seleção de destino: consumo interno, família, bazar/venda ou descarte.
- Criar visão de saldo e alertas de validade fáceis de acompanhar pela equipe.
- Construir consultas e relatórios para inventário físico e conferência periódica.

**Entrega da etapa:** cada movimentação tem origem e destino identificados, e o saldo pode ser conciliado com os itens físicos.

## Etapa 6 — Financeiro e gestão de projetos

Controlar entradas e saídas por projeto/termo e centro de custo, com contas bancárias associadas aos projetos, valores previstos, vigência e distribuição de despesas. O modelo deve permitir que uma despesa, como remuneração de uma pessoa da equipe, seja repartida entre projetos/centros de custo conforme regras fornecidas pelo Instituto.

### Desenvolvedor A

- Validar com a equipe os modelos de planilha e documentos atuais, campos e regras de prestação de contas antes de definir o modelo financeiro.
- Modelar projetos/termos, conta associada, período, orçamento/valor previsto, categorias de receita e despesa, centros de custo, lançamentos e rateios.
- Implementar validação de rateios e somatórios, saldo por projeto e relatórios consolidados sem perder a origem de cada recurso.
- Criar alertas de encerramento próximo do projeto quando ainda existir saldo, apoiando análise de termo aditivo.
- Registrar alterações e permitir fechamento/arquivamento do projeto mantendo os dados para relatórios futuros.

### Desenvolvedor B

- Criar cadastro e acompanhamento de projetos: finalidade, conta, valor, início, prazo e situação.
- Construir telas para lançar receitas/despesas, classificar por centro de custo e distribuir valores entre projetos.
- Criar visão de valores previstos, realizados, saldo e prazo, com alertas de projetos próximos do fim e saldo disponível.
- Construir relatórios para prestação de contas e análises de entradas/despesas por projeto, período e centro de custo.

**Entrega da etapa:** equipe acompanha execução e saldo por projeto e obtém dados organizados para prestação de contas.

## Etapa 7 — Doadores, parceiros e prospecção

Manter uma base compartilhada de empresas e parceiros, com contatos, histórico de vínculo, tipos de doação, sazonalidade e empresas prospectadas.

### Desenvolvedor A

- Modelar parceiros, contatos, interações, doações e prospecções, incluindo período e campanha/época (por exemplo, Páscoa e Dia das Crianças).
- Criar busca e filtros por nome, período, tipo de doação e sazonalidade.
- Relacionar doações recebidas ao parceiro e, quando adequado, ao estoque ou projeto sem duplicar registro.

### Desenvolvedor B

- Criar cadastro e histórico do parceiro, com contatos e anotações de relacionamento.
- Implementar filtros por período e época, visualização das doações anteriores e situação de prospecção.
- Criar lista de acompanhamento para potenciais parceiros e próximos contatos, conforme processo definido pela equipe.

**Entrega da etapa:** equipe consulta o histórico institucional e identifica parceiros recorrentes e potenciais doadores.

## Etapa 8 — Inventário patrimonial

Centralizar o inventário hoje dividido em planilhas, mantendo informações úteis para a equipe ao longo do tempo.

### Desenvolvedor A

- Modelar bens permanentes com descrição, categoria, origem/projeto, valor de referência, nota fiscal/documento, data de entrada, localização e situação.
- Implementar histórico de movimentação e regras para baixa/transferência, preservando informação de origem e período de permanência.
- Configurar documentos anexos em espaço privado se o Instituto confirmar a necessidade.

### Desenvolvedor B

- Criar cadastro, consulta e edição dos bens.
- Criar filtros e relatórios de inventário por categoria, origem/projeto, localização e situação.
- Facilitar conferência do patrimônio e consulta por pessoas autorizadas.

**Entrega da etapa:** inventário institucional compartilhado e consultável, com origem e documentos relacionados.

## Etapa 9 — Captação de recursos

A reunião apresentou esta frente como uma ideia ainda em amadurecimento. Deixar a estrutura preparada para uma etapa posterior, sem bloquear os módulos definidos anteriormente.

- Em conjunto com o Instituto, definir o que significa meta de captação, campanha, valor arrecadado, período e responsável.
- Relacionar campanhas a doadores e doações, evitando duplicar os registros financeiros e de parceiros.
- Desenvolvedor A implementa modelo, apuração de metas e valores; Desenvolvedor B cria painel/gráficos de meta versus arrecadação.
- Validar os indicadores e a forma de atualização com a equipe antes de liberar o módulo.

## Etapa 10 — Relatórios, gráficos e exportação

Os gráficos e relatórios devem ser construídos junto aos módulos de origem e consolidados ao final, para atender aos usos sociais, administrativos e de prestação de contas.

- Disponibilizar dados em gráficos e tabelas, com filtros e seleção das informações a incluir.
- Exportar para Excel e PDF conforme solicitado na reunião; produzir também fichas e relatórios imprimíveis necessários aos fluxos.
- Cobrir dados sociais: faixa etária, sexo, território, escola, benefícios, situação prioritária e motivo de encaminhamento.
- Cobrir frequência/atividades e atendimentos conforme as permissões de cada perfil.
- Cobrir estoque, projetos, centros de custo, doações e inventário em seus respectivos relatórios.
- Desenvolvedor A prepara consultas e agregações com controle de acesso; Desenvolvedor B implementa filtros, tabelas, gráficos, impressão e exportação.
- Validar amostras com a equipe e comparar os números com planilhas atuais antes de usar os relatórios para prestação de contas.

## Etapa 11 — LGPD, segurança e documentos

- Revisar com o Instituto o termo de consentimento atual e definir o texto de uso/guarda dos dados; a reunião prevê geração do termo pelo sistema, impressão, assinatura e arquivamento digitalizado.
- Definir consentimento e acesso para dados de crianças/famílias, incluindo quais informações podem ser usadas em relatórios e atividades institucionais.
- Aplicar controle de acesso por função, com sigilo reforçado para psicologia e atendimentos sociais.
- Usar dados fictícios em desenvolvimento e demonstrações; restringir exportações aos dados necessários.
- Configurar armazenamento privado para fotos e documentos institucionais autorizados, controlar download e evitar links públicos permanentes.
- Definir trilhas de auditoria, política de correção/inativação, backups e procedimento para incidentes e recuperação.
- Revisar o fluxo de frequência e eventual assinatura/identificação da criança; a própria equipe indicou que precisa verificar essa regra internamente.

**Desenvolvedor A:** controles de banco, autenticação, RLS, storage, auditoria, backup e acesso. **Desenvolvedor B:** consentimento e estados de acesso na interface, minimização de dados exibidos e fluxos de exportação/impressão.

## Etapa 12 — Hospedagem, domínio e propriedade

- Manter o sistema sob domínio do Instituto; avaliar uso de subdomínio do site institucional para reduzir custo.
- Comparar opções de hospedagem e banco, priorizando custo baixo/gratuito na fase de desenvolvimento e custo sustentável em produção.
- Configurar domínio, HTTPS, ambientes, variáveis e processo de publicação.
- Garantir que código, dados, domínio e contas necessárias à operação fiquem sob responsabilidade acordada com o Instituto.
- Documentar como instalar e configurar uma nova instância/base caso o sistema venha a ser replicado para outra instituição, preservando dados e identidade visual separados.
- Documentar custos recorrentes de banco, arquivos, domínio, hospedagem e serviços adicionais.

## Etapa 13 — Validação, publicação, treinamento e transição

### A cada módulo

- Apresentar demonstrativo à equipe usuária responsável, colher ajustes e aprovar critérios de aceite antes de avançar para módulos que dependam dele.
- Conferir permissões com usuários de cada função, incluindo tentativas de acessar dados sigilosos fora do perfil.
- Validar relatórios com dados fictícios e reconciliar com o processo/planilha atual.

### Antes da publicação

- Testar fluxos completos: entrada, cadastro, atendimentos, atividades/frequência, estoque, projetos/financeiro, doadores e inventário, conforme forem concluídos.
- Conferir segurança, erros, recuperação de senha, acessibilidade, uso em telas disponíveis e exportações.
- Se houver importação de dados, mapear e limpar as planilhas, importar primeiro em homologação, conferir amostras com o Instituto e então aprovar a carga de produção.
- Configurar produção, domínio, backup, monitoramento e processo de recuperação.

### Encerramento

- Treinar a equipe para alimentar e consultar o sistema, como previsto na reunião.
- Entregar manual de uso por módulo, documentação técnica, modelo de dados, instruções de deploy, backup, gestão de usuários e suporte.
- Registrar aceite dos responsáveis, itens de evolução e responsáveis pela manutenção e operação.

## Critérios para considerar o projeto concluído

- Os módulos descritos na reunião foram entregues ou explicitamente organizados como evolução posterior, incluindo a captação que ainda está em amadurecimento.
- Cadastros sociais e dados administrativos se relacionam para relatórios sem duplicação e sem quebrar o sigilo.
- Atendimentos psicológicos/sociais têm acesso restrito validado no banco e na aplicação.
- Movimentações de estoque podem ser conferidas com o físico, incluindo validade e destinos.
- Projetos têm orçamento, período, entradas/saídas, rateio/centro de custo, saldo e alertas necessários.
- Relatórios atendem usos operacionais e prestação de contas, com exportação Excel/PDF e seleção de dados.
- Sistema está publicado sob domínio do Instituto, com contas, backups e documentação de operação transferidos.
- Equipe recebeu treinamento e validou os fluxos em demonstrações periódicas.

## Materiais de referência usados

- `Transcricao_Completa_Reuniao_Instituto_Renascer.pdf`
- `Resumo_Reuniao_Instituto_Renascer.pdf`
- `Instituto Renascer Backlog.pdf`
- Protótipo inicial: `backend/src/cadastro.ts`

