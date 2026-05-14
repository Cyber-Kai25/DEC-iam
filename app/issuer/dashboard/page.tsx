"use client";

import { useRole } from "@/lib/context/role-context";
import { useIdentity } from "@/lib/context/identity-context";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Award, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

export default function IssuerDashboard() {
  const { activeRole, activeOrganization } = useRole();
  const { credentials } = useIdentity();

  const issuedCredentials = credentials.filter((c) => c.issuer);
  const totalIssued = issuedCredentials.length;
  const activeCredentials = issuedCredentials.filter(
    (c) => !c.expirationDate || new Date(c.expirationDate) > new Date()
  ).length;
  const expiredCredentials = totalIssued - activeCredentials;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthIssued = issuedCredentials.filter((c) => {
    const issuedAt = c.issuanceDate ? new Date(c.issuanceDate) : null;
    return issuedAt ? issuedAt >= monthStart : false;
  }).length;

  return (
    <ProtectedRoute requiredRole="issuer">
      <AppShell>
        <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Issuer Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            {activeOrganization
              ? `Manage credentials for ${activeOrganization.name}`
              : "Issue and manage verifiable credentials"}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Issued</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalIssued}</div>
              <p className="text-xs text-muted-foreground">Credentials issued</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCredentials}</div>
              <p className="text-xs text-muted-foreground">Non-expired credentials</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expiredCredentials}</div>
              <p className="text-xs text-muted-foreground">Expired credentials</p>
            </CardContent>
          </Card>
{thisMonthIssued}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">New credentials issued</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Issue New Credential */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-900">Issue New Credential</CardTitle>
              <CardDescription className="text-green-700">
                Create and issue a verifiable credential
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/issuer/issue" className="block">
                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4" />
                  Issue Credential
                </Button>
              </Link>
              <Link href="/issuer/templates" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  Manage Templates
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/issuer/history" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Award className="h-4 w-4 mr-2" />
                  Credential History
                </Button>
              </Link>
              <Link href="/issuer/revoke" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  Revoke Credentials
                </Button>
              </Link>
              <Link href="/issuer/audit" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  Audit Logs
                </Button>
              </Link>
              <Link href="/issuer/organization" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  Organization Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest credential issuances and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {issuedCredentials.slice(0, 5).length > 0 ? (
                issuedCredentials.slice(0, 5).map((cred) => (
                  <div key={cred.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{cred.type[0]}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(cred.issuanceDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary">Issued</Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No credentials issued yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
