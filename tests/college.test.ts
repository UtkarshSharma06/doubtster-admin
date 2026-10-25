import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/seed";
import { evaluateSignup, matchCollege, validateCollege } from "../lib/college";
import type { Data } from "../lib/types";

const fresh = (): Data => seed();

test("subdomain matches parent college domain", () => {
  const d = fresh();
  assert.equal(matchCollege(d.colleges, "a@stu.upes.ac.in")?.domain, "upes.ac.in");
  assert.equal(matchCollege(d.colleges, "a@upes.ac.in")?.domain, "upes.ac.in");
});

test("look-alike domains do not match", () => {
  const d = fresh();
  assert.equal(matchCollege(d.colleges, "a@fakeupes.ac.in"), null);
  assert.equal(matchCollege(d.colleges, "a@upes.ac.in.evil.com"), null);
});

test("verified UPES email gets the college credits", () => {
  const r = evaluateSignup(fresh(), "riya@stu.upes.ac.in", true);
  assert.equal(r.ok, true);
  assert.equal(r.collegeCredits, 10);
});

test("unverified email: credits are held, not given", () => {
  const r = evaluateSignup(fresh(), "riya@stu.upes.ac.in", false);
  assert.equal(r.collegeCredits, 0);
  assert.equal(r.held, 10);
});

test("paused domain gives nothing", () => {
  const r = evaluateSignup(fresh(), "jo@ad.unsw.edu.au", true);
  assert.equal(r.collegeCredits, 0);
  assert.match(r.reason, /paused/);
});

test("code mode needs the right code, any case", () => {
  const d = fresh();
  assert.equal(evaluateSignup(d, "max@tum.de", true).collegeCredits, 0);
  assert.equal(evaluateSignup(d, "max@tum.de", true, "WRONG").collegeCredits, 0);
  assert.equal(evaluateSignup(d, "max@tum.de", true, "tum5").collegeCredits, 5);
});

test("cap reached gives nothing", () => {
  const d = fresh();
  const c = d.colleges.find((x) => x.id === "c4")!;
  c.cap = d.creditGrants.filter((g) => g.collegeId === "c4").length;
  const r = evaluateSignup(d, "new@student.uva.nl", true);
  assert.equal(r.collegeCredits, 0);
  assert.match(r.reason, /cap/);
});

test("campaign dates are respected", () => {
  const d = fresh();
  const c = d.colleges.find((x) => x.id === "c1")!;
  c.ends = "2020-01-01";
  assert.equal(evaluateSignup(d, "a@stu.upes.ac.in", true).collegeCredits, 0);
  c.ends = ""; c.starts = "2999-01-01";
  assert.equal(evaluateSignup(d, "a@stu.upes.ac.in", true).collegeCredits, 0);
});

test("signups switched off blocks everyone", () => {
  const d = fresh();
  d.flags.signups = false;
  assert.equal(evaluateSignup(d, "a@stu.upes.ac.in", true).ok, false);
});

test("throwaway email is blocked", () => {
  assert.equal(evaluateSignup(fresh(), "x@mailinator.com", true).ok, false);
});

test("admin cannot add public or duplicate domains", () => {
  const d = fresh();
  assert.ok("error" in validateCollege(d, { name: "X", domain: "gmail.com", credits: 5 }));
  assert.ok("error" in validateCollege(d, { name: "X", domain: "upes.ac.in", credits: 5 }));
  assert.ok("error" in validateCollege(d, { name: "X", domain: "new.edu", credits: 900 }));
  assert.ok("error" in validateCollege(d, { name: "X", domain: "new.edu", credits: 5, codeMode: "code", code: "" }));
  const ok = validateCollege(d, { name: "IIT Delhi", domain: "https://www.IITD.ac.in/", credits: 10, code: "iitd10" });
  assert.ok("value" in ok && ok.value.domain === "iitd.ac.in" && ok.value.code === "IITD10");
});
