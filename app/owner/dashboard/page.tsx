"use client";

import { useRole } from "@/lib/context/role-context";
import { useIdentity } from "@/lib/context/identity-context";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, FileCheck, CheckCircle2, Shield, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OwnerDashboard() {
  const { activeRole, isAuthenticated } = useRole();
  const { currentIdentity, credentials, policies } = useIdentity();
  const router = useRouter();

  useEffect(() => {
    if (activeRole !== "owner") {
      router.push("/");
    }
  }, [activeRole, router]);

  const recentCredentials = credentials.slice(0, 3);
  const activePolicies = policies.filter((p) => p.active);

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Owner Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your digital identity, credentials, and access policies
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Identities</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentIdentity ? 1 : 0}</div>
              <p className="text-xs text-muted-foreground">Digital identities owned</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credentials</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{credentials.length}</div>
              <p className="text-xs text-muted-foreground">Received credentials</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Access Policies</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activePolicies.length}</div>
              <p className="text-xs text-muted-foreground">Active access policies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Badge variant="outline" className="bg-green-50">
                  Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Identity verified</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Credentials */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Credentials</CardTitle>
                  <CardDescription>
                    Credentials you have received
                  </CardDescription>
                </div>
                <Link href="/owner/credentials">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentCredentials.length > 0 ? (
                recentCredentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="p-3 border rounded-lg hover:bg-muted transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{cred.type[0]}</p>
                        <p className="text-xs text-muted-foreground">
                          Issued by {cred.issuer.slice(0, 20)}...
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Valid
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No credentials received yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Request credentials from trusted issuers
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/owner/identity" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Lock className="h-4 w-4 mr-2" />
                  View My Identity
                </Button>
              </Link>
              <Link href="/owner/credentials" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <FileCheck className="h-4 w-4 mr-2" />
                  Manage Credentials
                </Button>
              </Link>
              <Link href="/owner/verify-requests" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verification Requests
                </Button>
              </Link>
              <Link href="/owner/policies" className="block">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Shield className="h-4 w-4 mr-2" />
                  Access Policies
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started */}
        {!currentIdentity && (
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">Get Started</CardTitle>
              <CardDescription className="text-blue-700">
                Create your first decentralized identity to begin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Create My First Identity
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
