# Monitoramento em producao

## Configuracao

Crie um projeto Node.js no Sentry e copie o DSN para o ambiente de producao:

```env
NODE_ENV=production
LOG_LEVEL=info
SENTRY_ENABLED=true
SENTRY_DSN=https://chave_publica@seu_host_sentry/id_do_projeto
APP_RELEASE=dominando-nodejs@1.0.0
```

API e worker usam o mesmo `.env`. Sem DSN, nenhum evento e enviado ao Sentry;
os logs JSON continuam funcionando. Para desenvolvimento/testes, mantenha
`SENTRY_ENABLED=false`. Nunca use o DSN de producao nos testes.

## O que e registrado

- Resumo de cada requisicao HTTP com status, duracao, rota e `requestId`.
- Erros 5xx com codigo de excecao e componente (`api` ou `worker`).
- Novas tentativas, conclusao e falha definitiva dos jobs (nome da fila e ID).
- Falhas no Redis, agendamento de emails, inicializacao e encerramento.
- Erros fatais de processo: captura, flush de ate dois segundos e saida com codigo 1.

O cliente recebe o header `X-Request-Id`; use-o para procurar o erro nos logs.
O log `application_error` inclui `eventId` quando a captura Sentry e aceita pelo SDK.
Erros esperados 4xx nao sao enviados ao Sentry. Tentativas intermediarias dos jobs
geram logs; a falha definitiva gera evento Sentry.

Os logs vao para stdout em JSON. O ambiente de hospedagem deve coletar e reter
esses logs. Configure um supervisor para reiniciar API/worker apos falhas fatais.
O repositorio nao configura armazenamento, retencao nem alertas na conta Sentry;
essas opcoes sao configuradas no provedor. Configure alertas para novos erros e
falhas nas filas no painel Sentry.

## Dados privados

Nao registramos corpos, headers, cookies, query strings, destinatarios ou conteudo
de emails. O Sentry usa captura manual, sem integracoes automaticas de HTTP/SQL.
As excecoes enviadas usam mensagem generica, codigo e stack frames; causas,
variaveis locais e linhas de codigo sao removidas antes do envio. Isso reduz o
contexto disponivel no painel, mas evita transmitir payloads e credenciais.

## Verificacao

```sh
npm test
npm run lint
```

Os testes usam um SDK Sentry simulado e tambem verificam o SDK real com transporte
em memoria, sem rede ou envio de eventos reais. Depois de
configurar o DSN em seu ambiente, verifique a primeira ocorrencia real no painel
e valide as regras de alerta do projeto Sentry.
