import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/sign-out-button";
import ClientNav from "./client-nav";

export default async function ClientLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "client") redirect("/dashboard/coach");

  return (
    <div>
      <div className="top-bar">
        <span className="wordmark">TENSILE</span>
        <SignOutButton />
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 20px 0" }}>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Hi {profile?.full_name}</h1>
        <ClientNav />
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}
