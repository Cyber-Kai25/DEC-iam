"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useRole } from "@/lib/context/role-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit2, Copy, Save, Settings, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function IssuerOrganizationPage() {
  const { activeOrganization, organizations } = useRole();
  const [isEditing, setIsEditing] = useState(false);

  const org = activeOrganization || organizations[0];

  const handleCopyDID = () => {
    if (org?.didDocument?.id) {
      navigator.clipboard.writeText(org.didDocument.id);
      toast.success("Organization DID copied");
    }
  };

  return (
    <ProtectedRoute requiredRole="issuer" requiredPermission="read:organization-identity">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
              <p className="text-muted-foreground mt-2">
                Manage your credential issuer organization
              </p>
            </div>
            <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? "default" : "outline"}>
              {isEditing ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
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
                          value={org.name}
                          disabled={!isEditing}
                          className="w-full p-2 border rounded-lg bg-muted disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Type</label>
                        <div className="p-2 border rounded-lg bg-muted">
                          <Badge variant="outline" className="capitalize">
                            {org.type}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <textarea
                        value={org.description || ""}
                        disabled={!isEditing}
                        className="w-full p-2 border rounded-lg bg-muted disabled:opacity-50 min-h-24 resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Created</label>
                      <div className="p-2 border rounded-lg bg-muted text-sm">
                        {org.createdAt.toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No organization information available
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Digital Identity Tab */}
            <TabsContent value="identity" className="space-y-4">
              {org?.didDocument ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Organization Identity</CardTitle>
                    <CardDescription>Your credential issuer digital identity (DID)</CardDescription>
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

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Verification Methods</label>
                      <div className="p-3 bg-muted rounded text-sm">
                        <p>{org.didDocument.verificationMethod?.length || 0} verification method(s)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    Digital identity not yet created. Create one to start issuing credentials.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm">Require signature verification for all credentials</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm">Enable revocation capability</span>
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
