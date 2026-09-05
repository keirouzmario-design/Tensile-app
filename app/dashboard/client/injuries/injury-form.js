"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const BODY_PARTS = [
  { value: "chest", label: "Chest", category: "muscle" },
  { value: "back", label: "Back (muscle)", category: "muscle" },
  { value: "shoulders", label: "Shoulders", category: "muscle" },
  { value: "biceps", label: "Biceps", category: "muscle" },
  { value: "triceps", label: "Triceps", category: "muscle" },
  { value: "forearms", label: "Forearms", category: "muscle" },
  { value: "lats", label: "Lats", category: "muscle" },
  { value: "traps", label: "Traps", category: "muscle" },
  { value: "quads", label: "Quads", category: "muscle" },
  { value: "hamstrings", label: "Hamstrings", category: "muscle" },
  { value: "glutes", label: "Glutes", category: "muscle" },
  { value: "calves", label: "Calves", category: "muscle" },
  { value: "core", label: "Core / abs", category: "muscle" },
  { value: "obliques", label: "Obliques", category: "muscle" },
  { value: "hip_flexors", label: "Hip flexors", category: "muscle" },
  { value: "adductors", label: "Adductors (inner thigh)", category: "muscle" },
  { value: "abductors", label: "Abductors (outer hip)", category: "muscle" },
  { value: "rotator_cuff", label: "Rotator cuff", category: "muscle" },
  { value: "neck", label: "Neck", category: "joint" },
  { value: "upper_back_spine", label: "Upper back / spine (joint)", category: "joint" },
  { value: "lower_back_spine", label: "Lower back / spine (joint)", category: "joint" },
  { value: "shoulder_joint", label: "Shoulder joint", category: "joint" },
  { value: "elbow", label: "Elbow", category: "joint" },
  { value: "wrist", label: "Wrist", category: "joint" },
  { value: "hip", label: "Hip", category: "joint" },
  { value: "knee", label: "Knee", category: "joint" },
  { value: "ankle", label: "Ankle", category: "joint" },
  { value: "foot", label: "Foot", category: "joint" },
  { value: "jaw_tmj", label: "Jaw / TMJ", category: "joint" },
  { value: "ribs_sternum", label: "Ribs / sternum", category: "joint" },
  { value: "collarbone", label: "Collarbone", category: "joint" },
  { value: "hand_fingers", label: "Hand / fingers", category: "joint" },
  { value: "toes", label: "Toes", category: "joint" },
  { value: "achilles_tendon", label: "Achilles tendon", category: "joint" },
  { value: "groin", label: "Groin", category: "joint" },
  { value: "tailbone", label: "Tailbone", category: "joint" },
  { value: "cardiovascular", label: "Heart / cardiovascular", category: "systemic" },
  { value: "respiratory", label: "Breathing / respiratory", category: "systemic" },
  { value: "pregnancy", label: "Pregnancy", category: "systemic" },
  { value: "general", label: "General illness / whole-body recovery", category: "systemic" },
  { value: "neurological_balance", label: "Neurological / balance issues", category: "systemic" },
  { value: "digestive", label: "Digestive / GI", category: "systemic" },
  { value: "diabetes_bloodsugar", label: "Diabetes / blood sugar", category: "systemic" },
];

const INJURY_TYPES = {
  muscle: [
    "Strain/pull",
    "Soreness (DOMS)",
    "Chronic tightness/knot",
    "Tendinitis",
    "Post-injury recovery",
    "Other",
  ],
  joint: [
    "Sprain (ligament)",
    "Impingement/pinching pain",
    "Arthritis/joint pain",
    "Instability/dislocation history",
    "Tendinitis/bursitis",
    "Post-surgery",
    "Other",
  ],
  systemic: [
    "Diagnosed medical condition",
    "Recovering from illness/surgery",
    "Pregnancy",
    "Other",
  ],
};

const DOCTOR_RECS = [
  "No doctor recommendation yet",
  "Complete rest - no training",
  "Avoid this area",
  "Light/modified only",
  "Cleared - no restrictions",
];

function computeAction(category, injuryType, doctorRec) {
  if (doctorRec === "Complete rest - no training") return "global_rest";
  if (doctorRec === "Avoid this area") return "local_rest";
  if (doctorRec === "Light/modified only") return "local_modify";
  if (doctorRec === "Cleared - no restrictions") return "no_restriction";

  if (category === "systemic") return "global_rest";
  return "local_rest";
}

const ACTION_LABELS = {
  global_rest: "Full rest — pausing your whole workout",
  local_rest: "Avoiding exercises for this area",
  local_modify: "Using modified/gentler exercises for this area",
  no_restriction: "No restrictions",
};

export default function InjuryForm({ userId, coachId }) {
  const supabase = createClient();
  const router = useRouter();
  const [bodyPart, setBodyPart] = useState("");
  const [injuryType, setInjuryType] = useState("");
  const [doctorRec, setDoctorRec] = useState(DOCTOR_RECS[0]);
  const [saving, setSaving] = useState(false);

  const selectedBodyPart = BODY_PARTS.find((b) => b.value === bodyPart);
  const injuryTypeOptions = selectedBodyPart ? INJURY_TYPES[selectedBodyPart.category] : [];

  function handleBodyPartChange(value) {
    setBodyPart(value);
    setInjuryType("");
  }

  async function handleSubmit() {
    if (!bodyPart || !injuryType) return;
    setSaving(true);
    const action = computeAction(selectedBodyPart.category, injuryType, doctorRec);
    await supabase.from("client_injuries").insert({
      client_id: userId,
      coach_id: coachId,
      body_part: bodyPart,
      injury_type: injuryType,
      doctor_recommendation: doctorRec === DOCTOR_RECS[0] ? null : doctorRec,
      resolved_action: action,
      active: true,
    });
    setSaving(false);
    setBodyPart("");
    setInjuryType("");
    setDoctorRec(DOCTOR_RECS[0]);
    router.refresh();
  }

  const previewAction =
    selectedBodyPart && injuryType
      ? computeAction(selectedBodyPart.category, injuryType, doctorRec)
      : null;

  const selectStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--line)",
    borderRadius: 6,
    fontSize: 14,
    background: "var(--card)",
    color: "var(--ink)",
    marginBottom: 12,
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        Report a new injury or limitation
      </div>

      <label style={{ fontSize: 11, color: "var(--steel)" }}>Body part / area</label>
      <select
        value={bodyPart}
        onChange={(e) => handleBodyPartChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">Select...</option>
        {BODY_PARTS.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>

      {selectedBodyPart && (
        <>
          <label style={{ fontSize: 11, color: "var(--steel)" }}>Type of injury/pain</label>
          <select
            value={injuryType}
            onChange={(e) => setInjuryType(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select...</option>
            {injuryTypeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </>
      )}

      {injuryType && (
        <>
          <label style={{ fontSize: 11, color: "var(--steel)" }}>Doctor recommendation</label>
          <select
            value={doctorRec}
            onChange={(e) => setDoctorRec(e.target.value)}
            style={selectStyle}
          >
            {DOCTOR_RECS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </>
      )}

      {previewAction && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
          Result: {ACTION_LABELS[previewAction]}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!bodyPart || !injuryType || saving}
        className="btn-primary"
        style={{ width: "auto", padding: "10px 20px" }}
      >
        {saving ? "Saving..." : "Save injury"}
      </button>
    </div>
  );
}
