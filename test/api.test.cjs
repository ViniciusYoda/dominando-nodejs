require("sucrase/register");
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { unlink } = require("node:fs/promises");
const { resolve } = require("node:path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

test("API: login, protecao, bcrypt e upload sem banco real", async (t) => {
  const app = require("../src/app").default;
  const User = require("../src/app/models/User").default;
  const File = require("../src/app/models/File").default;
  const auth = require("../src/config/auth").default;
  const { hashPassword, checkPassword } = require("../src/app/lib/password");
  const original = { findOne: User.findOne, findByPk: User.findByPk, create: User.create, fileCreate: File.create };
  const user = User.build({ id: 1, name: "Ana", email: "ana@example.com", password_hash: await hashPassword("password123") }, { isNewRecord: false });
  let updated;
  user.update = async (data) => { updated = data; user.set(data); return user; };
  User.findOne = async ({ where }) => where.email === user.email ? user : null;
  User.findByPk = async (id) => Number(id) === 1 ? user : null;
  User.create = async (data) => User.build({ id: 2, ...data });
  let uploaded;
  File.create = async (data) => { uploaded = data; return File.build({ id: 1, ...data }); };

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((done) => server.close(done));
    Object.assign(User, { findOne: original.findOne, findByPk: original.findByPk, create: original.create });
    File.create = original.fileCreate;
    if (uploaded) await unlink(resolve(__dirname, "../tmp/uploads", uploaded.path)).catch(() => {});
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = "GET", body, token) {
    return fetch(base + path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  await t.test("models inicializam com a chave da migration", () => {
    assert.equal(User.associations.file.foreignKey, "files_id");
    assert.equal(File.associations.users.foreignKey, "files_id");
    assert.equal(User.rawAttributes.file_id, undefined);
  });

  await t.test("cadastro publico exige confirmacao e nao expoe hash", async () => {
    const body = { name: "Ana", email: "ana@example.com", password: "password123" };
    assert.equal((await request("/users", "POST", body)).status, 400);
    const response = await request("/users", "POST", { ...body, confirmPassword: body.password });
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.equal(data.password_hash, undefined);
    assert.equal(data.password, undefined);
  });

  let token;
  await t.test("login publico valida senha e retorna JWT", async () => {
    assert.equal((await request("/sessions", "POST", {})).status, 400);
    assert.equal((await request("/sessions", "POST", { email: user.email, password: "wrong" })).status, 401);
    const response = await request("/sessions", "POST", { email: user.email, password: "password123" });
    assert.equal(response.status, 200);
    const data = await response.json();
    token = data.token;
    assert.equal(jwt.verify(token, auth.secret).id, 1);
    assert.equal(data.user.password_hash, undefined);
  });

  await t.test("rotas recusam tokens ausentes, invalidos e expirados", async () => {
    for (const value of [undefined, "invalid", jwt.sign({ id: 1 }, auth.secret, { expiresIn: -1 }), jwt.sign({ id: 99 }, auth.secret)]) {
      assert.equal((await request("/users/1", "GET", undefined, value)).status, 401);
    }
    assert.equal((await request("/users/1", "GET", undefined, token)).status, 200);
  });

  await t.test("troca exige senha atual e usa bcrypt", async () => {
    assert.equal((await request("/users/1", "PUT", { password: "newpassword123" }, token)).status, 400);
    assert.equal((await request("/users/1", "PUT", { password: "newpassword123", oldPassword: "wrong" }, token)).status, 401);
    assert.equal(updated, undefined);
    assert.equal((await request("/users/1", "PUT", { password: "newpassword123", oldPassword: "password123" }, token)).status, 200);
    assert.equal(await bcrypt.compare("newpassword123", updated.password_hash), true);
    assert.equal(await checkPassword("wrong", updated.password_hash), false);
    assert.equal(updated.oldPassword, undefined);
    assert.equal((await request("/users/2", "PUT", { name: "Other" }, token)).status, 403);
  });

  await t.test("upload persiste metadados e rejeita arquivo ausente", async () => {
    assert.equal((await request("/file", "POST", {}, token)).status, 400);
    const form = new FormData();
    form.append("file", new Blob(["upload test"]), "test.txt");
    const response = await fetch(base + "/file", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    assert.equal(response.status, 201);
    assert.equal(uploaded.name, "test.txt");
    assert.match(uploaded.path, /^[a-f0-9]{32}\.txt$/);
  });
});
