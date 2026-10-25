/*
  Break-glass recovery, run on the server only:
    npm run admin:reset -- you@doubtster.com "a new long password"
  Sets a new password, turns off 2FA, unlocks, signs out all devices and makes the account an active super admin.
  Needs shell access to the server, so it cannot be used from the web.
*/
import { tx } from "../lib/store";
import { hashPassword, passwordProblem } from "../lib/password";
import { permsFor } from "../lib/perm";
import { audit } from "../lib/service";
import { nowISO, uid } from "../lib/util";

async function main() {
  const [email, pw] = process.argv.slice(2);
  if (!email || !pw) { console.error('Usage: npm run admin:reset -- email "new password"'); process.exit(1); }
  const prob = passwordProblem(pw, email);
  if (prob) { console.error(prob); process.exit(1); }
  const h = await hashPassword(pw);
  await tx((d) => {
    const e = email.trim().toLowerCase();
    let a = d.admins.find((x) => x.email === e);
    if (!a) {
      a = { id: uid("ad"), email: e, name: e.split("@")[0], role: "super", perms: permsFor("super"), passHash: "", status: "active", totpSecret: "", totpPending: "", recoveryHashes: [], failed: 0, lockedUntil: "", createdAt: nowISO(), createdBy: "server script", lastLogin: "", lastIp: "", userId: "" };
      d.admins.push(a);
    }
    Object.assign(a, { passHash: h, role: "super", perms: permsFor("super"), status: "active", totpSecret: "", totpPending: "", recoveryHashes: [], failed: 0, lockedUntil: "" });
    d.sessions.forEach((s) => { if (s.adminId === a!.id) s.revoked = true; });
    audit(d, "server script", "security", "Break-glass reset", e, "password set, 2FA off, super admin");
  });
  console.log("Done. Sign in at /admin/login and turn two-step sign in back on.");
}
main();
