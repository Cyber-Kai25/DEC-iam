"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function IssuerRevokePage() {
  const { credentials } = useIdentity();
  const [revoked, setRevoked] = useState<string[]>([]);

  const activeCredentials = credentials.filter(
    (c) => c.issuer && (!c.expirationDate || new Date(c.expirationDate) > new Date()) && !revoked.includes(c.id)
  );

  const revokedCredentials = credentials.filter((c) => revoked.includes(c.id));

  const handleRevoke = (credentialId: string) => {
    setRevoked([...revoked, credentialId]);
    toast.success("Credential revoked successfully");
  };

  return (
    <ProtectedRoute requiredRole="issuer" requiredPermission="revoke:issued-credential">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Revoke Credentials</h1>
            <p className="text-muted-foreground mt-2">
              Invalidate previously issued credentials
            </p>
          </div>

          {/* Warning */}
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Revocation is permanent</p>
                <p className="text-sm text-amber-800 mt-1">
                  Once revoked, a credential cannot be verified and recipients will be notified
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

          {/* Revoke List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Active Credentials</h2>
            {activeCredentials.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No active credentials available to revoke
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {activeCredentials.map((cred) => (
                  <Card key={cred.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{cred.type[0]}</p>
                          <p className="text-sm text-muted-foreground">
                            Issued: {new Date(cred.issuanceDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => handleRevoke(cred.id)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Revoke
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Revoked List */}
          {revokedCredentials.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Revoked Credentials</h2>
              <div className="space-y-2">
                {revokedCredentials.map((cred) => (
                  <Card key={cred.id} className="opacity-60">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium line-through">{cred.type[0]}</p>
                          <p className="text-sm text-muted-foreground">
                            Revoked: {new Date().toLocaleDateString()}
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
