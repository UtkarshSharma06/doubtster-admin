import type { ReactNode } from "react";

/** Shared frame for the admin sign in and invite pages. */
export default function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="auth">
      <section className="auth-board" aria-hidden="true">
        <div className="auth-brand"><img src="/brand/doubtster-icon.svg" alt="" width={34} height={34} /><span>Doubtster</span></div>
        <div className="auth-chalk">
          <p className="c1">Admin access only</p>
          <p className="c2">Students sign in at doubtster.com</p>
          <ul>
            <li>Every sign in is logged with time and network</li>
            <li>Two-step sign in keeps the panel safe</li>
            <li>Access is given by your super admin</li>
          </ul>
        </div>
        <div className="auth-foot">doubtster admin</div>
      </section>
      <section className="auth-form">{children}</section>
    </main>
  );
}
