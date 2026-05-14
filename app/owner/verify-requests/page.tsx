"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, XCircle, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import VerificationService from "@/lib/services/verification-service";
import { VerifiablePresentation } from "@/lib/types/did";

interface VerificationRequest {
  id: string;
  verifierDid: string;
  requestedCredentials: string[];
  challenge?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  expiresAt?: string;
  responsePayload?: string;
}

export default function OwnerVerifyRequestsPage() {
  const { currentIdentity, credentials } = useIdentity();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/verifications", {
        cache: "no-store",
        headers: { "x-active-role": "owner" },
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load verification requests");
      }
      setRequests(json.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "accepted");
  const deniedRequests = requests.filter((r) => r.status === "rejected");

  const handleApprove = async (id: string) => {
    try {
      const req = requests.find((r) => r.id === id);
      if (!req) {
        toast.error("Request not found");
        return;
      }
      if (!currentIdentity?.privateKeyHex) {
        toast.error("No identity private key available");
        return;
      }

      const matching = credentials.filter((c) => {
        const types = Array.isArray(c.type) ? c.type : [String(c.type)];
        return req.requestedCredentials.some((t) => types.includes(t));
      });

      let presentation: VerifiablePresentation | null = null;
      if (matching.length > 0 && req.challenge) {
        const result = VerificationService.createPresentation(
          matching,
          currentIdentity.did,
          req.verifierDid,
          req.challenge,
          currentIdentity.privateKeyHex
        );
        presentation = result.presentation;
      }

      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-active-role": "owner" },
        body: JSON.stringify({
          action: "respond",
          requestId: id,
          response: "approved",
          presentation,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to approve request");
      }

      setRequests(requests.map((r) => (r.id === id ? { ...r, status: "accepted" } : r)));
      toast.success("Verification request approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve request");
    }
  };

  const handleDeny = async (id: string) => {
    try {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-active-role": "owner" },
        body: JSON.stringify({
          action: "respond",
          requestId: id,
          response: "denied",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to deny request");
      }

      setRequests(requests.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
      toast.info("Verification request denied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deny request");
    }
  };

  const VerificationCard = ({ request }: { request: VerificationRequest }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{request.verifierDid}</CardTitle>
            <CardDescription>
              Requesting {request.requestedCredentials?.[0] || "credentials"}
            </CardDescription>
          </div>
          <Badge
            variant={
              request.status === "pending"
                ? "secondary"
                : request.status === "accepted"
                  ? "default"
                  : "destructive"
            }
          >
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Requested: {new Date(request.createdAt).toLocaleDateString()} at{" "}
            {new Date(request.createdAt).toLocaleTimeString()}
          </p>
          {request.expiresAt && <p>Expires: {new Date(request.expiresAt).toLocaleDateString()}</p>}
        </div>

        {request.status === "pending" && (
          <div className="flex gap-2">
            <Button
              onClick={() => handleApprove(request.id)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              onClick={() => handleDeny(request.id)}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Deny
            </Button>
          </div>
        )}

        {request.status === "accepted" && (
          <Button variant="outline" className="w-full bg-transparent">
            <Eye className="h-4 w-4 mr-2" />
            View Presentation
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <ProtectedRoute requiredRole="owner" requiredPermission="receive:verification-request">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Verification Requests</h1>
            <p className="text-muted-foreground mt-2">
              Manage and respond to credential verification requests
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingRequests.length}</div>
                <p className="text-xs text-muted-foreground">Awaiting your response</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{approvedRequests.length}</div>
                <p className="text-xs text-muted-foreground">Verified credentials</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Denied</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deniedRequests.length}</div>
                <p className="text-xs text-muted-foreground">Rejected requests</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedRequests.length})</TabsTrigger>
              <TabsTrigger value="denied">Denied ({deniedRequests.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingRequests.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No pending verification requests
                  </CardContent>
                </Card>
              ) : (
                pendingRequests.map((req) => (
                  <VerificationCard key={req.id} request={req} />
                ))
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              {approvedRequests.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No approved requests
                  </CardContent>
                </Card>
              ) : (
                approvedRequests.map((req) => (
                  <VerificationCard key={req.id} request={req} />
                ))
              )}
            </TabsContent>

            <TabsContent value="denied" className="space-y-4">
              {deniedRequests.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No denied requests
                  </CardContent>
                </Card>
              ) : (
                deniedRequests.map((req) => (
                  <VerificationCard key={req.id} request={req} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
