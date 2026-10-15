import app from "./app";

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um inteiro entre 1 e 65535.");
}
app.listen(port);
