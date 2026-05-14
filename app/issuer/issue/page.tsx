"use client";

import React from "react"

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Send, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function IssuerIssuePage() {
  const { createCredential } = useIdentity();
  const [formData, setFormData] = useState({
    recipientDID: "",
    credentialType: "EducationCredential",
    subjectJson: "{}",
    expirationDate: "",
  });
  const [isSubjectJsonValid, setIsSubjectJsonValid] = useState(true);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, credentialType: value }));
  };

  const handleIssueCredential = async () => {
    if (!formData.recipientDID) {
      toast.error("Please enter recipient DID");
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

    try {
      await createCredential(
        formData.recipientDID,
        formData.credentialType,
        subject,
        formData.expirationDate
          ? Math.ceil((new Date(formData.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : undefined,
      );

      toast.success("Credential issued successfully");
      setFormData({
        recipientDID: "",
        credentialType: "EducationCredential",
        subjectJson: "{}",
        expirationDate: "",
      });
    } catch (error) {
      toast.error("Failed to issue credential");
    }
  };

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

                {/* Credential Type */}
                <div className="space-y-2">
                  <Label htmlFor="credentialType">Credential Type</Label>
                  <Select value={formData.credentialType} onValueChange={handleSelectChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EducationCredential">Educational Credential</SelectItem>
                      <SelectItem value="ProfessionalLicense">Professional License</SelectItem>
                      <SelectItem value="EmploymentCredential">Employment Credential</SelectItem>
                      <SelectItem value="MembershipCredential">Membership Credential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                  <p className="text-xs text-muted-foreground">
                    The claims and attributes in this credential
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
                  <Button onClick={handleIssueCredential} className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    Issue Credential
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFormData({
                        recipientDID: "",
                        credentialType: "EducationCredential",
                        subjectJson: "{}",
                        expirationDate: "",
                      })
                    }
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
                    <p>Select from templates or create custom types</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">3. Subject Data</p>
                    <p>Include all relevant claims and attributes</p>
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
                <CardContent className="text-sm text-muted-foreground">
                  <p>No recent credentials issued</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
