import type { User } from "./types";

export interface UserFilter { q: string; plan: string; college: string; country: string; source: string }

export function filterUsers(users: User[], f: UserFilter) {
  const q = f.q.toLowerCase();
  return users.filter((u) =>
    (f.plan === "all" || u.plan === f.plan) &&
    (f.college === "all" || (f.college === "none" ? !u.collegeId : u.collegeId === f.college)) &&
    (f.country === "all" || u.country === f.country) &&
    (f.source === "all" || u.source === f.source) &&
    (!q || (u.name + " " + u.email).toLowerCase().includes(q)),
  );
}
