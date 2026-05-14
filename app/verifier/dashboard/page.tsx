"use client";

import { useRole } from "@/lib/context/role-context";
import { useIdentity } from "@/lib/context/identity-context";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, Mail, BarChart3, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function VerifierDashboard() {
  const { activeRole, activeOrganization } = useRole();
  const { policies, credentials } = useIdentity();

  const [verificationCount, setVerificationCount] = useState(0);
  const [presentations, setPresentations] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [verificationsRes, presentationsRes] = await Promise.all([
          fetch("/api/verifications", {
            method: "GET",
            headers: { "x-active-role": "verifier" },
            cache: "no-store",
          }),
          fetch("/api/presentations", {
            method: "GET",
            headers: { "x-active-role": "verifier" },
            cache: "no-store",
          }),
        ]);

        const verificationsJson = await verificationsRes.json();
        if (verificationsRes.ok && verificationsJson?.success) {
          setVerificationCount(Array.isArray(verificationsJson.data) ? verificationsJson.data.length : 0);
        }

        const presentationsJson = await presentationsRes.json();
        if (presentationsRes.ok && presentationsJson?.success) {
          setPresentations(Array.isArray(presentationsJson.data) ? presentationsJson.data : []);
        }
      } catch (e) {
        console.error("[v0] Failed to load verifier dashboard stats:", e);
      }
    })();
  }, []);

  const verificationPolicies = policies.filter((p) => p.resourceType === "credential");

  const thisMonthVerifications = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return presentations.filter((p) => {
      const createdAt = p?.createdAt ? new Date(p.createdAt) : null;
      return createdAt ? createdAt >= start : false;
    }).length;
  }, [presentations]);

  const successRate = useMemo(() => {
    if (presentations.length === 0) return 0;
    const accepted = presentations.filter((p) => p?.status === "accepted").length;
    return Math.round((accepted / presentations.length) * 1000) / 10;
  }, [presentations]);

  const trendRows = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    return days.map((day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const dayItems = presentations.filter((p) => {
        const createdAt = p?.createdAt ? new Date(p.createdAt) : null;
        return createdAt ? createdAt >= day && createdAt < next : false;
      });
      const accepted = dayItems.filter((p) => p?.status === "accepted").length;
      const rejected = dayItems.filter((p) => p?.status === "rejected").length;
      const pending = dayItems.filter((p) => p?.status === "pending").length;

      let status: "Verified" | "Pending" | "Failed" = "Pending";
      if (rejected > 0) status = "Failed";
      if (accepted > 0 && rejected === 0) status = "Verified";
      if (accepted === 0 && rejected === 0 && pending === 0) status = "Verified";

      return {
        day: day.toLocaleDateString(undefined, { weekday: "short" }),
        count: dayItems.length,
        status,
      };
    });
  }, [presentations]);

  return (
    <ProtectedRoute requiredRole="verifier">
      <AppShell>
        <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Verifier Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            {activeOrganization
              ? `Verify credentials for ${activeOrganization.name}`
              : "Verify and validate credentials from identity owners"}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{verificationCount}</div>
              <p className="text-xs text-muted-foreground">Credentials verified</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground">Verification success</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{thisMonthVerifications}</div>
              <p className="text-xs text-muted-foreground">Verifications performed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Policies</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{verificationPolicies.length}</div>
              <p className="text-xs text-muted-foreground">Verification policies</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Verification Request */}
          <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-900">Create Verification Request</CardTitle>
              <CardDescription className="text-purple-700">
                Request credentials from identity owners
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/verifier/requests" className="block">
                <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4" />
                  New Request
                </Button>
              </Link>
              <Link href="/verifier/policies" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  Manage Policies
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Verification workflows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/verifier/verify" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verify Credentials
                </Button>
              </Link>
              <Link href="/verifier/history" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Mail className="h-4 w-4 mr-2" />
                  Verification History
                </Button>
              </Link>
              <Link href="/verifier/analytics" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
              </Link>
              <Link href="/verifier/organization" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  Organization Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Verification Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Trends</CardTitle>
            <CardDescription>Last 7 days performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                ...trendRows,
              ].map((item) => (
                <div key={item.day} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="font-medium text-sm w-10">{item.day}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (item.count / 3) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        item.status === "Verified"
                          ? "default"
                          : item.status === "Failed"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-xs"
                    >
                      {item.count} {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
