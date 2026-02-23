"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CredentialCard } from "@/components/credential-card";
import { Plus, FileCheck, Eye, Share2, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function OwnerCredentialsPage() {
  const { credentials, policies } = useIdentity();
  const [selectedCredential, setSelectedCredential] = useState<typeof credentials[0] | null>(null);

  const activeCredentials = credentials.filter(
    (c) => !c.expirationDate || new Date(c.expirationDate) > new Date()
  );
  const expiredCredentials = credentials.filter(
    (c) => c.expirationDate && new Date(c.expirationDate) <= new Date()
  );
  const revokedCredentials = credentials.filter((c) => c.revoked);

  const handleShareCredential = (credentialId: string) => {
    toast.success(`Credential ${credentialId} shared successfully`);
  };

  const handleDownloadCredential = (credentialId: string) => {
    toast.success(`Credential ${credentialId} downloaded`);
  };

  const handlePresentCredential = (credentialId: string) => {
    toast.info(`Presentation initiated for credential ${credentialId}`);
  };

  return (
    <ProtectedRoute requiredRole="owner" requiredPermission="receive:credential">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Credentials</h1>
            <p className="text-muted-foreground mt-2">
              View and manage your verifiable credentials
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Credentials</CardTitle>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{credentials.length}</div>
                <p className="text-xs text-muted-foreground">Across all issuers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <Badge variant="default" className="bg-green-600">
                  {activeCredentials.length}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Valid and usable</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expired</CardTitle>
                <Badge variant="secondary">{expiredCredentials.length}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">No longer valid</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revoked</CardTitle>
                <Badge variant="destructive">{revokedCredentials.length}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Revoked by issuer</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">Active ({activeCredentials.length})</TabsTrigger>
              <TabsTrigger value="expired">Expired ({expiredCredentials.length})</TabsTrigger>
              <TabsTrigger value="revoked">Revoked ({revokedCredentials.length})</TabsTrigger>
            </TabsList>

            {/* Active Credentials */}
            <TabsContent value="active" className="space-y-4">
              {activeCredentials.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No active credentials. Credentials from issuers will appear here.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {activeCredentials.map((credential) => (
                    <CredentialCard key={credential.id} credential={credential} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Expired Credentials */}
            <TabsContent value="expired" className="space-y-4">
              {expiredCredentials.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No expired credentials.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {expiredCredentials.map((credential) => (
                    <CredentialCard key={credential.id} credential={credential} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Revoked Credentials */}
            <TabsContent value="revoked" className="space-y-4">
              {revokedCredentials.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No revoked credentials.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {revokedCredentials.map((credential) => (
                    <CredentialCard key={credential.id} credential={credential} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
