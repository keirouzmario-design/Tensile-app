import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
}

// The muscle(s) literally located at/in each body part.
const CORE_MUSCLES = {
  chest: ["chest"], back: ["back"], shoulders: ["shoulders"], biceps: ["biceps"],
  triceps: ["triceps"], forearms: ["forearms"], lats: ["lats"], traps: ["traps"],
  quads: ["quads"], hamstrings: ["hamstrings"], glutes: ["glutes"], calves: ["calves"],
  core: ["core"], obliques: ["core"], hip_flexors: ["quads"], adductors: ["quads"],
  abductors: ["glutes"], rotator_cuff: ["shoulders"], neck: ["traps", "shoulders"],
  upper_back_spine: ["back", "traps"], lower_back_spine: ["back", "core"],
  shoulder_joint: ["shoulders"], elbow: ["biceps", "triceps"], wrist: ["forearms"],
  hip: ["glutes"], knee: ["quads", "hamstrings"], ankle: ["calves"], foot: ["calves"],
  jaw_tmj: [], ribs_sternum: ["chest", "core"], collarbone: ["shoulders"],
  hand_fingers: ["forearms"], toes: ["calves"], achilles_tendon: ["calves"],
  groin: ["quads"], tailbone: ["core"], cardiovascular: [], respiratory: [],
  pregnancy: [], general: [], neurological_balance: [], digestive: [],
  diabetes_bloodsugar: [],
};

// The actual joint each body part corresponds to, if any -- used to match
// against each exercise's joint_stress tags (which joint that movement
// loads, regardless of which muscle it's officially "for").
const BODY_PART_JOINT = {
  shoulders: "shoulder", shoulder_joint: "shoulder", rotator_cuff: "shoulder",
  collarbone: "shoulder", elbow: "elbow", wrist: "wrist", hand_fingers: "wr
