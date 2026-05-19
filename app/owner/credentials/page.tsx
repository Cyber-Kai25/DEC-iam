"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CredentialCard } from "@/components/credential-card";
import { FileCheck, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import VerificationService from "@/lib/services/verification-service";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

export default function OwnerCredentialsPage() {
  const { credentials, currentIdentity } = useIdentity();

  const [presentCredential, setPresentCredential] = useState<any | null>(null);
  const [isPresentOpen, setIsPresentOpen] = useState(false);
  const [directory, setDirectory] = useState<Array<{ did: string; name: string; description?: string }>>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [selectedVerifierDid, setSelectedVerifierDid] = useState<string>("");
  const [isVerifierPickerOpen, setIsVerifierPickerOpen] = useState(false);
  const [isSendingPresentation, setIsSendingPresentation] = useState(false);

  const selectedVerifier = useMemo(() => {
    if (!selectedVerifierDid) return null;
    return directory.find((d) => d.did === selectedVerifierDid) || null;
  }, [directory, selectedVerifierDid]);

  useEffect(() => {
    if (!isPresentOpen) return;
    if (directory.length > 0 || isLoadingDirectory) return;
    void (async () => {
      try {
        setDirectoryError(null);
        setIsLoadingDirectory(true);
        const res = await fetch("/api/organizations/directory");
        const json = await res.json();
        if (!res.ok || !json?.success) {
          setDirectoryError(json?.error || "Failed to load organizations");
          return;
        }
        setDirectory(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        setDirectoryError(e instanceof Error ? e.message : "Failed to load organizations");
      } finally {
        setIsLoadingDirectory(false);
      }
    })();
  }, [directory.length, isLoadingDirectory, isPresentOpen]);

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
    setPresentCredential(credential);
    setSelectedVerifierDid("");
    setIsPresentOpen(true);
  };

  const handleSendPresentation = async () => {
    try {
      if (!presentCredential) return;
      if (!currentIdentity?.privateKeyHex) {
        toast.error("No identity private key available");
        return;
      }
      if (!selectedVerifierDid) {
        toast.error("Select a verifier organization");
        return;
      }

      setIsSendingPresentation(true);
      const challenge = crypto.randomUUID();
      const result = VerificationService.createPresentation(
        [presentCredential],
        currentIdentity.did,
        selectedVerifierDid,
        challenge,
        currentIdentity.privateKeyHex
      );
      const presentation = result.presentation;

      const res = await fetch("/api/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-active-role": "owner" },
        body: JSON.stringify({ verifierDid: selectedVerifierDid, presentation }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        toast.error(json?.error || "Failed to deliver presentation");
        return;
      }

      const blob = new Blob([JSON.stringify(presentation, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `presentation-${presentCredential.id}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Presentation delivered to verifier");
      setIsPresentOpen(false);
      setPresentCredential(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deliver presentation");
    } finally {
      setIsSendingPresentation(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="owner" requiredPermission="receive:credential">
      <AppShell>
        <div className="space-y-8">
          <Dialog open={isPresentOpen} onOpenChange={setIsPresentOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Present Credential</DialogTitle>
                <DialogDescription>Select the verifier organization to receive your presentation.</DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Verifier Organization</label>
                <Popover open={isVerifierPickerOpen} onOpenChange={setIsVerifierPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isVerifierPickerOpen}
                      className="w-full justify-between"
                      disabled={isLoadingDirectory}
                    >
                      {selectedVerifier ? selectedVerifier.name : isLoadingDirectory ? "Loading..." : "Select verifier organization"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search organizations..." />
                      <CommandList>
                        <CommandEmpty>No organizations found.</CommandEmpty>
                        <CommandGroup>
                          {directory.map((o) => (
                            <CommandItem
                              key={o.did}
                              value={`${o.name} ${o.did}`}
                              onSelect={() => {
                                setSelectedVerifierDid(o.did);
                                setIsVerifierPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedVerifierDid === o.did ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span>{o.name}</span>
                                <span className="text-xs text-muted-foreground font-mono break-all">{o.did}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {!!directoryError && <div className="text-sm text-destructive">{directoryError}</div>}
              </div>

              {!!selectedVerifier && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="font-medium">Destination DID</div>
                  <div className="text-muted-foreground font-mono break-all">{selectedVerifier.did}</div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPresentOpen(false)} disabled={isSendingPresentation}>
                  Cancel
                </Button>
                <Button onClick={handleSendPresentation} disabled={!selectedVerifierDid || isSendingPresentation}>
                  {isSendingPresentation ? "Sending..." : "Send Presentation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
