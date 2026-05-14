"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CredentialCard } from "@/components/credential-card";
import { FileCheck } from "lucide-react";
import { toast } from "sonner";
import VerificationService from "@/lib/services/verification-service";

export default function OwnerCredentialsPage() {
  const { credentials, currentIdentity } = useIdentity();

  const activeCredentials = credentials.filter(
    (c) => !c.expirationDate || new Date(c.expirationDate) > new Date()
  );
  const expiredCredentials = credentials.filter(
    (c) => c.expirationDate && new Date(c.expirationDate) <= new Date()
  );
  const revokedCredentials = credentials.filter((c) => (c as any).revoked);

  const handleVerifyCredential = async (credential: any) => {
    try {
      const result = VerificationService.verifyCredential(credential);
      if (!result.valid) {
        toast.error(result.error || "Credential verification failed");
        return;
      }
      toast.success("Credential verified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Credential verification failed");
    }
  };

  const handleDownloadCredential = (credential: any) => {
    try {
      const data = JSON.stringify(credential, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `credential-${credential.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Credential downloaded");
    } catch {
      toast.error("Failed to download credential");
    }
  };

  const handlePresentCredential = (credential: any) => {
    try {
      if (!currentIdentity?.privateKeyHex) {
        toast.error("No identity private key available");
        return;
      }
      const verifierDid = window.prompt("Enter verifier DID");
      if (!verifierDid) {
        return;
      }
      const challenge = crypto.randomUUID();
      const result = VerificationService.createPresentation(
        [credential],
        currentIdentity.did,
        verifierDid,
        challenge,
        currentIdentity.privateKeyHex
      );
      const presentation = result.presentation;

      void (async () => {
        try {
          const res = await fetch('/api/presentations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verifierDid, presentation }),
          });
          const json = await res.json();
          if (!res.ok || !json?.success) {
            toast.error(json?.error || 'Failed to deliver presentation');
            return;
          }
          toast.success('Presentation delivered to verifier');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Failed to deliver presentation');
        }
      })();

      const blob = new Blob([JSON.stringify(presentation, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `presentation-${credential.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Presentation created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create presentation");
    }
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
                    <CredentialCard
                      key={credential.id}
                      credential={credential}
                      onVerify={handleVerifyCredential}
                      onDownload={handleDownloadCredential}
                      onPresent={handlePresentCredential}
                    />
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
                    <CredentialCard
                      key={credential.id}
                      credential={credential}
                      onVerify={handleVerifyCredential}
                      onDownload={handleDownloadCredential}
                      onPresent={handlePresentCredential}
                    />
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
                    <CredentialCard
                      key={credential.id}
                      credential={credential}
                      onVerify={handleVerifyCredential}
                      onDownload={handleDownloadCredential}
                      onPresent={handlePresentCredential}
                    />
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
