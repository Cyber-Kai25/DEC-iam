"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, XCircle, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface VerificationRequest {
  id: string;
  from: string;
  credentialType: string;
  status: "pending" | "approved" | "denied";
  createdAt: Date;
  expiresAt: Date;
}

export default function OwnerVerifyRequestsPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([
    {
      id: "vr-001",
      from: "Example Verifier Organization",
      credentialType: "Educational Credential",
      status: "pending",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  ]);

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const deniedRequests = requests.filter((r) => r.status === "denied");

  const handleApprove = (id: string) => {
    setRequests(
      requests.map((r) =>
        r.id === id ? { ...r, status: "approved" as const } : r
      )
    );
    toast.success("Verification request approved");
  };

  const handleDeny = (id: string) => {
    setRequests(
      requests.map((r) =>
        r.id === id ? { ...r, status: "denied" as const } : r
      )
    );
    toast.info("Verification request denied");
  };

  const VerificationCard = ({ request }: { request: VerificationRequest }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{request.from}</CardTitle>
            <CardDescription>Requesting {request.credentialType}</CardDescription>
          </div>
          <Badge
            variant={
              request.status === "pending"
                ? "secondary"
                : request.status === "approved"
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
            Requested: {request.createdAt.toLocaleDateString()} at{" "}
            {request.createdAt.toLocaleTimeString()}
          </p>
          <p>Expires: {request.expiresAt.toLocaleDateString()}</p>
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

        {request.status === "approved" && (
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
