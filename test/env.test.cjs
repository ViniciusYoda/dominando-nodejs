const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const { integer, boolean } = require("../src/config/env");

test("valores de ambiente aceitam tipos validos e rejeitam configuracao invalida", (t) => {
    const key = "PROJECT_ENV_TEST";
    const previous = process.env[key];
    t.after(() => {
        if (previous === undefined) delete process.env[key];
        else process.env[key] = previous;
    });
    delete process.env[key];
    assert.equal(integer(key, 587, 1, 65535), 587);
    assert.equal(boolean(key, false), false);
    process.env[key] = "465";
    assert.equal(integer(key, 587, 1, 65535), 465);
    for (const value of ["abc", "1.5", "0", "65536", ""]) {
        process.env[key] = value;
        assert.throws(() => integer(key, 587, 1, 65535), /PROJECT_ENV_TEST/);
    }
    process.env[key] = "true";
    assert.equal(boolean(key, false), true);
    process.env[key] = "false";
    assert.equal(boolean(key, true), false);
    process.env[key] = "yes";
    assert.throws(() => boolean(key, false), /true ou false/);
});

test("dotenv carrega fora da raiz sem sobrescrever ambiente existente", () => {
    const loader = resolve(__dirname, "../src/config/env");
    const result = spawnSync(process.execPath, ["-e", `require(${JSON.stringify(loader)}); if(process.env.PORT !== '4321') process.exit(1);`], {
        cwd: __dirname,
        env: { ...process.env, PORT: "4321" },
        encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
});
