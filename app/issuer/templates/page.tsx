"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "dec-iam-credential-templates";

interface CredentialTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  fields: string[];
  createdAt: string;
  usageCount: number;
}

const DEFAULT_TEMPLATES: CredentialTemplate[] = [
  {
    id: "tpl-001",
    name: "Educational Credential",
    description: "For issuing degrees and certificates",
    type: "EducationCredential",
    fields: ["name", "institutionName", "graduationDate", "degreeType"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "tpl-002",
    name: "Professional License",
    description: "For issuing professional licenses and certifications",
    type: "ProfessionalLicense",
    fields: ["licenseNumber", "profession", "expirationDate", "issuingBody"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "tpl-003",
    name: "Employment Credential",
    description: "For verifying employment status and history",
    type: "EmploymentCredential",
    fields: ["employeeName", "position", "department", "startDate"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "tpl-004",
    name: "Membership Credential",
    description: "For issuing organizational membership cards",
    type: "MembershipCredential",
    fields: ["memberName", "membershipId", "tier", "validUntil"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
];

function loadTemplates(): CredentialTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CredentialTemplate[];
  } catch { /* ignore */ }
  return DEFAULT_TEMPLATES;
}

function saveTemplates(templates: CredentialTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export default function IssuerTemplatesPage() {
  const [templates, setTemplates] = useState<CredentialTemplate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState("");
  const [formFields, setFormFields] = useState("");

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const persist = (next: CredentialTemplate[]) => {
    setTemplates(next);
    saveTemplates(next);
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormType("");
    setFormFields("");
    setDialogOpen(true);
  };

  const openEditDialog = (tpl: CredentialTemplate) => {
    setEditingId(tpl.id);
    setFormName(tpl.name);
    setFormDescription(tpl.description);
    setFormType(tpl.type);
    setFormFields(tpl.fields.join(", "));
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formType.trim()) {
      toast.error("Name and credential type are required");
      return;
    }

    const fields = formFields
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);

    if (editingId) {
      const next = templates.map((t) =>
        t.id === editingId
          ? { ...t, name: formName.trim(), description: formDescription.trim(), type: formType.trim(), fields }
          : t
      );
      persist(next);
      toast.success("Template updated");
    } else {
      const newTpl: CredentialTemplate = {
        id: `tpl-${Date.now()}`,
        name: formName.trim(),
        description: formDescription.trim(),
        type: formType.trim(),
        fields,
        createdAt: new Date().toISOString(),
        usageCount: 0,
      };
      persist([...templates, newTpl]);
      toast.success("Template created");
    }
    setDialogOpen(false);
  };

  const handleDuplicate = (tpl: CredentialTemplate) => {
    const dup: CredentialTemplate = {
      ...tpl,
      id: `tpl-${Date.now()}`,
      name: `${tpl.name} (Copy)`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
    persist([...templates, dup]);
    toast.success("Template duplicated");
  };

  const handleDelete = (id: string) => {
    persist(templates.filter((t) => t.id !== id));
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
            <Button onClick={openCreateDialog} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
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
                  {templates.length > 0 ? Math.max(...templates.map((t) => t.usageCount)) : 0}
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
                      <div>Created: {new Date(template.createdAt).toLocaleDateString()}</div>
                      <div>Used {template.usageCount} times</div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => openEditDialog(template)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(template)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
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

        {/* Create / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Template" : "Create Template"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update the template details below."
                  : "Define a new credential template. Templates can be selected when issuing credentials."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="tplName">Template Name</Label>
                <Input
                  id="tplName"
                  placeholder="e.g. Educational Credential"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tplDesc">Description</Label>
                <Input
                  id="tplDesc"
                  placeholder="What is this template for?"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tplType">Credential Type</Label>
                <Input
                  id="tplType"
                  placeholder="e.g. EducationCredential"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  PascalCase identifier used in the VC type array
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tplFields">Fields (comma-separated)</Label>
                <Textarea
                  id="tplFields"
                  placeholder="name, institution, graduationDate"
                  value={formFields}
                  onChange={(e) => setFormFields(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  These become the keys in the credential subject JSON
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingId ? "Save Changes" : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppShell>
    </ProtectedRoute>
  );
}
