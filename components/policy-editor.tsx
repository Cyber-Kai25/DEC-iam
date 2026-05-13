"use client";

import { AccessControlPolicy, AccessRule } from "@/lib/types/did";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PolicyEditorProps {
  policy: AccessControlPolicy;
  onSave?: (policy: AccessControlPolicy) => void;
  onAddRule?: (policy: AccessControlPolicy, rule: AccessRule) => void;
  onRemoveRule?: (policy: AccessControlPolicy, ruleId: string) => void;
  onCancel?: () => void;
}

export function PolicyEditor({
  policy,
  onSave,
  onAddRule,
  onRemoveRule,
  onCancel,
}: PolicyEditorProps) {
  const [newSubject, setNewSubject] = useState("");
  const [newAction, setNewAction] = useState<
    "read" | "write" | "execute" | "share" | "revoke" | "*"
  >("read");
  const [newEffect, setNewEffect] = useState<"allow" | "deny">("allow");

  const handleAddRule = () => {
    if (!newSubject.trim()) {
      toast.error("Subject DID is required");
      return;
    }

    const newRule: AccessRule = {
      id: `rule-${Date.now()}`,
      subject: newSubject,
      action: newAction,
      resource: policy.resourceId,
      effect: newEffect,
    };

    if (onAddRule) {
      onAddRule(policy, newRule);
      setNewSubject("");
      toast.success("Rule added successfully");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getEffectColor = (effect: "allow" | "deny") => {
    return effect === "allow"
      ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-100"
      : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-100";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Access Control Policy</CardTitle>
            <CardDescription className="text-xs font-mono">
              {policy.id}
            </CardDescription>
          </div>
          <Badge variant={policy.active ? "default" : "secondary"}>
            {policy.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Policy Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Resource Type
            </Label>
            <div className="p-2 bg-muted rounded">
              <code className="text-xs font-mono">{policy.resourceType}</code>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Total Rules
            </Label>
            <div className="p-2 bg-muted rounded">
              <code className="text-xs font-mono">{policy.rules.length}</code>
            </div>
          </div>
        </div>

        {/* Rules List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Access Rules</Label>
            <span className="text-xs text-muted-foreground">
              {policy.rules.length} rule{policy.rules.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {policy.rules.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No rules defined yet
              </div>
            ) : (
              policy.rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 bg-muted rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {rule.action}
                        </Badge>
                        <Badge className={`text-xs ${getEffectColor(rule.effect)}`}>
                          {rule.effect}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold">Subject:</span>{" "}
                        {Array.isArray(rule.subject)
                          ? rule.subject.join(", ")
                          : rule.subject}
                      </div>
                    </div>
                    {onRemoveRule && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemoveRule(policy, rule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {rule.expiresAt && (
                    <div className="text-xs text-muted-foreground">
                      Expires: {new Date(rule.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add New Rule */}
        <div className="border-t pt-6 space-y-4">
          <Label className="text-sm font-semibold">Add New Rule</Label>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-xs font-semibold">
                Subject DID
              </Label>
              <Input
                id="subject"
                placeholder="did:ethr:11155111:0x..."
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="action" className="text-xs font-semibold">
                  Action
                </Label>
                <Select value={newAction} onValueChange={(v: any) => setNewAction(v)}>
                  <SelectTrigger id="action" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="write">Write</SelectItem>
                    <SelectItem value="execute">Execute</SelectItem>
                    <SelectItem value="share">Share</SelectItem>
                    <SelectItem value="revoke">Revoke</SelectItem>
                    <SelectItem value="*">All (*)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="effect" className="text-xs font-semibold">
                  Effect
                </Label>
                <Select value={newEffect} onValueChange={(v: any) => setNewEffect(v)}>
                  <SelectTrigger id="effect" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow</SelectItem>
                    <SelectItem value="deny">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleAddRule}
              className="w-full bg-transparent"
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </div>

        {/* Actions */}
        {onSave && (
          <div className="flex gap-2 pt-4">
            <Button onClick={() => onSave(policy)} className="flex-1">
              Save Policy
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                copyToClipboard(JSON.stringify(policy, null, 2))
              }
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
