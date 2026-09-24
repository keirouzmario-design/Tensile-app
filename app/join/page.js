"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const codeFromLink = searchParams.get("code") || "";

  const [code, setCode] = useState(codeFromLink.toUpperCase());
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: "success" | "error", message }

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setRole(profile?.role || null);
      }

      setCheckingAuth(false);
    }

    checkAuth();
  }, []);

  async function handleJoin() {
    if (!code.trim()) {
      setResult({ type: "error", message: "Please enter an access code." });
      return;
    }

    setSubmitting(true);
    setResult(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("redeem_access_code", {
      code_input: code.trim(),
    });

    setSubmitting(false);

    if (error) {
      setResult({
        type: "error",
        message:
          error.message === "Invalid access code"
            ? "That code doesn't match any coach. Double-check it and try again."
            : "Something went wrong. Please try again.",
      });
      return;
    }

    const coachName = data?.[0]?.coach_name || "your coach";
    setResult({
      type: "success",
      message: `You're linked to ${coachName}. Head to your dashboard to get started.`,
    });
  }

  if (checkingAuth) {
    return <div style={{ padding: 24, color: "var(--steel)" }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "48px 20px" }}>
      <div className="wordmark" style={{ marginBottom: 24 }}>
        TENSILE
      </div>

      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Join a coach</h1>

      {!user ? (
        <div className="card" style={{ padding: 18 }}>
          <p style={{ fontSize: 14, marginBottom: 14 }}>
            Log in or create an athlete account first, then come back to this
            same link to finish joining.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => router.push("/login")}
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: "var(--moss-deep)",
                color: "var(--card)",
                cursor: "pointer",
              }}
            >
              Log In
            </button>
            <button
              onClick={() => router.push("/signup")}
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--card)",
                color: "var(--steel)",
                cursor: "pointer",
              }}
            >
              Sign Up
            </button>
          </div>
        </div>
      ) : role === "coach" ? (
        <div className="card" style={{ padding: 18 }}>
          <p style={{ fontSize: 14 }}>
            You're logged in as a coach. Access codes are for athletes joining
            a coach's roster, so this isn't something you can use on your own
            account.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 18 }}>
          <label style={{ fontSize: 12, color: "var(--steel)", fontWeight: 600 }}>
            ACCESS CODE
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. WOLF482"
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              marginBottom: 14,
              padding: "10px 12px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.08em",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--card)",
              color: "inherit",
            }}
          />

          <button
            onClick={handleJoin}
            disabled={submitting}
            style={{
              fontSize: 14,
              fontWeight: 700,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--moss-deep)",
              color: "var(--card)",
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.6 : 1,
              width: "100%",
            }}
          >
            {submitting ? "Joining…" : "Join Coach"}
          </button>

          {result && (
            <div
              style={{
                marginTop: 14,
                fontSize: 13,
                color: result.type === "success" ? "var(--moss)" : "var(--rust)",
              }}
            >
              {result.message}
            </div>
          )}

          {result?.type === "success" && (
            <button
              onClick={() => router.push("/dashboard/client")}
              style={{
                marginTop: 10,
                fontSize: 13,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--card)",
                color: "var(--steel)",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Go to Dashboard
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <JoinContent />
    </Suspense>
  );
}
