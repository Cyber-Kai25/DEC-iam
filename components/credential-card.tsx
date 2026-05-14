"use client";

import { VerifiableCredential } from "@/lib/types/did";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

interface CredentialCardProps {
  credential: VerifiableCredential;
  onVerify?: (credential: VerifiableCredential) => void;
  onRevoke?: (credentialId: string) => void;
  onDownload?: (credential: VerifiableCredential) => void;
  onPresent?: (credential: VerifiableCredential) => void;
}

export function CredentialCard({
  credential,
  onVerify,
  onRevoke,
  onDownload,
  onPresent,
}: CredentialCardProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const isExpired = credential.expirationDate
    ? new Date(credential.expirationDate) < new Date()
    : false;

  const daysUntilExpiry = credential.expirationDate
    ? Math.floor(
        (new Date(credential.expirationDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const credentialType: string = Array.isArray(credential.type)
    ? credential.type.find((t) => t !== "VerifiableCredential") ||
      credential.type[0]
    : String(credential.type);

  return (
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{credentialType}</CardTitle>
            <CardDescription className="text-xs font-mono truncate">
              {credential.id}
            </CardDescription>
          </div>
          {isExpired ? (
            <Badge variant="destructive">Expired</Badge>
          ) : (
            <Badge variant="default">Valid</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Issuer */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Issuer
          </label>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="text-xs flex-1 font-mono text-foreground truncate">
              {credential.issuer}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(credential.issuer, "Issuer")}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Subject */}
        {!!credential.credentialSubject?.id && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Subject
            </label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="text-xs flex-1 font-mono text-foreground truncate">
                {String(credential.credentialSubject.id)}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  copyToClipboard(
                    String(credential.credentialSubject.id),
                    "Subject"
                  )
                }
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="text-xs text-muted-foreground">Issued</div>
            <div className="text-xs font-mono">
              {new Date(credential.issuanceDate).toLocaleDateString()}
            </div>
          </div>
          <div
            className={`p-3 rounded-lg space-y-1 ${
              isExpired
                ? "bg-destructive/10 border border-destructive/50"
                : "bg-muted"
            }`}
          >
            <div className="text-xs text-muted-foreground">Expires</div>
            {credential.expirationDate ? (
              <div className="space-y-1">
                <div className="text-xs font-mono">
                  {new Date(credential.expirationDate).toLocaleDateString()}
                </div>
                {daysUntilExpiry !== null && daysUntilExpiry >= 0 && (
                  <div className="text-xs text-muted-foreground">
                    {daysUntilExpiry} days left
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs font-mono">No expiration</div>
            )}
          </div>
        </div>

        {/* Credential Claims */}
        {credential.credentialSubject && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Claims
            </label>
            <div className="p-3 bg-muted rounded-lg space-y-2 max-h-32 overflow-y-auto">
              {Object.entries(credential.credentialSubject).map(([key, value]) => {
                if (key === "id") return null;
                return (
                  <div key={key} className="text-xs">
                    <div className="font-semibold text-foreground">{key}:</div>
                    <div className="text-muted-foreground font-mono break-all">
                      {String(value)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Proof Status */}
        {credential.proof && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Proof Type
            </label>
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <code className="text-xs font-mono text-green-900 dark:text-green-100">
                {credential.proof.type}
              </code>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          {onVerify && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onVerify(credential)}
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Verify
            </Button>
          )}
          {onDownload && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDownload(credential)}
              className="flex-1"
            >
              Download
            </Button>
          )}
          {onPresent && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPresent(credential)}
              className="flex-1"
            >
              Present
            </Button>
          )}
          {onRevoke && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRevoke(credential.id)}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Revoke
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
