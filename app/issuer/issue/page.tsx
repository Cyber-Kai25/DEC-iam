"use client";

import React from "react";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Send, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const TEMPLATES_KEY = "dec-iam-credential-templates";

interface CredentialTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  fields: string[];
  usageCount: number;
}

function loadTemplates(): CredentialTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (raw) return JSON.parse(raw) as CredentialTemplate[];
  } catch { /* ignore */ }
  return [];
}

function incrementTemplateUsage(templateType: string) {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return;
    const templates = JSON.parse(raw) as CredentialTemplate[];
    const updated = templates.map((t) =>
      t.type === templateType ? { ...t, usageCount: (t.usageCount || 0) + 1 } : t
    );
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

function buildScaffoldJson(fields: string[]): string {
  if (!fields.length) return "{}";
  const obj: Record<string, string> = {};
  for (const f of fields) obj[f] = "";
  return JSON.stringify(obj, null, 2);
}

export default function IssuerIssuePage() {
  const [templates, setTemplates] = useState<CredentialTemplate[]>([]);
  const [formData, setFormData] = useState({
    recipientDID: "",
    credentialType: "",
    subjectJson: "{}",
    expirationDate: "",
  });
  const [isSubjectJsonValid, setIsSubjectJsonValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentIssuances, setRecentIssuances] = useState<
    { type: string; subjectDid: string; time: string }[]
  >([]);

  useEffect(() => {
    const loaded = loadTemplates();
    setTemplates(loaded);
    if (loaded.length > 0 && !formData.credentialType) {
      setFormData((prev) => ({
        ...prev,
        credentialType: loaded[0].type,
        subjectJson: buildScaffoldJson(loaded[0].fields),
      }));
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTemplateChange = (value: string) => {
    const tpl = templates.find((t) => t.type === value);
    setFormData((prev) => ({
      ...prev,
      credentialType: value,
      subjectJson: tpl ? buildScaffoldJson(tpl.fields) : prev.subjectJson,
    }));
    setIsSubjectJsonValid(true);
  };

  const handleIssueCredential = async () => {
    if (!formData.recipientDID) {
      toast.error("Please enter recipient DID");
      return;
    }
    if (!formData.credentialType) {
      toast.error("Please select a credential type");
      return;
    }

    let subject: Record<string, unknown>;
    try {
      subject = formData.subjectJson?.trim()
        ? (JSON.parse(formData.subjectJson) as Record<string, unknown>)
        : {};
    } catch {
      toast.error("Subject Data must be valid JSON");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-active-role": "issuer",
        },
        body: JSON.stringify({
          subjectDid: formData.recipientDID,
          credentialType: formData.credentialType,
          claims: subject,
          expirationDays: formData.expirationDate
            ? Math.ceil(
                (new Date(formData.expirationDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to issue credential");
      }

      // Track usage
      incrementTemplateUsage(formData.credentialType);
      setRecentIssuances((prev) => [
        {
          type: formData.credentialType,
          subjectDid: formData.recipientDID,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 4),
      ]);

      toast.success("Credential issued successfully");
      const defaultTpl = templates.find((t) => t.type === formData.credentialType);
      setFormData({
        recipientDID: "",
        credentialType: formData.credentialType,
        subjectJson: defaultTpl ? buildScaffoldJson(defaultTpl.fields) : "{}",
        expirationDate: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to issue credential");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.type === formData.credentialType);

  return (
    <ProtectedRoute requiredRole="issuer" requiredPermission="issue:credential">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Issue Credential</h1>
            <p className="text-muted-foreground mt-2">
              Create and issue verifiable credentials to identity owners
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Form */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>New Credential</CardTitle>
                <CardDescription>Fill in the details to issue a credential</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Recipient */}
                <div className="space-y-2">
                  <Label htmlFor="recipientDID">Recipient DID</Label>
                  <Input
                    id="recipientDID"
                    name="recipientDID"
                    placeholder="did:ethr:11155111:0x..."
                    value={formData.recipientDID}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    The decentralized identifier of the credential recipient
                  </p>
                </div>

                {/* Credential Type from templates */}
                <div className="space-y-2">
                  <Label htmlFor="credentialType">Credential Type (from Templates)</Label>
                  {templates.length > 0 ? (
                    <Select value={formData.credentialType} onValueChange={handleTemplateChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((tpl) => (
                          <SelectItem key={tpl.id} value={tpl.type}>
                            {tpl.name} ({tpl.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      name="credentialType"
                      placeholder="e.g. EducationCredential"
                      value={formData.credentialType}
                      onChange={handleInputChange}
                    />
                  )}
                  {selectedTemplate && (
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  )}
                  {templates.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No templates found. Create templates in the{" "}
                      <a href="/issuer/templates" className="underline">
                        Templates
                      </a>{" "}
                      page, or type a custom type above.
                    </p>
                  )}
                </div>

                {/* Template fields hint */}
                {selectedTemplate && selectedTemplate.fields.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Expected fields</Label>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.fields.map((f) => (
                        <Badge key={f} variant="outline" className="text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject Data */}
                <div className="space-y-2">
                  <Label htmlFor="subjectData">Subject Data (JSON)</Label>
                  <Textarea
                    id="subjectData"
                    placeholder='{"name": "John Doe", "institution": "University"}'
                    className="font-mono text-xs"
                    rows={6}
                    value={formData.subjectJson}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!next.trim()) {
                        setIsSubjectJsonValid(true);
                      } else {
                        try {
                          JSON.parse(next);
                          setIsSubjectJsonValid(true);
                        } catch {
                          setIsSubjectJsonValid(false);
                        }
                      }
                      setFormData((prev) => ({
                        ...prev,
                        subjectJson: next,
                      }));
                    }}
                  />
                  <p
                    className={`text-xs ${
                      isSubjectJsonValid
                        ? "text-muted-foreground"
                        : "text-destructive"
                    }`}
                  >
                    {isSubjectJsonValid ? "Valid JSON" : "Invalid JSON"}
                  </p>
                </div>

                {/* Expiration Date */}
                <div className="space-y-2">
                  <Label htmlFor="expirationDate">Expiration Date (Optional)</Label>
                  <Input
                    id="expirationDate"
                    name="expirationDate"
                    type="date"
                    value={formData.expirationDate}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank for non-expiring credentials
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleIssueCredential}
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Issuing..." : "Issue Credential"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const tpl = templates.find((t) => t.type === formData.credentialType);
                      setFormData({
                        recipientDID: "",
                        credentialType: formData.credentialType,
                        subjectJson: tpl ? buildScaffoldJson(tpl.fields) : "{}",
                        expirationDate: "",
                      });
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Tips</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3 text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">1. Recipient DID</p>
                    <p>Must be a valid W3C Decentralized Identifier</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">2. Credential Type</p>
                    <p>Select from your templates or type a custom type</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">3. Subject Data</p>
                    <p>Fill in all template fields with actual values</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">4. Expiration</p>
                    <p>Set when the credential should expire</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Issuances</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  {recentIssuances.length === 0 ? (
                    <p>No credentials issued this session</p>
                  ) : (
                    recentIssuances.map((r, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="truncate mr-2">{r.type}</span>
                        <span className="shrink-0">{r.time}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
