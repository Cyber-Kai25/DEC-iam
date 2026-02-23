"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle } from "lucide-react";

export default function VerifierAnalyticsPage() {
  const metrics = {
    totalVerifications: 247,
    successRate: 94.3,
    averageTime: "2.5s",
    thisMonthVerifications: 45,
    topCredentialType: "EducationCredential",
    topIssuer: "University XYZ",
  };

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
                <div className="text-2xl font-bold">{metrics.averageTime}</div>
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
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Week 1</span>
                    <span>8</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Week 2</span>
                    <span>12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Week 3</span>
                    <span>15</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Week 4</span>
                    <span>10</span>
                  </div>
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
                    {metrics.topCredentialType}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded">
                  <p className="font-medium text-sm">Top Issuer</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.topIssuer}
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
                {[
                  { type: "EducationCredential", success: 96, time: "2.1s", count: 145 },
                  { type: "ProfessionalLicense", success: 92, time: "3.2s", count: 78 },
                  { type: "EmploymentCredential", success: 94, time: "2.8s", count: 24 },
                ].map((row) => (
                  <div key={row.type} className="p-3 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{row.type}</span>
                      <Badge variant="outline">{row.count} verified</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                      <div>Success Rate: {row.success}%</div>
                      <div>Avg. Time: {row.time}</div>
                    </div>
                  </div>
                ))}
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
