"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface VerificationPolicy {
  id: string;
  name: string;
  credentialTypes: string[];
  requireSignature: boolean;
  checkRevocation: boolean;
  createdAt: Date;
}

export default function VerifierPoliciesPage() {
  const [policies, setPolicies] = useState<VerificationPolicy[]>([
    {
      id: "pol-001",
      name: "Educational Verification",
      credentialTypes: ["EducationCredential"],
      requireSignature: true,
      checkRevocation: true,
      createdAt: new Date(),
    },
    {
      id: "pol-002",
      name: "Professional License Check",
      credentialTypes: ["ProfessionalLicense"],
      requireSignature: true,
      checkRevocation: true,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ]);

  const handleDeletePolicy = (id: string) => {
    setPolicies(policies.filter((p) => p.id !== id));
    toast.info("Policy deleted");
  };

  return (
    <ProtectedRoute requiredRole="verifier" requiredPermission="read:verification-policies">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Verification Policies</h1>
              <p className="text-muted-foreground mt-2">
                Define verification requirements for credentials
              </p>
            </div>
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              New Policy
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{policies.length}</div>
                <p className="text-xs text-muted-foreground">Defined policies</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Credential Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(policies.flatMap((p) => p.credentialTypes)).size}
                </div>
                <p className="text-xs text-muted-foreground">Covered types</p>
              </CardContent>
            </Card>
          </div>

          {/* Policies List */}
          <div className="space-y-4">
            {policies.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No policies defined. Create one to get started.
                </CardContent>
              </Card>
            ) : (
              policies.map((policy) => (
                <Card key={policy.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{policy.name}</CardTitle>
                        <CardDescription>
                          {policy.credentialTypes.length} credential type(s)
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Credential Types</label>
                      <div className="flex flex-wrap gap-2">
                        {policy.credentialTypes.map((type) => (
                          <Badge key={type} variant="secondary">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={policy.requireSignature} disabled readOnly className="rounded" />
                        <span>Require Signature</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={policy.checkRevocation} disabled readOnly className="rounded" />
                        <span>Check Revocation</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
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
              ))
            )}
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
