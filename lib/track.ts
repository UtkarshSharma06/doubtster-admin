// Events the app should send to analytics. Shown on the Analytics page.
export const TRACK = {
  identity: "user_id only. Never send the email or name to analytics.",
  common_props: ["user_id", "plan", "country", "college_id", "lang", "device", "app_version", "utm_source", "utm_medium", "utm_campaign"],
  events: [
    { name: "signup_completed", props: ["method", "email_domain", "college_id", "promo_code", "credits_granted"] },
    { name: "email_verified", props: ["college_id", "credits_released"] },
    { name: "chat_question_sent", props: ["subject", "has_image", "has_file", "chars"] },
    { name: "chat_answer_shown", props: ["subject", "latency_ms", "verified", "provider"] },
    { name: "video_requested", props: ["subject", "lang", "target_seconds", "credits_spent"] },
    { name: "video_completed", props: ["job_id", "actual_seconds", "render_ms", "failed"] },
    { name: "video_watched", props: ["job_id", "percent"] },
    { name: "notes_opened", props: ["subject"] },
    { name: "flashcards_studied", props: ["deck_size", "correct"] },
    { name: "quiz_completed", props: ["questions", "score"] },
    { name: "paywall_shown", props: ["trigger"] },
    { name: "checkout_started", props: ["plan", "price_usd"] },
    { name: "payment_succeeded", props: ["plan", "amount_usd", "provider"] },
    { name: "payment_failed", props: ["plan", "reason"] },
    { name: "credits_topped_up", props: ["pack", "amount_usd"] },
    { name: "subscription_cancelled", props: ["plan", "reason", "days_active"] },
  ],
};
