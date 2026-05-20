"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CredRow = {
  id: string;
  type: string | string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  _status?: string;
  _credentialId?: string;
  _subjectDid?: string;
};

function credType(c: CredRow) {
  const t = c.type;
  if (Array.isArray(t)) return t.find((x) => x !== "VerifiableCredential") || t[0] || "Credential";
  return typeof t === "string" ? t : "Credential";
}

export default function IssuerRevokePage() {
  const [credentials, setCredentials] = useState<CredRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

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
      }
    } catch (e) {
      toast.error("Failed to load credentials");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const activeCredentials = useMemo(
    () =>
      credentials.filter(
        (c) =>
          c._status !== "revoked" &&
          (!c.expirationDate || new Date(c.expirationDate) > new Date())
      ),
    [credentials]
  );

  const revokedCredentials = useMemo(
    () => credentials.filter((c) => c._status === "revoked"),
    [credentials]
  );

  const handleRevoke = async (cred: CredRow) => {
    const credentialId = cred._credentialId || cred.id;
    setRevoking(credentialId);
    try {
      const res = await fetch("/api/credentials/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-active-role": "issuer",
        },
        body: JSON.stringify({ credentialId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        toast.error(json?.error || "Failed to revoke credential");
        return;
      }
      toast.success("Credential revoked successfully");
      // Update local state
      setCredentials((prev) =>
        prev.map((c) =>
          (c._credentialId || c.id) === credentialId ? { ...c, _status: "revoked" } : c
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke credential");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <ProtectedRoute requiredRole="issuer" requiredPermission="revoke:issued-credential">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Revoke Credentials</h1>
              <p className="text-muted-foreground mt-2">
                Invalidate previously issued credentials
              </p>
            </div>
            <Button variant="outline" onClick={fetchCredentials} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Warning */}
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">Revocation is permanent</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  Once revoked, a credential cannot be verified and the status is recorded in the database
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Credentials</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCredentials.length}</div>
                <p className="text-xs text-muted-foreground">Can be revoked</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revoked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{revokedCredentials.length}</div>
                <p className="text-xs text-muted-foreground">Invalidated credentials</p>
              </CardContent>
            </Card>
          </div>

          {/* Active list */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Active Credentials</h2>
            {isLoading ? (
              <Card><CardContent className="pt-6 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : activeCredentials.length === 0 ? (
              <Card><CardContent className="pt-6 text-center text-muted-foreground">No active credentials available to revoke</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {activeCredentials.map((cred) => (
                  <Card key={cred.id || cred._credentialId}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{credType(cred)}</p>
                          <p className="text-sm text-muted-foreground">
                            Issued: {new Date(cred.issuanceDate).toLocaleDateString()}
                          </p>
                          {cred._subjectDid && (
                            <p className="text-xs text-muted-foreground truncate mt-1">To: {cred._subjectDid}</p>
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => handleRevoke(cred)}
                          disabled={revoking === (cred._credentialId || cred.id)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {revoking === (cred._credentialId || cred.id) ? "Revoking..." : "Revoke"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Revoked list */}
          {revokedCredentials.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Revoked Credentials</h2>
              <div className="space-y-2">
                {revokedCredentials.map((cred) => (
                  <Card key={cred.id || cred._credentialId} className="opacity-60">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium line-through">{credType(cred)}</p>
                          <p className="text-sm text-muted-foreground">
                            Issued: {new Date(cred.issuanceDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="destructive">Revoked</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
