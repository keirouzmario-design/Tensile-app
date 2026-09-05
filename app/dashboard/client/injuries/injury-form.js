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
  { value: "cardiovascular", label: "Heart / cardiovascular", category: "systemic" },
  { value: "respiratory", label: "Breathing / respiratory", category: "systemic" },
  { value: "pregnancy", label: "Pregnancy", category: "systemic" },
  { value: "general", label: "General illness / whole-body recovery", category: "systemic" },
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

const MUSCLE_ACTION_MAP = {
  "Strain/pull": "local_rest",
  "Soreness (DOMS)": "local_modify",
  "Chronic tightness/knot": "local_modify",
  "Tendinitis": "local_modify",
  "Post-injury recovery": "local_rest",
  "Other": "local_rest",
};

const JOINT_ACTION_MAP = {
  "Sprain (ligament)": "local_rest",
  "Impingement/pinching pain": "local_rest",
  "Arthritis/joint pain": "local_modify",
  "Instability/dislocation history": "local_rest",
  "Tendinitis/bursitis": "local_modify",
  "Post-surgery": "local_rest",
  "Other": "local_rest",
};

function computeAction(category, injuryType, doctorRec) {
  if (doctorRec === "Complete rest - no training") return "global_rest";
  if (doctorRec === "Avoid this area") return "local_rest";
  if (doctorRec === "Light/modified only") return "local_modify";
  if (doctorRec === "Cleared - no restrictions") return "no_restriction";

  if (category === "systemic") return "global_rest";
  if (category === "muscle") return MUSCLE_ACTION_MAP[injuryType] || "local_rest";
  if (category === "joint") return JOINT_ACTION_MAP[injuryType] || "local_rest";
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
