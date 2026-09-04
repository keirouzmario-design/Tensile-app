import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
}

export default async function ClientHome() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: link } = await supabase
    .from("coach_client_links")
    .select("package_end_date, profiles:coach_id (full_name)")
    .eq("client_id", user.id)
    .maybeSingle();

  const status = getAccessStatus(link?.package_end_date);

  return (
    <div>
      {status === "active" && (
        <div className="empty-state">
          Your package is active until {link.package_end_date}. Use the tabs
          above to view your workout plan.
        </div>
      )}
      {status === "pending" && (
        <div className="empty-state">
          Head to the Package tab to choose your training days and get started.
        </div>
      )}
      {status === "expired" && (
        <div className="empty-state">
          Your package expired on {link.package_end_date}. Visit the Package
          tab to renew.
        </div>
      )}
    </div>
  );
}
