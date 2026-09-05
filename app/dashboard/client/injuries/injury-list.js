"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const BODY_PART_LABELS = {
  chest: "Chest",
  back: "Back (muscle)",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  lats: "Lats",
  traps: "Traps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core / abs",
  obliques: "Obliques",
  hip_flexors: "Hip flexors",
  adductors: "Adductors (inner thigh)",
  abductors: "Abductors (outer hip)",
  rotator_cuff: "Rotator cuff",
  neck: "Neck",
  upper_back_spine: "Upper back / spine (joint)",
  lower_back_spine: "Lower back / spine (joint)",
  shoulder_joint: "Shoulder joint",
  elbow: "Elbow",
  wrist: "Wrist",
  hip: "Hip",
  knee: "Knee",
  ankle: "Ankle",
  foot: "Foot",
  jaw_tmj: "Jaw / TMJ",
  ribs_sternum: "Ribs / sternum",
  collarbone: "Collarbone",
  hand_fingers: "Hand / fingers",
  toes: "Toes",
  achilles_tendon: "Achilles tendon",
  groin: "Groin",
  tailbone: "Tailbone",
  cardiovascular: "Heart / cardiovascular",
  respiratory: "Breathing / respiratory",
  pregnancy: "Pregnancy",
  general: "General illness / whole-body recovery",
  neurological_balance: "Neurological / balance issues",
  digestive: "Digestive / GI",
  diabetes_bloodsugar: "Diabetes / blood sugar",
};

const ACTION_LABELS = {
  global_rest: "Full rest — whole workout paused",
  local_rest: "Avoiding exercises for this area",
  local_modify: "Using modified/gentler exercises",
  no_restriction: "No restrictions",
};

const ACTION_COLORS = {
  global_rest: "var(--rust)",
  local_rest: "var(--amber)",
  local_modify: "var(--moss-deep)",
  no_restriction: "var(--steel)",
};

export default function InjuryList({ injuries }) {
  const supabase = createClient();
  const router = useRouter();
  const [resolvingId, setResolvingId] = useState(null);

  async function markResolved(id) {
    setResolvingId(id);
    await supabase.from("client_injuries").update({ active: false }).eq("id", id);
    setResolvingId(null);
    router.refresh();
  }

  if (injuries.length === 0) {
    return (
      <div className="empty-state" style={{ marginBottom: 16 }}>
        No active injuries reported. You&apos;re clear to train normally.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {injuries.map((inj) => (
        <div key={inj.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {BODY_PART_LABELS[inj.body_part] || inj.body_part}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {inj.injury_type}
            {inj.doctor_recommendation ? ` · Doctor: ${inj.doctor_recommendation}` : ""}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: ACTION_COLORS[inj.resolved_action] || "var(--steel)",
              marginTop: 6,
            }}
          >
            {ACTION_LABELS[inj.resolved_action] || inj.resolved_action}
          </div>
          <button
            onClick={() => markResolved(inj.id)}
            disabled={resolvingId === inj.id}
            style={{
              marginTop: 10,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--moss-deep)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {resolvingId === inj.id ? "Updating..." : "Mark as resolved"}
          </button>
        </div>
      ))}
    </div>
  );
}
