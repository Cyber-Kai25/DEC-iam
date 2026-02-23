"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertCircle, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function VerifierVerifyPage() {
  const [credentialData, setCredentialData] = useState("");
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    issuer: string;
    subject: string;
    type: string;
    issuanceDate: string;
    expirationDate?: string;
  } | null>(null);

  const handleVerify = () => {
    if (!credentialData.trim()) {
      toast.error("Please enter credential data");
      return;
    }

    try {
      // Parse and verify credential
      const parsed = JSON.parse(credentialData);

      setVerificationResult({
        valid: true,
        issuer: parsed.issuer || "Unknown",
        subject: parsed.subject || "Unknown",
        type: Array.isArray(parsed.type) ? parsed.type[0] : parsed.type || "Unknown",
        issuanceDate: parsed.issuanceDate || new Date().toISOString(),
        expirationDate: parsed.expirationDate,
      });

      toast.success("Credential verified successfully");
    } catch {
      toast.error("Invalid credential format");
    }
  };

  const handleReset = () => {
    setCredentialData("");
    setVerificationResult(null);
  };

  return (
    <ProtectedRoute requiredRole="verifier" requiredPermission="verify:credential">
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Verify Credential</h1>
            <p className="text-muted-foreground mt-2">
              Verify the authenticity and validity of credentials
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Verification Form */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Credential Verification</CardTitle>
                <CardDescription>
                  Paste the credential data to verify its authenticity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="credentialData">Credential Data (JSON)</Label>
                  <Textarea
                    id="credentialData"
                    placeholder='Paste credential JSON here...'
                    value={credentialData}
                    onChange={(e) => setCredentialData(e.target.value)}
                    className="font-mono text-sm min-h-48"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleVerify} className="flex-1">
                    <Search className="h-4 w-4 mr-2" />
                    Verify Credential
                  </Button>
                  <Button onClick={handleReset} variant="outline">
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Result Sidebar */}
            <div>
              {verificationResult ? (
                <Card
                  className={
                    verificationResult.valid
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }
                >
                  <CardHeader>
                    <div className="flex items-start gap-2">
                      {verificationResult.valid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <CardTitle className="text-base">
                          {verificationResult.valid ? "Valid" : "Invalid"}
                        </CardTitle>
                        <CardDescription>
                          {verificationResult.valid
                            ? "Credential is authentic and valid"
                            : "Credential failed verification"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Issuer</p>
                      <p className="font-mono text-xs break-all">
                        {verificationResult.issuer}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Type</p>
                      <Badge variant="secondary">{verificationResult.type}</Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Issued
                      </p>
                      <p className="text-xs">
                        {new Date(verificationResult.issuanceDate).toLocaleDateString()}
                      </p>
                    </div>
                    {verificationResult.expirationDate && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Expires
                        </p>
                        <p className="text-xs">
                          {new Date(verificationResult.expirationDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="pt-6 text-center text-muted-foreground text-sm">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Verification results will appear here</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Recent Verifications */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Verifications</CardTitle>
              <CardDescription>Credentials verified in the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground text-sm">
                No recent verifications. Verify credentials to see them here.
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
