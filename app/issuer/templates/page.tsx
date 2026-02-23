"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CredentialTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  fields: string[];
  createdAt: Date;
  usageCount: number;
}

export default function IssuerTemplatesPage() {
  const [templates, setTemplates] = useState<CredentialTemplate[]>([
    {
      id: "tpl-001",
      name: "Educational Credential",
      description: "For issuing degrees and certificates",
      type: "EducationCredential",
      fields: ["name", "institutionName", "graduationDate", "degreeType"],
      createdAt: new Date(),
      usageCount: 5,
    },
    {
      id: "tpl-002",
      name: "Professional License",
      description: "For issuing professional licenses and certifications",
      type: "ProfessionalLicense",
      fields: ["licenseNumber", "profession", "expirationDate", "issuer"],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      usageCount: 3,
    },
  ]);

  const handleCreateTemplate = () => {
    toast.info("Create template dialog would open");
  };

  const handleDuplicateTemplate = (id: string) => {
    toast.success("Template duplicated");
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templates.filter((t) => t.id !== id));
    toast.info("Template deleted");
  };

  return (
    <ProtectedRoute requiredRole="issuer" requiredPermission="create:credential-template">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Credential Templates</h1>
              <p className="text-muted-foreground mt-2">
                Create and manage credential templates for consistent issuance
              </p>
            </div>
            <Button onClick={handleCreateTemplate} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{templates.length}</div>
                <p className="text-xs text-muted-foreground">Defined templates</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {templates.reduce((sum, t) => sum + t.usageCount, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Credentials issued</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Most Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.max(...templates.map((t) => t.usageCount), 0)}
                </div>
                <p className="text-xs text-muted-foreground">Times issued</p>
              </CardContent>
            </Card>
          </div>

          {/* Templates Grid */}
          <div className="grid gap-4">
            {templates.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No templates created yet. Create your first template to get started.
                </CardContent>
              </Card>
            ) : (
              templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </div>
                      <Badge variant="secondary">{template.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Fields</label>
                      <div className="flex flex-wrap gap-2">
                        {template.fields.map((field) => (
                          <Badge key={field} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>Created: {template.createdAt.toLocaleDateString()}</div>
                      <div>Used {template.usageCount} times</div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateTemplate(template.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
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
