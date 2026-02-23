"use client";

import { Identity } from "@/lib/types/did";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface IdentityCardProps {
  identity: Identity;
  onExport?: (identity: Identity) => void;
  onView?: (identity: Identity) => void;
}

export function IdentityCard({
  identity,
  onExport,
  onView,
}: IdentityCardProps) {
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg text-balance">{identity.name}</CardTitle>
            <CardDescription className="text-xs font-mono">
              {identity.did}
            </CardDescription>
          </div>
          <Badge variant="secondary">Active</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Wallet Address */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Wallet Address
          </label>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="text-sm flex-1 font-mono text-foreground">
              {formatAddress(identity.walletAddress)}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(identity.walletAddress, "Address")}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Public Key */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Public Key
          </label>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="text-xs flex-1 font-mono text-foreground truncate">
              {formatAddress(identity.publicKeyHex)}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(identity.publicKeyHex, "Public Key")}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Private Key (Hidden by default) */}
        {identity.privateKeyHex && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Private Key
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
              >
                {showPrivateKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
            {showPrivateKey && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/50 rounded-lg">
                <code className="text-xs flex-1 font-mono text-foreground break-all">
                  {identity.privateKeyHex}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    copyToClipboard(identity.privateKeyHex!, "Private Key")
                  }
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Keep this private key secure. Never share it with anyone.
            </p>
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Metadata
          </label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="text-xs font-mono">
                {typeof identity.createdAt === 'string'
                  ? new Date(identity.createdAt).toLocaleDateString()
                  : identity.createdAt.toLocaleDateString()}
              </div>
            </div>
            <div className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground">Algorithm</div>
              <div className="text-xs font-mono">
                {(identity.metadata?.algorithm as string) || "ECDSA"}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          {onView && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onView(identity)}
              className="flex-1"
            >
              View Details
            </Button>
          )}
          {onExport && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onExport(identity)}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
