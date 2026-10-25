# Dominando Node.js

API REST para gerenciar usuários, clientes e contatos, com autenticação JWT,
upload de arquivos e envio de emails em background usando Redis e Bee-Queue.

## Tecnologias

| Área | Ferramentas |
| --- | --- |
| API | Node.js, Express 5 e Sucrase |
| Banco | PostgreSQL, Sequelize e Sequelize CLI |
| Autenticação | JWT e bcrypt |
| Validação e datas | Yup e date-fns |
| Arquivos | Multer com armazenamento em disco |
| Emails e filas | Nodemailer, Bee-Queue e Redis |
| Configuração e monitoramento | dotenv, Sentry e logs JSON |
| Verificação | Node Test Runner e ESLint |

## Requisitos

- Node.js 24 para executar os comandos e testes descritos abaixo.
- Yarn Classic para instalar as dependências a partir do `yarn.lock`.
- PostgreSQL e Redis disponíveis localmente ou em serviços externos.
- Credenciais SMTP para enviar emails reais.
- Projeto no Sentry, caso queira ativar o monitoramento externo.

Execute os comandos a partir da raiz do repositório. No PowerShell, se a política
de execução bloquear `yarn.ps1`, `npm.ps1` ou `npx.ps1`, use `yarn.cmd`, `npm.cmd`
e `npx.cmd`, respectivamente.

## Instalação e configuração

Instale as dependências:

```sh
yarn install --frozen-lockfile
```

Copie o exemplo de configuração, sem sobrescrever um `.env` que já contenha suas
credenciais. No PowerShell:

```powershell
Copy-Item .env.example .env
```

No Linux/macOS:

```sh
cp .env.example .env
```

Edite os valores do `.env`, principalmente `DB_PASSWORD`, `AUTH_SECRET` e as
credenciais SMTP. Os valores do arquivo de exemplo são ilustrativos.
Para gerar um segredo de autenticação:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copie o resultado para `AUTH_SECRET`. O `.env` é ignorado pelo Git. O dotenv carrega
o arquivo para API, worker e Sequelize CLI; variáveis já definidas no ambiente
têm prioridade. Reinicie os processos após mudar a configuração.

### Variáveis de ambiente

| Variável | Finalidade / padrão |
| --- | --- |
| `NODE_ENV` | `development`, `test` ou `production`; padrão `development` |
| `PORT` | Porta HTTP; `3000` |
| `DB_HOST` / `DB_PORT` | PostgreSQL; `localhost` / `5432` |
| `DB_USER` / `DB_PASSWORD` | Usuário e senha do banco; usuário padrão `postgres` |
| `DB_NAME` | Nome do banco; `dominando-nodejs` |
| `AUTH_SECRET` | Segredo usado para assinar e verificar JWT; obrigatório |
| `AUTH_EXPIRES_IN` | Validade do token; `7d` |
| `MAIL_HOST` / `MAIL_PORT` | Servidor SMTP; porta padrão `587` |
| `MAIL_SECURE` | `true` ou `false`; se omitida, é `true` para porta `465` |
| `MAIL_USER` / `MAIL_PASS` | Credenciais SMTP; informe ambas ou nenhuma para SMTP sem autenticação |
| `MAIL_FROM_NAME` | Nome do remetente; `Dominando Node.js` |
| `MAIL_FROM_EMAIL` | Endereço do remetente; necessário para enviar emails |
| `REDIS_HOST` / `REDIS_PORT` | Redis; `localhost` / `6379` |
| `REDIS_DB` / `REDIS_PASSWORD` | Banco lógico (`0`) e senha opcional do Redis |
| `QUEUE_CONCURRENCY` | Jobs simultâneos por fila e por worker; `2`, entre 1 e 20 |
| `BULK_MAIL_CONCURRENCY` | Concorrência da fila de emails em lote; `2`, entre 1 e 20 |
| `QUEUE_RETRIES` | Novas tentativas por job; `3`, entre 0 e 100 |
| `QUEUE_BACKOFF_MS` | Espera inicial das tentativas exponenciais; `1000` ms |
| `QUEUE_SHUTDOWN_TIMEOUT_MS` | Tempo de encerramento das filas; `30000` ms |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` ou `silent`; `info` |
| `SENTRY_ENABLED` | Ativa Sentry; padrão `true` em produção, `false` nos demais ambientes |
| `SENTRY_DSN` | DSN do projeto Sentry; sem ele não há envio de eventos |
| `APP_RELEASE` | Identificador opcional da versão implantada |

O `.env.example` define `SENTRY_ENABLED=false`: altere para `true` quando quiser
ativar a integração em produção. `MODE_ENV` permanece como alternativa legada a
`NODE_ENV`, mas prefira `NODE_ENV` em novas configurações.

## Banco de dados

Com o PostgreSQL disponível e o `.env` preenchido, crie o banco e aplique as migrations:

```sh
npx sequelize-cli db:create
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:status
```

Se o banco já existir, pule `db:create`. A configuração de caminhos está em
[.sequelizerc](.sequelizerc).

Opcionalmente, insira quatro clientes de exemplo:

```sh
npx sequelize-cli db:seed --seed 20261006223000-demo-customers.js
```

O seed usa emails únicos; repeti-lo com os mesmos registros presentes causa
conflito. Não há criação automática de usuários: use `POST /users`.

As tabelas principais são `users`, `customers`, `contacts` e `files`.
Um cliente possui contatos por `customer_id`. Usuários podem referenciar arquivos
por `files_id`. Os models expõem `createdAt` e `updatedAt`, mapeados para
`created_at` e `updated_at` no banco.

## Executar API e worker

Inicie a API em um terminal:

```sh
npm run dev
```

Em outro terminal, com o Redis disponível, inicie o worker:

```sh
npm run queue
```

A URL padrão da API é `http://localhost:3000`. O worker é um processo separado e
deve continuar ativo para enviar emails. Em desenvolvimento, `npm run queue:dev`
reinicia o worker automaticamente ao editar o código.

| Comando | Uso |
| --- | --- |
| `npm run dev` | API com Nodemon e Sucrase |
| `npm run queue` | Worker sem reinício automático |
| `npm run queue:dev` | Worker com Nodemon |
| `npm run playground` | Experimentos em `src/playground.js`; pode alterar dados |
| `npm test` | Testes automatizados |
| `npm run lint` | Verificações ESLint, sem cobrança de formatação Prettier |

O projeto ainda não define script `start` nem etapa de build para produção.
Para executar a API sem Nodemon com as ferramentas instaladas:

```sh
npx sucrase-node src/server.js
```

## Autenticação e rotas

Somente `POST /users` e `POST /sessions` são públicas. Nas demais rotas, envie:

```http
Authorization: Bearer SEU_TOKEN
```

O middleware verifica a assinatura, a expiração e a existência do usuário.

| Método | Rota | Comportamento |
| --- | --- | --- |
| POST | `/users` | Cadastrar usuário e agendar email de boas-vindas |
| POST | `/sessions` | Validar credenciais e retornar usuário e token |
| GET | `/users` | Listar usuários sem senha ou hash |
| GET | `/users/:id` | Consultar usuário |
| PUT | `/users/:id` | Alterar o próprio usuário |
| DELETE | `/users/:id` | Excluir o próprio usuário |
| GET / POST | `/customers` | Listar / criar clientes |
| GET / PUT / DELETE | `/customers/:id` | Consultar / atualizar / excluir cliente |
| GET / POST | `/contacts` | Listar / criar contatos |
| GET / PUT / DELETE | `/contacts/:id` | Consultar / atualizar / excluir contato |
| POST | `/file` | Fazer upload de um arquivo |
| POST | `/emails/bulk` | Agendar emails em lote |

### Cadastrar usuário e entrar

`POST /users`, com `Content-Type: application/json`:

```json
{
  "name": "Ana Silva",
  "email": "ana@example.com",
  "password": "minhasenha123",
  "confirmPassword": "minhasenha123"
}
```

Nome, email, senha e confirmação são obrigatórios. A senha deve ter de 8 a 128
caracteres conforme o schema atual; o hash é gerado com bcrypt. `confirmPassword`
não é persistido e senha/hash não são devolvidos nas respostas.

O retorno é `201`. O cadastro apenas agenda o email no Redis; se o agendamento
falhar, o usuário continua criado e a resposta inclui `warning`.

Para obter o token, use `POST /sessions`:

```json
{
  "email": "ana@example.com",
  "password": "minhasenha123"
}
```

Resposta:

```json
{
  "user": { "id": 1, "name": "Ana Silva", "email": "ana@example.com" },
  "token": "TOKEN_JWT"
}
```

### Atualizar usuário e trocar senha

`PUT /users/1` aceita alterações parciais. Para alterar somente o nome:

```json
{ "name": "Ana Santos" }
```

Para trocar a senha:

```json
{
  "oldPassword": "minhasenha123",
  "password": "novasenha456"
}
```

A senha atual é conferida antes da troca. A confirmação `confirmPassword` é
obrigatória no cadastro, não na atualização. Alterar ou excluir outro usuário
retorna `403`. Atualmente, as demais operações protegidas não possuem separação
por papel de administrador ou proprietário de cada cliente/contato.

### Clientes e contatos

Exemplo de `POST /customers`:

```json
{
  "name": "Empresa Exemplo",
  "email": "contato@example.com",
  "status": "ACTIVE"
}
```

`status` aceita `ACTIVE` ou `ARCHIVED`. No cadastro de clientes, o hook atual do
model define `ARCHIVED` quando o status é omitido; envie `ACTIVE` explicitamente
para criar um cliente ativo.

Exemplo de `POST /contacts`:

```json
{
  "name": "Bruno Santos",
  "email": "bruno@example.com",
  "customer_id": 1,
  "status": "ACTIVE"
}
```

`customer_id` deve ser um número inteiro positivo e referenciar um cliente
existente. Contatos usam `ACTIVE` quando o status é omitido. Nos dois recursos,
`PUT` permite alterações parciais e exige ao menos um campo válido.
As exclusões bem-sucedidas retornam `204`, sem corpo. Excluir um cliente também
exclui seus contatos, conforme a chave estrangeira da migration.

### Filtros, ordenação e paginação

As listagens retornam arrays JSON. Parâmetros disponíveis:

| Parâmetro | Uso |
| --- | --- |
| `name`, `email` | Busca parcial sem diferenciar maiúsculas/minúsculas |
| `status` | `ACTIVE` ou `ARCHIVED`, em clientes e contatos |
| `customer_id` | Filtrar contatos de um cliente |
| `createdAfter`, `createdBefore` | Limites inclusivos de criação, em formato ISO |
| `updateAfter`, `updateBefore` | Limites inclusivos de atualização, em formato ISO |
| `page` | Inteiro positivo; padrão `1` |
| `limit` | De `1` a `100`; padrão `25` |
| `sort` | Campos separados por vírgula, com direção `ASC` ou `DESC` |

Exemplo:

```text
GET /customers?name=Empresa&status=ACTIVE&page=1&limit=10&sort=name:ASC,createdAt:DESC
```

Campos de ordenação: `id`, `name`, `email`, `createdAt`, `updatedAt` e, para
clientes/contatos, `status`. A ordenação inclui `id:ASC` como desempate quando o
ID não foi especificado. Datas sem horário representam o início do dia; para
incluir o dia inteiro no limite superior, informe horário e fuso explicitamente,
por exemplo `2026-10-25T23:59:59.999-03:00`.

### Upload de arquivos

Envie `POST /file` com `multipart/form-data`, um arquivo no campo `file` e o token.
O arquivo é gravado em `tmp/uploads`; nome original e nome gerado são persistidos
na tabela `files`. O retorno é `201` com os dados do arquivo.

O endpoint não associa automaticamente o arquivo ao usuário nem oferece uma rota
de download. O diretório é criado automaticamente e ignorado pelo Git. Em produção,
use armazenamento persistente para não perder arquivos ao substituir a aplicação.

## Emails e filas

O job `WelcomeMail` envia a mensagem de boas-vindas após o cadastro. Para emails
em lote, use `POST /emails/bulk` com token:

```json
{
  "recipients": [
    { "name": "Ana", "email": "ana@example.com" },
    { "name": "Bruno", "email": "bruno@example.com" }
  ],
  "subject": "Novidades",
  "text": "Confira nossas novidades!",
  "html": "<p>Confira nossas novidades!</p>"
}
```

São aceitos de 1 a 1.000 destinatários. `subject` e `text` são obrigatórios; `html`
é opcional. Emails repetidos são removidos dentro do mesmo lote. Cada destinatário
recebe um job e um email separado. O corpo JSON da API tem limite padrão de 100 KB.

| Status | Resultado do agendamento |
| --- | --- |
| `202` | Todos os destinatários únicos foram agendados |
| `207` | Apenas parte dos agendamentos foi confirmada |
| `503` | Nenhum agendamento foi confirmado |

A resposta informa `requested`, `duplicates`, `queuedCount`, `failedCount`,
`queued` (email e `jobId`) e `failed` (emails sem confirmação). Agendamento não
significa entrega. Evite repetir o lote inteiro após uma confirmação parcial.

Jobs concluídos são removidos; falhas definitivas permanecem no Redis. Há até três
novas tentativas por padrão, com espera exponencial. O processamento pode repetir
um envio após interrupções; não há garantia de entrega exatamente uma vez.
Configure persistência do Redis para manter os jobs após reinicializações.

Detalhes de operação e limitações: [QUEUES.md](QUEUES.md).

## Exceções e monitoramento

O middleware central converte exceções em respostas como:

```json
{
  "error": "Recurso nao encontrado.",
  "code": "NOT_FOUND"
}
```

Erros de validação podem incluir `errors`, um array com detalhes. Status comuns:
`400` para dados inválidos, `401` para autenticação, `403` para acesso negado,
`404` para recurso inexistente, `409` para conflitos, `413` para corpo excessivo,
`500` para falhas internas e `503` para serviços indisponíveis.

Os logs são JSON em stdout. O header `X-Request-Id` permite correlacionar a
requisição com os logs. Erros 5xx e falhas definitivas dos jobs podem ser enviados
ao Sentry; erros esperados 4xx não são enviados. Corpos, tokens e conteúdo dos
emails não fazem parte dos eventos de monitoramento.

Para ativar em produção, configure `NODE_ENV=production`, `SENTRY_ENABLED=true`,
`SENTRY_DSN` e `APP_RELEASE`. Retenção de logs e regras de alerta são configuradas
no ambiente de hospedagem e no painel Sentry.

Mais detalhes: [MONITORING.md](MONITORING.md).

## Testes

```sh
npm test
npm run lint
```

A suíte cobre autenticação, cadastro, troca de senha, uploads, filas, emails em
lote, configuração, exceções e monitoramento. Banco, Redis e SMTP são simulados.
O SDK Sentry também é testado com transporte em memória, sem envio real.
Os testes não substituem a validação da conexão com seus serviços configurados.

## Estrutura

```text
src/
  app/
    controllers/    # Endpoints HTTP
    errors/         # Exceções e conversão de erros
    jobs/           # Processadores das filas
    lib/            # Produtor/worker das filas e funções de senha
    middlewares/    # JWT, erros e logs HTTP
    models/         # Models Sequelize e associações
  config/           # dotenv e configurações dos serviços
  database/
    migrations/     # Evolução do schema
    seeders/        # Clientes de exemplo
  lib/              # Mail, logger e Sentry
  app.js            # Configuração Express
  instrument.js     # Tratamento de erros fatais
  server.js         # Inicialização HTTP
  queue.js          # Inicialização do worker
test/               # Testes automatizados
```

`index.js` na raiz contém um exemplo anterior com dados em memória. A API atual
é inicializada por `src/server.js`.
