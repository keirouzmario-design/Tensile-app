import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InjuryForm from "./injury-form";
import InjuryList from "./injury-list";

export default async function InjuriesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: link } = await supabase
    .from("coach_client_links")
    .select("coach_id")
    .eq("client_id", user.id)
    .maybeSingle();

  const { data: injuries } = await supabase
    .from("client_injuries")
    .select("*")
    .eq("client_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Injuries & Limitations</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Report anything that should change your training. Your coach will see
        this too.
      </p>
      <InjuryList injuries={injuries || []} />
      {link?.coach_id && <InjuryForm userId={user.id} coachId={link.coach_id} />}
      {!link?.coach_id && (
        <div className="empty-state">You&apos;re not linked to a coach yet.</div>
      )}
    </div>
  );
}
