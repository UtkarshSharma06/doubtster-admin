import { test } from "node:test";
import assert from "node:assert/strict";
import { codeAt, checkCode, newSecret } from "../lib/totp";
import { hashPassword, checkPassword, passwordProblem } from "../lib/password";
import { permsFor, can, ROLES, homeFor } from "../lib/perm";
import { ipAllowed } from "../lib/admins";

test("TOTP matches the RFC 6238 test vector", () => {
  // RFC 6238 SHA1 secret "12345678901234567890" in base32, at T=59s, 8-digit 94287082 -> 6-digit 287082
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(codeAt(secret, Math.floor(59 / 30)), "287082");
});

test("TOTP accepts the current code and one step of drift, nothing older", () => {
  const s = newSecret(), now = Date.now(), step = Math.floor(now / 30000);
  assert.ok(checkCode(s, codeAt(s, step), now));
  assert.ok(checkCode(s, codeAt(s, step - 1), now));
  assert.ok(!checkCode(s, codeAt(s, step - 3), now));
  assert.ok(!checkCode(s, "abcdef", now));
});

test("passwords hash and check", async () => {
  const h = await hashPassword("a long good password here");
  assert.ok(h.startsWith("scrypt$"));
  assert.ok(await checkPassword("a long good password here", h));
  assert.ok(!(await checkPassword("a long good password herE", h)));
  assert.ok(!(await checkPassword("anything", "")));
});

test("password rules", () => {
  assert.ok(passwordProblem("short"));
  assert.ok(passwordProblem("mypassword12345"));
  assert.equal(passwordProblem("coffee rain blue window"), "");
});

test("roles: support edits users, cannot edit controls", () => {
  const p = permsFor("support");
  assert.ok(can(p, "users", "edit"));
  assert.ok(can(p, "controls", "view"));
  assert.ok(!can(p, "controls", "edit"));
  assert.ok(!can(p, "settings", "view"));
});

test("custom role ignores junk values", () => {
  const p = permsFor("custom", { blog: "edit", users: "owner" as never, seo: "view" });
  assert.equal(p.blog, "edit"); assert.equal(p.users, "none"); assert.equal(p.seo, "view"); assert.equal(p.settings, "none");
});

test("content role lands on a page it can open", () => {
  assert.equal(homeFor(ROLES.content.perms), "/admin");
  assert.equal(homeFor(permsFor("custom", { blog: "view" })), "/admin/blog");
  assert.equal(homeFor(permsFor("custom", {})), "/admin/account");
});

test("IP allowlist: exact, CIDR, empty", () => {
  assert.ok(ipAllowed("1.2.3.4", []));
  assert.ok(ipAllowed("1.2.3.4", ["1.2.3.4"]));
  assert.ok(ipAllowed("10.0.5.9", ["10.0.0.0/16"]));
  assert.ok(!ipAllowed("10.1.5.9", ["10.0.0.0/16"]));
  assert.ok(ipAllowed("::ffff:10.0.5.9", ["10.0.0.0/8"]));
});
