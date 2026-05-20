"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CredRow = {
  id: string;
  type: string | string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject?: any;
  _status?: string;
  _credentialId?: string;
  _subjectDid?: string;
};

function credType(c: CredRow) {
  const t = c.type;
  if (Array.isArray(t)) {
    return t.find((x) => x !== "VerifiableCredential") || t[0] || "Credential";
  }
  return typeof t === "string" ? t : "Credential";
}

function credStatus(c: CredRow): "active" | "revoked" | "expired" {
  if (c._status === "revoked") return "revoked";
  if (c.expirationDate && new Date(c.expirationDate) <= new Date()) return "expired";
  return "active";
}

export default function IssuerHistoryPage() {
  const [credentials, setCredentials] = useState<CredRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "GET",
        headers: { "x-active-role": "issuer" },
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setCredentials(json.data || []);
      } else {
        toast.error(json?.error || "Failed to load credentials");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load credentials");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const activeCredentials = useMemo(
    () => credentials.filter((c) => credStatus(c) === "active"),
    [credentials]
  );
  const revokedCredentials = useMemo(
    () => credentials.filter((c) => credStatus(c) === "revoked"),
    [credentials]
  );
  const expiredCredentials = useMemo(
    () => credentials.filter((c) => credStatus(c) === "expired"),
    [credentials]
  );

  const renderCredentialCard = (cred: CredRow) => {
    const status = credStatus(cred);
    return (
      <Card key={cred.id || cred._credentialId}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{credType(cred)}</p>
              <p className="text-sm text-muted-foreground">
                Issued: {new Date(cred.issuanceDate).toLocaleDateString()}
              </p>
              {cred._subjectDid && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  To: {cred._subjectDid}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={
                  status === "active"
                    ? "secondary"
                    : status === "revoked"
                      ? "destructive"
                      : "outline"
                }
              >
                {status === "active" ? "Active" : status === "revoked" ? "Revoked" : "Expired"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ProtectedRoute requiredRole="issuer" requiredPermission="read:issuance-history">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Credential History</h1>
              <p className="text-muted-foreground mt-2">
                View all credentials you have issued
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchCredentials} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Issued</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{credentials.length}</div>
                <p className="text-xs text-muted-foreground">All credentials</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCredentials.length}</div>
                <p className="text-xs text-muted-foreground">Currently valid</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revoked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{revokedCredentials.length}</div>
                <p className="text-xs text-muted-foreground">Invalidated</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expired</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expiredCredentials.length}</div>
                <p className="text-xs text-muted-foreground">No longer valid</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({credentials.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({activeCredentials.length})</TabsTrigger>
              <TabsTrigger value="revoked">Revoked ({revokedCredentials.length})</TabsTrigger>
              <TabsTrigger value="expired">Expired ({expiredCredentials.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {isLoading ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : credentials.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No credentials issued yet</CardContent></Card>
              ) : (
                <div className="space-y-2">{credentials.map(renderCredentialCard)}</div>
              )}
            </TabsContent>

            <TabsContent value="active" className="space-y-4">
              {activeCredentials.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No active credentials</CardContent></Card>
              ) : (
                <div className="space-y-2">{activeCredentials.map(renderCredentialCard)}</div>
              )}
            </TabsContent>

            <TabsContent value="revoked" className="space-y-4">
              {revokedCredentials.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No revoked credentials</CardContent></Card>
              ) : (
                <div className="space-y-2">{revokedCredentials.map(renderCredentialCard)}</div>
              )}
            </TabsContent>

            <TabsContent value="expired" className="space-y-4">
              {expiredCredentials.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No expired credentials</CardContent></Card>
              ) : (
                <div className="space-y-2">{expiredCredentials.map(renderCredentialCard)}</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
