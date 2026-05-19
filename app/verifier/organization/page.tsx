"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useRole } from "@/lib/context/role-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit2, Copy, Save, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function VerifierOrganizationPage() {
  const { activeOrganization, organizations, setActiveOrganization } = useRole();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const org = activeOrganization || organizations[0];

  useEffect(() => {
    setDraftName(org?.name || "");
    setDraftDescription(org?.description || "");
  }, [org?.id]);

  const handleToggleEdit = () => {
    if (!org) return;
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    void (async () => {
      try {
        setIsSaving(true);
        const res = await fetch("/api/organizations", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-active-role": "verifier" },
          body: JSON.stringify({ name: draftName, description: draftDescription }),
        });
        const json = await res.json();
        if (!res.ok || !json?.success) {
          toast.error(json?.error || "Failed to update organization");
          return;
        }

        setActiveOrganization(json.data);
        toast.success("Organization updated");
        setIsEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update organization");
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const handleCopyDID = () => {
    if (org?.didDocument?.id) {
      navigator.clipboard.writeText(org.didDocument.id);
      toast.success("Organization DID copied");
    }
  };

  return (
    <ProtectedRoute requiredRole="verifier" requiredPermission="read:organization-identity">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
              <p className="text-muted-foreground mt-2">
                Manage your credential verifier organization
              </p>
            </div>
            <Button
              onClick={handleToggleEdit}
              variant={isEditing ? "default" : "outline"}
              disabled={!org || isSaving}
            >
              {isEditing ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              ) : (
                <>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </>
              )}
            </Button>
          </div>

          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="identity">Digital Identity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              {org ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{org.name}</CardTitle>
                    <CardDescription>{org.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Organization Name</label>
                        <input
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          disabled={!isEditing}
                          className="w-full p-2 border rounded-lg bg-muted disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Capabilities</label>
                        <div className="p-2 border rounded-lg bg-muted flex gap-2 flex-wrap">
                          {org.issuerEnabled && (
                            <Badge variant="outline">Issuer</Badge>
                          )}
                          {org.verifierEnabled && (
                            <Badge variant="outline">Verifier</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <textarea
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        disabled={!isEditing}
                        className="w-full p-2 border rounded-lg bg-muted disabled:opacity-50 min-h-24 resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No organization information
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Identity Tab */}
            <TabsContent value="identity" className="space-y-4">
              {org?.didDocument ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Organization Identity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">DID</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                          {org.didDocument.id}
                        </code>
                        <Button variant="outline" size="icon" onClick={handleCopyDID}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    Digital identity not yet created
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Verification Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm">Require cryptographic signature verification</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm">Check credential revocation status</span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
