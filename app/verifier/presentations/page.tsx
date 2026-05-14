"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import VerificationService from "@/lib/services/verification-service";

type PresentationItem = {
  id: string;
  fromDid: string;
  toDid: string;
  status: string;
  createdAt: string;
  expiresAt?: string;
  presentation: any;
};

function extractHolderAddress(presentation: any): string {
  const holder = presentation?.holder;
  if (typeof holder !== "string") return "";
  const parts = holder.split(":");
  const last = parts[parts.length - 1];
  return last || holder;
}

export default function VerifierPresentationsInboxPage() {
  const [items, setItems] = useState<PresentationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/presentations", { method: "GET" });
        const json = await res.json();
        if (!res.ok || !json?.success) {
          toast.error(json?.error || "Failed to load presentations");
          return;
        }
        setItems((json.data || []) as PresentationItem[]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load presentations");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return bt - at;
    });
  }, [items]);

  const handleDownload = (item: PresentationItem) => {
    try {
      const data = JSON.stringify(item.presentation, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `presentation-${item.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Presentation downloaded");
    } catch {
      toast.error("Failed to download presentation");
    }
  };

  const handleVerify = (item: PresentationItem) => {
    try {
      if (!item.presentation) {
        toast.error("No presentation payload");
        return;
      }
      const holderAddress = extractHolderAddress(item.presentation);
      const result = VerificationService.verifyPresentation(item.presentation, holderAddress);
      if (!result.valid) {
        toast.error(result.error || "Presentation verification failed");
        return;
      }
      toast.success("Presentation verified");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Presentation verification failed");
    }
  };

  return (
    <ProtectedRoute requiredRole="verifier" requiredPermission="verify:credential">
      <AppShell>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Presentation Inbox</h1>
            <p className="text-muted-foreground mt-2">
              Presentations received from owners for verification
            </p>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Loading presentations...
              </CardContent>
            </Card>
          ) : sorted.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No presentations yet</CardTitle>
                <CardDescription>
                  When an owner delivers a presentation to your DID, it will appear here.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sorted.map((item) => (
                <Card key={item.id}>
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{item.fromDid}</CardTitle>
                        <CardDescription className="break-all">
                          {new Date(item.createdAt).toLocaleString()}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          item.status === "pending"
                            ? "secondary"
                            : item.status === "accepted"
                              ? "default"
                              : "destructive"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground break-all">
                      <div>Message ID: {item.id}</div>
                      <div>To: {item.toDid}</div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleVerify(item)}>
                        Verify
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(item)}>
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
