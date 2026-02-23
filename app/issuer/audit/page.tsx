"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditLog {
  id: string;
  action: string;
  actor: string;
  resource: string;
  timestamp: Date;
  result: "success" | "failure";
}

export default function IssuerAuditPage() {
  const logs: AuditLog[] = [
    {
      id: "log-001",
      action: "credential_issued",
      actor: "system",
      resource: "EducationCredential",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      result: "success",
    },
    {
      id: "log-002",
      action: "template_created",
      actor: "system",
      resource: "ProfessionalLicense",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      result: "success",
    },
  ];

  return (
    <ProtectedRoute requiredRole="issuer" requiredPermission="read:audit-logs">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
              <p className="text-muted-foreground mt-2">
                Complete audit trail of all issuer activities
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{logs.length}</div>
                <p className="text-xs text-muted-foreground">Recorded activities</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {logs.filter((l) => l.result === "success").length}
                </div>
                <p className="text-xs text-muted-foreground">Successful events</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {logs.filter((l) => l.result === "failure").length}
                </div>
                <p className="text-xs text-muted-foreground">Failed events</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All ({logs.length})</TabsTrigger>
              <TabsTrigger value="success">
                Success ({logs.filter((l) => l.result === "success").length})
              </TabsTrigger>
              <TabsTrigger value="failure">
                Failure ({logs.filter((l) => l.result === "failure").length})
              </TabsTrigger>
            </TabsList>

            {/* All Logs */}
            <TabsContent value="all" className="space-y-2">
              {logs.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No audit logs available
                  </CardContent>
                </Card>
              ) : (
                logs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium capitalize">
                            {log.action.replace("_", " ")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {log.resource} • {log.timestamp.toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={log.result === "success" ? "default" : "destructive"}>
                          {log.result}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Success Logs */}
            <TabsContent value="success" className="space-y-2">
              {logs
                .filter((l) => l.result === "success")
                .map((log) => (
                  <Card key={log.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium capitalize">
                            {log.action.replace("_", " ")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {log.resource} • {log.timestamp.toLocaleString()}
                          </p>
                        </div>
                        <Badge>Success</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>

            {/* Failure Logs */}
            <TabsContent value="failure" className="space-y-2">
              {logs
                .filter((l) => l.result === "failure")
                .map((log) => (
                  <Card key={log.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium capitalize">
                            {log.action.replace("_", " ")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {log.resource} • {log.timestamp.toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="destructive">Failure</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
