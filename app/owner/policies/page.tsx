"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PolicyEditor } from "@/components/policy-editor";
import { Plus, Shield, Edit2, Trash2, ToggleLeft as Toggle2On, ToggleLeft as Toggle2Off } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccessControlPolicy } from "@/lib/types/did";

export default function OwnerPoliciesPage() {
  const { policies, createPolicy, updatePolicy, deletePolicy } = useIdentity();
  const [showEditor, setShowEditor] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<typeof policies[0] | null>(null);

  const emptyPolicy: AccessControlPolicy = {
    id: `policy_${Date.now()}`,
    resourceId: "",
    resourceType: "credential",
    owner: "",
    rules: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    active: true,
  };

  const activePolicies = policies.filter((p) => p.active);
  const inactivePolicies = policies.filter((p) => !p.active);

  const handleCreatePolicy = () => {
    setEditingPolicy(null);
    setShowEditor(true);
  };

  const handleEditPolicy = (policy: typeof policies[0]) => {
    setEditingPolicy(policy);
    setShowEditor(true);
  };

  const handleTogglePolicy = (policyId: string) => {
    const policy = policies.find((p) => p.id === policyId);
    if (!policy) {
      toast.error("Policy not found");
      return;
    }

    updatePolicy({
      ...policy,
      active: !policy.active,
    }).then((saved) => {
      if (!saved) {
        toast.error("Failed to update policy");
        return;
      }
      toast.success("Policy status updated");
    });
  };

  const handleDeletePolicy = (policyId: string) => {
    deletePolicy(policyId).then((ok) => {
      if (!ok) {
        toast.error("Failed to delete policy");
        return;
      }
      toast.success("Policy deleted");
    });
  };

  const PolicyCard = ({ policy }: { policy: (typeof policies)[0] }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg capitalize">
              {policy.resourceType} Access
            </CardTitle>
            <CardDescription>
              {policy.resourceType === "credential"
                ? "Controls who can view your credentials"
                : policy.resourceType === "data"
                  ? "Controls who can access your data"
                  : "Controls access to services"}
            </CardDescription>
          </div>
          <Badge variant={policy.active ? "default" : "secondary"}>
            {policy.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>Resource ID: {policy.resourceId.slice(0, 16)}...</p>
          <p>Rules: {policy.rules.length}</p>
          <p>
            Created:{" "}
            {typeof policy.createdAt === "string"
              ? new Date(policy.createdAt).toLocaleDateString()
              : policy.createdAt.toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTogglePolicy(policy.id)}
            className="flex-1"
          >
            {policy.active ? (
              <>
                <Toggle2On className="h-4 w-4 mr-2" />
                Disable
              </>
            ) : (
              <>
                <Toggle2Off className="h-4 w-4 mr-2" />
                Enable
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditPolicy(policy)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeletePolicy(policy.id)}
            className="text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <ProtectedRoute requiredRole="owner" requiredPermission="create:own-policy">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Access Control Policies</h1>
              <p className="text-muted-foreground mt-2">
                Define and manage who can access your identities and credentials
              </p>
            </div>
            <Button onClick={handleCreatePolicy} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Policy
            </Button>
          </div>

          {showEditor && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingPolicy ? "Edit Policy" : "Create New Policy"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PolicyEditor
                  policy={editingPolicy || emptyPolicy}
                  onSave={(policy) => {
                    const op = editingPolicy
                      ? updatePolicy(policy)
                      : createPolicy(policy.resourceId, policy.resourceType);

                    op.then((saved) => {
                      if (!saved) {
                        toast.error("Failed to save policy");
                        return;
                      }
                      toast.success(
                        editingPolicy ? "Policy updated" : "Policy created"
                      );
                      setShowEditor(false);
                      setEditingPolicy(null);
                    });
                  }}
                  onCancel={() => {
                    setShowEditor(false);
                    setEditingPolicy(null);
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{policies.length}</div>
                <p className="text-xs text-muted-foreground">Access control policies</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <Badge variant="default">{activePolicies.length}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Currently enforced</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                <Badge variant="secondary">{inactivePolicies.length}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Disabled or archived</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active ({activePolicies.length})</TabsTrigger>
              <TabsTrigger value="inactive">Inactive ({inactivePolicies.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activePolicies.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No active policies. Create one to get started.
                  </CardContent>
                </Card>
              ) : (
                activePolicies.map((policy) => (
                  <PolicyCard key={policy.id} policy={policy} />
                ))
              )}
            </TabsContent>

            <TabsContent value="inactive" className="space-y-4">
              {inactivePolicies.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No inactive policies.
                  </CardContent>
                </Card>
              ) : (
                inactivePolicies.map((policy) => (
                  <PolicyCard key={policy.id} policy={policy} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
