import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InjuryForm from "./injury-form";

export default async function InjuriesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("injuries")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Injuries & Limitations</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Keep this updated any time something changes — your coach will adjust
        your plan accordingly.
      </p>
      <InjuryForm userId={user.id} initialValue={profile?.injuries || ""} />
    </div>
  );
}
