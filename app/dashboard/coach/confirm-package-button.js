"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SPLIT_TEMPLATES = {
  1: [{ day: 1, muscles: ["quads", "back", "chest", "shoulders", "hamstrings", "core"] }],
  2: [
    { day: 1, muscles: ["chest", "back", "shoulders", "biceps", "triceps"] },
    { day: 4, muscles: ["quads", "hamstrings", "glutes", "calves"] },
  ],
  3: [
    { day: 1, muscles: ["quads", "back", "chest", "shoulders", "hamstrings", "core"] },
    { day: 3, muscles: ["quads", "back", "chest", "shoulders", "hamstrings", "core"] },
    { day: 5, muscles: ["quads", "back", "chest", "shoulders", "hamstrings", "core"] },
  ],
  4: [
    { day: 1, muscles: ["chest", "back", "shoulders", "biceps", "triceps"] },
    { day: 2, muscles: ["quads", "hamstrings", "glutes", "calves"] },
    { day: 4, muscles: ["chest", "back", "shoulders", "biceps", "triceps"] },
    { day: 5, muscles: ["quads", "hamstrings", "glutes", "calves"] },
  ],
  5: [
    { day: 1, muscles: ["chest", "shoulders", "triceps"] },
    { day: 2, muscles: ["back", "biceps"] },
    { day: 3, muscles: ["quads", "hamstrings", "glutes", "calves"] },
    { day: 4, muscles: ["chest", "back", "shoulders", "biceps", "triceps"] },
    { day: 5, muscles: ["quads", "hamstrings", "glutes", "calves"] },
  ],
  6: [
    { day: 1, muscles: ["chest", "shoulders", "triceps"] },
    { day: 2, muscles: ["back", "biceps"] },
    { day: 3, muscles: ["quads", "hamstrings", "glutes", "calves"] },
    { day: 4, muscles: ["chest", "shoulders", "triceps"] },
    { day: 5, muscles: ["back", "biceps"] },
    { day: 6, muscles: ["quads", "hamstrings", "glutes", "calves"] },
  ],
};

export default function ConfirmPackageButton({ coachId, clientId, daysPerWeek, hasExistingPlan }) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);

    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + 30);
    const formatted = newEndDate.toISOString().split("T")[0];

    await supabase
      .from("coach_client_links")
      .update({ package_end_date: formatted })
      .eq("coach_id", coachId)
      .eq("client_id", clientId);

    await supabase
      .from("package_requests")
      .update({ confirmed: true })
      .eq("coach_id", coachId)
      .eq("client_id", clientId)
      .eq("confirmed", false);

    if (!hasExistingPlan) {
      const { data: allExercises } = await supabase.from("exercises").select("*");
      const template = SPLIT_TEMPLATES[daysPerWeek] || SPLIT_TEMPLATES[3];
      const usedIds = new Set();
      const rows = [];

      template.forEach((dayPlan) => {
        dayPlan.muscles.forEach((muscle, idx) => {
          let match = allExercises.find(
            (ex) => ex.muscle_groups?.[0] === muscle && !usedIds.has(ex.id)
          );
          if (!match) match = allExercises.find((ex) => ex.muscle_groups?.[0] === muscle);
          if (match) {
            usedIds.add(match.id);
            rows.push({
              client_id: clientId,
              coach_id: coachId,
              day_of_week: dayPlan.day,
              exercise_id: match.id,
              sets: 3,
              reps_target: "8-12",
              weight: "",
              order_index: idx,
            });
          }
        });
      });

      if (rows.length > 0) {
        await supabase.from("workout_plan_exercises").insert(rows);
      }
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={loading}
      style={{
        background: "var(--moss)",
        color: "var(--card)",
        border: "none",
        borderRadius: 6,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {loading ? "..." : hasExistingPlan ? "Confirm renewal (+30 days)" : "Confirm payment & generate plan"}
    </button>
  );
}
