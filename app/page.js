import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "coach") {
      redirect("/dashboard/coach");
    } else if (profile?.role === "client") {
      redirect("/dashboard/client");
    }
  }

  return (
    <div className="page">
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div className="wordmark">TENSILE</div>
        <p className="muted" style={{ marginTop: 6 }}>
          Meal and training plans, built around your goals.
        </p>
      </div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <a href="/login" className="btn-primary" style={{ textDecoration: "none", textAlign: "center" }}>
          Log in
        </a>
        <a
          href="/signup"
          style={{
            textAlign: "center",
            padding: "12px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            textDecoration: "none",
            color: "var(--ink)",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Create an account
        </a>
      </div>
    </div>
  );
}
