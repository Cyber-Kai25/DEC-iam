"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import VerificationService from "@/lib/services/verification-service";

interface VerificationRecord {
  id: string;
  credentialType: string;
  issuer: string;
  verifiedAt: Date;
  result: "valid" | "invalid" | "expired";
}

export default function VerifierHistoryPage() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);

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
          setRecords([]);
          return;
        }

        const items = Array.isArray(json.data) ? json.data : [];
        const next: VerificationRecord[] = items.map((ev: any) => {
          const verifiedAt = ev?.verified_at ? new Date(ev.verified_at) : new Date();
          const result: "valid" | "invalid" | "expired" =
            ev?.result === "valid" || ev?.result === "invalid" || ev?.result === "expired"
              ? ev.result
              : "invalid";
          return {
            id: String(ev?.id || `${ev?.presentation_id || "evt"}-${ev?.credential_id || "cred"}`),
            credentialType: String(ev?.credential_type || ""),
            issuer: String(ev?.issuer_did || ""),
            verifiedAt,
            result,
          };
        });

        setRecords(next);
      } catch (e) {
        console.error("[v0] Failed to load verifier history:", e);
        setRecords([]);
      }
    })();
  }, []);

  const validRecords = useMemo(() => records.filter((r) => r.result === "valid"), [records]);
  const invalidRecords = useMemo(() => records.filter((r) => r.result === "invalid"), [records]);
  const expiredRecords = useMemo(() => records.filter((r) => r.result === "expired"), [records]);

  return (
    <ProtectedRoute requiredRole="verifier" requiredPermission="read:verification-history">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Verification History</h1>
              <p className="text-muted-foreground mt-2">
                View all credentials you have verified
              </p>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Verified</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{records.length}</div>
                <p className="text-xs text-muted-foreground">Credentials verified</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{validRecords.length}</div>
                <p className="text-xs text-muted-foreground">Authentic credentials</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Invalid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invalidRecords.length}</div>
                <p className="text-xs text-muted-foreground">Failed verification</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expired</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expiredRecords.length}</div>
                <p className="text-xs text-muted-foreground">Expired credentials</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({records.length})</TabsTrigger>
              <TabsTrigger value="valid">Valid ({validRecords.length})</TabsTrigger>
              <TabsTrigger value="invalid">Invalid ({invalidRecords.length})</TabsTrigger>
              <TabsTrigger value="expired">Expired ({expiredRecords.length})</TabsTrigger>
            </TabsList>

            {/* All Records */}
            <TabsContent value="all" className="space-y-2">
              {records.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No verification records yet
                  </CardContent>
                </Card>
              ) : (
                records.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{record.credentialType}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.issuer} • {record.verifiedAt.toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              record.result === "valid"
                                ? "default"
                                : record.result === "invalid"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {record.result}
                          </Badge>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Valid Records */}
            <TabsContent value="valid" className="space-y-2">
              {validRecords.map((record) => (
                <Card key={record.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{record.credentialType}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.issuer} • {record.verifiedAt.toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Invalid Records */}
            <TabsContent value="invalid" className="space-y-2">
              {invalidRecords.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No invalid credentials
                  </CardContent>
                </Card>
              ) : (
                invalidRecords.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{record.credentialType}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.issuer} • {record.verifiedAt.toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Expired Records */}
            <TabsContent value="expired" className="space-y-2">
              {expiredRecords.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No expired credentials
                  </CardContent>
                </Card>
              ) : (
                expiredRecords.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{record.credentialType}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.issuer} • {record.verifiedAt.toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
