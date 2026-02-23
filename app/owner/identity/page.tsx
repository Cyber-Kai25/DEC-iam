"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { useRole } from "@/lib/context/role-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, Upload, RefreshCw, CheckCircle2, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function OwnerIdentityPage() {
  const { currentIdentity, createIdentity } = useIdentity();
  const { hasPermission } = useRole();
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const handleCreateIdentity = async () => {
    try {
      const identity = createIdentity();
      toast.success("Identity created successfully!");
    } catch (error) {
      toast.error("Failed to create identity");
    }
  };

  const handleCopyDID = () => {
    if (currentIdentity) {
      navigator.clipboard.writeText(currentIdentity.did);
      toast.success("DID copied to clipboard");
    }
  };

  const handleExportIdentity = () => {
    if (currentIdentity) {
      const data = JSON.stringify(currentIdentity, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `identity-${currentIdentity.id}.json`;
      a.click();
      toast.success("Identity exported successfully");
    }
  };

  return (
    <ProtectedRoute requiredRole="owner" requiredPermission="read:own-identity">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Digital Identity</h1>
            <p className="text-muted-foreground mt-2">
              Create, manage, and control your decentralized identity
            </p>
          </div>

          {currentIdentity ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="keys">Keys & Security</TabsTrigger>
                <TabsTrigger value="export">Export & Backup</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Identity Information</CardTitle>
                    <CardDescription>Your decentralized identifier (DID)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">DID</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                          {currentIdentity.did}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyDID}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Wallet Address</Label>
                        <code className="block p-3 bg-muted rounded text-sm font-mono break-all">
                          {currentIdentity.walletAddress}
                        </code>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Created</Label>
                        <div className="p-3 bg-muted rounded text-sm">
                          {typeof currentIdentity.createdAt === "string"
                            ? new Date(currentIdentity.createdAt).toLocaleDateString()
                            : currentIdentity.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Status</Label>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Active</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Public Key</CardTitle>
                    <CardDescription>Your identity's public verification key</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <code className="block p-3 bg-muted rounded text-xs font-mono break-all">
                      {currentIdentity.publicKeyHex}
                    </code>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Keys & Security Tab */}
              <TabsContent value="keys" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Private Key Management
                    </CardTitle>
                    <CardDescription>
                      Your private key is securely stored locally and never transmitted
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                      <p className="font-semibold mb-2">Security Warning</p>
                      <p>Never share your private key with anyone. Keep it secure and backed up safely.</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Private Key</Label>
                      <div className="relative">
                        <code className="block p-3 bg-muted rounded text-xs font-mono break-all">
                          {showPrivateKey
                            ? currentIdentity.privateKeyHex || "Not available"
                            : "••••••••••••••••"}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                          className="absolute right-2 top-2"
                        >
                          {showPrivateKey ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Export & Backup Tab */}
              <TabsContent value="export" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Export Identity</CardTitle>
                    <CardDescription>
                      Download your identity data for backup or migration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button onClick={handleExportIdentity} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Export as JSON
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Exported file contains your identity data. Store it safely and securely.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Identity Found</CardTitle>
                <CardDescription>Create your first digital identity to get started</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleCreateIdentity} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Create My First Identity
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

const Plus = ({ className }: { className: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
