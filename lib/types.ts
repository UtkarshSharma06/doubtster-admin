import type { Perms, Role } from "./perm";
export type Plan = "Free" | "Pro trial" | "Pro monthly" | "Pro annual";
export const PLANS: Plan[] = ["Free", "Pro trial", "Pro monthly", "Pro annual"];

export interface User {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  credits: number;
  joined: string;
  status: "active" | "suspended";
  lang: string;
  collegeId: string;
  country: string;
  source: string;
  device: string;
  subject: string;
  videos: number;
  chats: number;
  signupCredits: number;
  pendingCredits: number;
  creditsUsed: number;
  verified: boolean;
  lastActive: string;
  expires?: string;
  manual?: boolean;
}

export interface College {
  id: string;
  name: string;
  domain: string;
  country: string;
  subdomains: boolean;
  credits: number;
  expiryDays: number;
  cap: number;
  code: string;
  codeMode: "domain" | "code";
  requireVerify: boolean;
  starts: string;
  ends: string;
  active: boolean;
  note: string;
  created: string;
}

export interface CreditGrant {
  id: string;
  userId: string;
  emailHash: string;
  source: "college_signup" | "bulk_college" | "manual";
  collegeId: string;
  credits: number;
  status: "held" | "granted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  t: string;
  by: string;
  type: "college" | "signup" | "credits" | "user" | "payment" | "controls" | "content" | "system" | "security" | "admins" | "promo";
  ip?: string;
  action: string;
  target: string;
  detail: string;
}

export interface Payment {
  id: string;
  userId: string;
  amount: string;
  cur: string;
  plan: Plan;
  method: string;
  ref: string;
  error: string;
  date: string;
  status: "failed" | "resolved" | "rejected";
  note?: string;
  grantId?: string;
}

export interface Grant {
  id: string;
  date: string;
  userId: string;
  plan: Plan;
  prevPlan: Plan;
  prevExpires: string;
  days: number;
  credits: number;
  reason: string;
  note: string;
  ref: string;
  paymentId: string;
  by: string;
  status: "active" | "revoked";
  expires?: string;
}

export interface Job {
  id: string;
  q: string;
  lang: string;
  domain: string;
  target: number;
  actual: number;
  status: "done" | "rendering" | "queued" | "failed";
  verify: "verified" | "needs review" | "failed" | "pending";
}

export interface Flags {
  chat: boolean;
  video: boolean;
  notes: boolean;
  flashcards: boolean;
  quizzes: boolean;
  signups: boolean;
  maintenance: boolean;
  maintenanceMsg: string;
  banner: boolean;
  bannerMsg: string;
  trial: boolean;
  trialDays: number;
  creditsPerVideo: number;
  freeCredits: number;
  maxVideoMin: number;
  rateLimit: number;
  langs: Record<string, boolean>;
  provider: string;
  provider2: string;
  verify: boolean;
  priceTrial: number;
  trialVideos: number;
  priceMonthly: number;
  monthlyCredits: number;
  priceAnnual: number;
  topup10: number;
  topup25: number;
  costPerVideoMin: number;
  domains: Record<string, boolean>;
  bannerType: "info" | "warning" | "success";
  bannerLink: string;
  bannerAudience: "all" | "free" | "paid";
  bannerStarts: string;
  bannerEnds: string;
  ai: {
    chatProvider: string; videoProvider: string; notesProvider: string; fallback: boolean;
    temperature: number; maxTokens: number; monthlyBudget: number; alertAt: number; overBudget: "alert" | "pause_video" | "pause_free";
  };
  chatx: { graphs: boolean; stepMode: boolean; followUps: boolean; share: boolean; maxQuestionChars: number; historyDays: number };
  attachments: { images: boolean; pdf: boolean; docs: boolean; maxMB: number; maxFiles: number; ocr: boolean };
  videox: {
    defaultSec: number; maxPerDayFree: number; maxPerDayPaid: number; concurrent: number; resolution: "720p" | "1080p";
    watermarkTrial: boolean; music: boolean; paidPriority: boolean; captions: boolean;
  };
  creditsx: { rollover: boolean; topups: boolean; referral: boolean; referrerCredits: number; refereeCredits: number; lowCreditAlert: number };
  regions: { eu: boolean; uk: boolean; na: boolean; latam: boolean; anz: boolean; india: boolean; row: boolean };
  safety: { integrityMode: boolean; moderation: "relaxed" | "standard" | "strict"; blockedWords: string[]; minAge: number; requireVerifyForChat: boolean };
  notify: { welcome: boolean; trialEnding: boolean; trialEndingDays: number; lowCredits: boolean; weeklyDigest: boolean; winBack: boolean };
  emergency: { stopVideo: boolean; stopCheckout: boolean; readOnly: boolean; stopSignupCredits: boolean };
  rollout: { voiceInput: number; aiTutorMode: number; newEditor: number; examMode: number };
}

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: Role;
  perms: Perms; // used when role is "custom"
  passHash: string; // scrypt, empty until the invite is accepted
  status: "invited" | "active" | "disabled";
  totpSecret: string; // base32, empty when 2FA is off
  totpPending: string; // secret being set up, not active yet
  recoveryHashes: string[]; // one-time recovery codes, hashed
  failed: number;
  lockedUntil: string;
  createdAt: string;
  createdBy: string;
  lastLogin: string;
  lastIp: string;
  userId: string; // linked app user, when promoted from Users
}

export interface Session {
  id: string; // stored hashed? no: random 32 bytes, only its id is in the signed cookie
  adminId: string;
  createdAt: string;
  lastSeen: string;
  expiresAt: string;
  ip: string;
  ua: string;
  revoked: boolean;
}

export interface Invite {
  id: string;
  tokenHash: string;
  adminId: string;
  kind: "invite" | "reset";
  expiresAt: string;
  usedAt: string;
  createdBy: string;
}

export interface Security {
  require2fa: boolean;
  sessionHours: number;
  idleMinutes: number;
  maxFailed: number;
  lockMinutes: number;
  ipAllowlist: string[]; // applies to everyone except super admins
  inviteHours: number;
}

export interface Promo {
  id: string;
  code: string;
  kind: "credits" | "percent" | "trial_days";
  value: number;
  plans: string[]; // for percent: which plans it applies to
  maxUses: number; // 0 = unlimited
  perUser: number;
  uses: number;
  starts: string;
  ends: string;
  active: boolean;
  newUsersOnly: boolean;
  note: string;
  createdAt: string;
  redemptions: { userKey: string; at: string }[];
}

export interface ConfigSnapshot {
  id: string;
  at: string;
  by: string;
  changed: string[];
  flags: Flags;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  slugMode?: "auto" | "custom";
  status: "draft" | "scheduled" | "published";
  date: string;
  updated: string;
  author: string;
  category: string;
  tags: string[];
  lang: string;
  tldr: string;
  cover: string;
  coverAlt: string;
  body: string;
  focusKw: string;
  secondaryKw: string[];
  metaTitle: string;
  metaDesc: string;
  canonical: string;
  robots: { index: boolean; follow: boolean; img: boolean };
  ogTitle: string;
  ogDesc: string;
  ogImage: string;
  twitterCard: string;
  schema: { type: string; faq: boolean; breadcrumb: boolean };
  faqs: { q: string; a: string }[];
  sources: { title: string; url: string }[];
  hreflang: { lang: string; url: string }[];
}

export interface Site {
  name: string;
  url: string;
  logo: string;
  ogImage: string;
  lang: string;
  author: string;
  authorUrl: string;
  authorBio: string;
  twitter: string;
  sameAs: string;
  gsc: string;
  bing: string;
  ga: string;
  indexnow: string;
}

export interface Data {
  v: 2;
  site: Site;
  seo: { bots: Record<string, boolean>; redirects: { from: string; to: string }[] };
  flags: Flags;
  posts: Post[];
  users: User[];
  colleges: College[];
  creditGrants: CreditGrant[];
  audit: AuditEntry[];
  payments: Payment[];
  grants: Grant[];
  jobs: Job[];
  admins: Admin[];
  sessions: Session[];
  invites: Invite[];
  security: Security;
  promos: Promo[];
  configHistory: ConfigSnapshot[];
}
