"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AuditLogEntry = {
  id: string;
  action: string;
  actorDid: string;
  resourceId: string | null;
  resourceType: string | null;
  status: string;
  details: any;
  timestamp: string;
};

function formatAction(action: string) {
  return action.replace(/_/g, " ");
}

export default function IssuerAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/audit-logs", {
        method: "GET",
        headers: { "x-active-role": "issuer" },
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setLogs(json.data || []);
      } else {
        toast.error(json?.error || "Failed to load audit logs");
      }
    } catch (e) {
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const successLogs = useMemo(() => logs.filter((l) => l.status === "success"), [logs]);
  const failureLogs = useMemo(() => logs.filter((l) => l.status === "failure"), [logs]);

  const renderLogCard = (log: AuditLogEntry) => {
    const credType = log.details?.credentialType || log.resourceType || "";
    const subjectDid = log.details?.subjectDid || "";
    return (
      <Card key={log.id}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium capitalize">{formatAction(log.action)}</p>
              <p className="text-sm text-muted-foreground">
                {credType && <span>{credType} &bull; </span>}
                {new Date(log.timestamp).toLocaleString()}
              </p>
              {subjectDid && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  Subject: {subjectDid}
                </p>
              )}
              {log.resourceId && (
                <p className="text-xs text-muted-foreground truncate">
                  Resource: {log.resourceId}
                </p>
              )}
            </div>
            <Badge variant={log.status === "success" ? "default" : "destructive"}>
              {log.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

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
            <Button variant="outline" onClick={fetchLogs} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
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
                <div className="text-2xl font-bold">{successLogs.length}</div>
                <p className="text-xs text-muted-foreground">Successful events</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{failureLogs.length}</div>
                <p className="text-xs text-muted-foreground">Failed events</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All ({logs.length})</TabsTrigger>
              <TabsTrigger value="success">Success ({successLogs.length})</TabsTrigger>
              <TabsTrigger value="failure">Failure ({failureLogs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-2">
              {isLoading ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : logs.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No audit logs yet. Issue or revoke credentials to see activity here.</CardContent></Card>
              ) : (
                logs.map(renderLogCard)
              )}
            </TabsContent>

            <TabsContent value="success" className="space-y-2">
              {successLogs.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No successful events</CardContent></Card>
              ) : (
                successLogs.map(renderLogCard)
              )}
            </TabsContent>

            <TabsContent value="failure" className="space-y-2">
              {failureLogs.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No failed events</CardContent></Card>
              ) : (
                failureLogs.map(renderLogCard)
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
