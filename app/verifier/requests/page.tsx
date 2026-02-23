"use client";

import React from "react"

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Send, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface VerificationRequest {
  id: string;
  recipientDID: string;
  credentialType: string;
  status: "pending" | "received" | "verified";
  sentAt: Date;
  expiresAt: Date;
}

export default function VerifierRequestsPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([
    {
      id: "vr-001",
      recipientDID: "did:ethr:11155111:0x123...",
      credentialType: "EducationCredential",
      status: "received",
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  ]);

  const [formData, setFormData] = useState({
    recipientDID: "",
    credentialType: "EducationCredential",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendRequest = () => {
    if (!formData.recipientDID) {
      toast.error("Please enter recipient DID");
      return;
    }

    const newRequest: VerificationRequest = {
      id: `vr-${Date.now()}`,
      recipientDID: formData.recipientDID,
      credentialType: formData.credentialType,
      status: "pending",
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };

    setRequests([newRequest, ...requests]);
    toast.success("Verification request sent");
    setFormData({ recipientDID: "", credentialType: "EducationCredential" });
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const receivedRequests = requests.filter((r) => r.status === "received");
  const verifiedRequests = requests.filter((r) => r.status === "verified");

  const RequestCard = ({ request }: { request: VerificationRequest }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-mono text-sm">
              {request.recipientDID}
            </CardTitle>
            <CardDescription>{request.credentialType}</CardDescription>
          </div>
          <Badge
            variant={
              request.status === "pending"
                ? "secondary"
                : request.status === "received"
                  ? "default"
                  : "outline"
            }
          >
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>Sent: {request.sentAt.toLocaleDateString()}</p>
          <p>Expires: {request.expiresAt.toLocaleDateString()}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <ProtectedRoute requiredRole="verifier" requiredPermission="create:verification-request">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Verification Requests</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage credential verification requests
            </p>
          </div>

          {/* Create Request Form */}
          <Card>
            <CardHeader>
              <CardTitle>New Verification Request</CardTitle>
              <CardDescription>Request a credential from an identity owner</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientDID">Recipient DID</Label>
                  <Input
                    id="recipientDID"
                    name="recipientDID"
                    placeholder="did:ethr:11155111:0x..."
                    value={formData.recipientDID}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credentialType">Credential Type</Label>
                  <select
                    name="credentialType"
                    value={formData.credentialType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        credentialType: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                  >
                    <option value="EducationCredential">Educational Credential</option>
                    <option value="ProfessionalLicense">Professional License</option>
                    <option value="EmploymentCredential">Employment Credential</option>
                  </select>
                </div>
              </div>
              <Button onClick={handleSendRequest} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                Send Verification Request
              </Button>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingRequests.length}</div>
                <p className="text-xs text-muted-foreground">Awaiting response</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Received</CardTitle>
                <Badge variant="default">{receivedRequests.length}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Credentials received</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Verified</CardTitle>
                <Badge variant="secondary">{verifiedRequests.length}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Verified credentials</p>
              </CardContent>
            </Card>
          </div>

          {/* Request List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">All Requests</h2>
            {requests.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No verification requests yet. Create your first request to get started.
                </CardContent>
              </Card>
            ) : (
              requests.map((req) => <RequestCard key={req.id} request={req} />)
            )}
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
