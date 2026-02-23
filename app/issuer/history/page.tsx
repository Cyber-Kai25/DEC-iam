"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { useIdentity } from "@/lib/context/identity-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IssuerHistoryPage() {
  const { credentials } = useIdentity();

  const issuedCredentials = credentials.filter((c) => c.issuer);
  const activeCredentials = issuedCredentials.filter(
    (c) => !c.expirationDate || new Date(c.expirationDate) > new Date()
  );
  const expiredCredentials = issuedCredentials.filter(
    (c) => c.expirationDate && new Date(c.expirationDate) <= new Date()
  );

  return (
    <ProtectedRoute requiredRole="issuer" requiredPermission="read:issuance-history">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Credential History</h1>
              <p className="text-muted-foreground mt-2">
                View all credentials you have issued
              </p>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export History
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Issued</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{issuedCredentials.length}</div>
                <p className="text-xs text-muted-foreground">All issued credentials</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCredentials.length}</div>
                <p className="text-xs text-muted-foreground">Currently valid</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expired</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expiredCredentials.length}</div>
                <p className="text-xs text-muted-foreground">No longer valid</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All ({issuedCredentials.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({activeCredentials.length})</TabsTrigger>
              <TabsTrigger value="expired">Expired ({expiredCredentials.length})</TabsTrigger>
            </TabsList>

            {/* All Credentials */}
            <TabsContent value="all" className="space-y-4">
              {issuedCredentials.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No credentials issued yet
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {issuedCredentials.map((cred) => (
                    <Card key={cred.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{cred.type[0]}</p>
                            <p className="text-sm text-muted-foreground">
                              Issued: {new Date(cred.issuanceDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {!cred.expirationDate || new Date(cred.expirationDate) > new Date()
                                ? "Active"
                                : "Expired"}
                            </Badge>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Active Credentials */}
            <TabsContent value="active" className="space-y-4">
              {activeCredentials.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No active credentials
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {activeCredentials.map((cred) => (
                    <Card key={cred.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{cred.type[0]}</p>
                            <p className="text-sm text-muted-foreground">
                              Issued: {new Date(cred.issuanceDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Expired Credentials */}
            <TabsContent value="expired" className="space-y-4">
              {expiredCredentials.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No expired credentials
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {expiredCredentials.map((cred) => (
                    <Card key={cred.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{cred.type[0]}</p>
                            <p className="text-sm text-muted-foreground">
                              Expired: {new Date(cred.expirationDate!).toLocaleDateString()}
                            </p>
                          </div>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
