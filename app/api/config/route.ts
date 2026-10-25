import { NextResponse } from "next/server";
import { read } from "@/lib/store";

// Public config for the student app. Only safe fields: no providers, budgets, word lists or keys.
export async function GET() {
  const f = (await read()).flags;
  const today = new Date().toISOString().slice(0, 16);
  const bannerLive = f.banner && (!f.bannerStarts || today >= f.bannerStarts) && (!f.bannerEnds || today <= f.bannerEnds + (f.bannerEnds.length === 10 ? "T23:59" : ""));
  const em = f.emergency;
  return NextResponse.json(
    {
      features: {
        chat: f.chat && !em.readOnly, video: f.video && !em.stopVideo && !em.readOnly, notes: f.notes, flashcards: f.flashcards, quizzes: f.quizzes,
        signups: f.signups && !em.readOnly, checkout: !em.stopCheckout, graphs: f.chatx.graphs, stepMode: f.chatx.stepMode, followUps: f.chatx.followUps, share: f.chatx.share,
        referral: f.creditsx.referral, topups: f.creditsx.topups,
      },
      readOnly: em.readOnly,
      maintenance: f.maintenance ? f.maintenanceMsg : null,
      banner: bannerLive ? { text: f.bannerMsg, type: f.bannerType, link: f.bannerLink || null, audience: f.bannerAudience } : null,
      langs: Object.keys(f.langs).filter((k) => f.langs[k]),
      subjects: Object.keys(f.domains).filter((k) => f.domains[k]),
      regions: f.regions,
      attachments: f.attachments,
      chat: { maxQuestionChars: f.chatx.maxQuestionChars, perDay: f.rateLimit, requireVerified: f.safety.requireVerifyForChat },
      video: { defaultSec: f.videox.defaultSec, maxMin: f.maxVideoMin, perDayFree: f.videox.maxPerDayFree, perDayPaid: f.videox.maxPerDayPaid, captions: f.videox.captions },
      pricing: {
        currency: "USD",
        trial: { price: f.priceTrial, days: f.trialDays, videos: f.trialVideos, on: f.trial },
        monthly: { price: f.priceMonthly, credits: f.monthlyCredits },
        annual: { price: f.priceAnnual },
        topups: f.creditsx.topups ? [{ credits: 10, price: f.topup10 }, { credits: 25, price: f.topup25 }] : [],
      },
      credits: { perVideo: f.creditsPerVideo, rollover: f.creditsx.rollover, referral: f.creditsx.referral ? { referrer: f.creditsx.referrerCredits, friend: f.creditsx.refereeCredits } : null, lowAlertAt: f.creditsx.lowCreditAlert },
      rollout: f.rollout,
      minAge: f.safety.minAge,
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
