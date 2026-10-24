# Filas em background

O cadastro adiciona o email de boas-vindas à fila `WelcomeMail` no Redis.
O processo da API não envia o email: um worker separado executa o job.
Somente nome e email são colocados na fila, sem senha ou hash.

Configure o `.env` com os dados SMTP e do Redis, conforme `.env.example`.
Sem configurações adicionais, o Redis é acessado em `localhost:6379`, banco `0`.

Com Redis e PostgreSQL disponíveis, use dois terminais:

```sh
npm run dev
```

```sh
npm run queue
```

Para reiniciar o worker automaticamente durante o desenvolvimento:

```sh
npm run queue:dev
```

Jobs que falham têm até três novas tentativas com espera exponencial.
Jobs concluídos são removidos; os que esgotam as tentativas permanecem no Redis.
O worker também recupera jobs interrompidos. Use Ctrl+C para encerrá-lo.

Se o Redis estiver indisponível durante o cadastro, o usuário é salvo e a resposta
inclui um aviso. Nesse caso, o email não foi agendado e não será reenviado automaticamente.
Se o Redis estiver disponível e o worker parado, o job aguarda o worker iniciar.

O processamento pode ocorrer mais de uma vez após uma interrupção; a fila não
garante envio de email exatamente uma vez. Para preservar jobs após reiniciar o
Redis, configure persistência e um volume durável no servidor Redis.

```sh
npm test
npm run lint
```

Os testes usam Redis, SMTP e banco simulados e não enviam emails reais.

## Emails em lote

Envie `POST /emails/bulk` com `Authorization: Bearer SEU_TOKEN`:

```json
{
  "recipients": [
    { "name": "Ana", "email": "ana@example.com" },
    { "name": "Bruno", "email": "bruno@example.com" }
  ],
  "subject": "Novidades",
  "text": "Confira nossas novidades!"
}
```

O lote aceita de 1 a 1.000 destinatários, assunto e texto obrigatórios e `html`
opcional. Cada destinatário recebe um email separado, sem expor os demais.
Emails repetidos são removidos dentro do mesmo lote, ignorando maiúsculas.
O limite de tamanho do JSON da API continua sendo 100 KB; divida lotes maiores.

O retorno `202` confirma o agendamento, não a entrega. `207` indica confirmação
parcial e `503` indica que nenhum agendamento foi confirmado. A resposta contém
`queued` com os IDs dos jobs e `failed` com os emails não confirmados. Não reenvie
o lote inteiro quando alguns jobs já foram confirmados. Uma perda de conexão pode
ocorrer depois de o Redis salvar um job; reagendar pode causar duplicatas.

Mantenha `npm run queue` em execução. `BULK_MAIL_CONCURRENCY=2` controla quantos
emails em lote cada worker processa simultaneamente (1 a 20). Isso não é um limite
de emails por segundo: siga os limites SMTP do seu provedor. Os jobs usam as mesmas
três novas tentativas com espera exponencial das outras filas.
