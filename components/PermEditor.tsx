"use client";
import { SECTIONS, type Level, type Perms } from "@/lib/perm";
import { Seg } from "./ui";

export default function PermEditor({ perms, onChange, disabled }: { perms: Perms; onChange: (p: Perms) => void; disabled?: boolean }) {
  return (
    <div className="perm-grid">
      {SECTIONS.map(([s, l]) => (
        <div key={s} style={{ display: "contents" }}>
          <span>{l}</span>
          {disabled ? (
            <span className={"pill " + (perms[s] === "edit" ? "p-good" : perms[s] === "view" ? "p-blue" : "p-mute")}>{perms[s] === "none" ? "no access" : perms[s]}</span>
          ) : (
            <Seg<Level> label={l + " access"} value={perms[s]} onChange={(v) => onChange({ ...perms, [s]: v })} options={[["none", "None"], ["view", "View"], ["edit", "Edit"]]} />
          )}
        </div>
      ))}
    </div>
  );
}
