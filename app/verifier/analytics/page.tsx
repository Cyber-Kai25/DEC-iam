"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function VerifierAnalyticsPage() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/verification-events", {
          method: "GET",
          headers: { "x-active-role": "verifier" },
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json?.success) {
          setEvents([]);
          return;
        }
        setEvents(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        console.error("[v0] Failed to load verifier analytics:", e);
        setEvents([]);
      }
    })();
  }, []);

  const metrics = useMemo(() => {
    const totalVerifications = events.length;
    const validCount = events.filter((e) => e?.result === "valid").length;
    const successRate = totalVerifications === 0 ? 0 : Math.round((validCount / totalVerifications) * 1000) / 10;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthVerifications = events.filter((ev) => {
      const createdAt = ev?.verified_at ? new Date(ev.verified_at) : null;
      return createdAt ? createdAt >= start : false;
    }).length;

    const byType = new Map<string, number>();
    const byIssuer = new Map<string, number>();

    for (const ev of events) {
      const type = typeof ev?.credential_type === "string" ? ev.credential_type : "";
      if (type) byType.set(type, (byType.get(type) || 0) + 1);
      const issuer = typeof ev?.issuer_did === "string" ? ev.issuer_did : "";
      if (issuer) byIssuer.set(issuer, (byIssuer.get(issuer) || 0) + 1);
    }

    const topCredentialType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const topIssuer = [...byIssuer.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    return {
      totalVerifications,
      successRate,
      averageTime: "",
      thisMonthVerifications,
      topCredentialType,
      topIssuer,
      byType,
    };
  }, [events]);

  return (
    <ProtectedRoute requiredRole="verifier">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-2">
              Verification trends and insights
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalVerifications}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.successRate}%</div>
                <p className="text-xs text-muted-foreground">Verification success</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Verification Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.averageTime || "-"}</div>
                <p className="text-xs text-muted-foreground">Per credential</p>
              </CardContent>
            </Card>
          </div>

          {/* Trends */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>This Month</CardTitle>
                <CardDescription>Verification activity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">{metrics.thisMonthVerifications}</div>
                <div className="space-y-2 text-sm">
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Insights</CardTitle>
                <CardDescription>Recent trends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted rounded">
                  <p className="font-medium text-sm">Most Verified Credential</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.topCredentialType || "-"}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded">
                  <p className="font-medium text-sm">Top Issuer</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.topIssuer || "-"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Performance by Credential Type</CardTitle>
              <CardDescription>Success rates and verification times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...metrics.byType.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{type}</span>
                        <Badge variant="outline">{count} verified</Badge>
                      </div>
                    </div>
                  ))}

                {metrics.byType.size === 0 && (
                  <div className="p-3 border rounded text-sm text-muted-foreground">
                    No verification analytics yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 text-sm">Anomaly Detected</p>
                <p className="text-sm text-amber-800 mt-1">
                  5 failed verifications from new issuer detected. Review issuer credentials before verification.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
