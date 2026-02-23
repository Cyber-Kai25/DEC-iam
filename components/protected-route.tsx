"use client";

import React from "react"

import { useRole } from "@/lib/context/role-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "owner" | "issuer" | "verifier";
  requiredPermission?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
}: ProtectedRouteProps) {
  const { isAuthenticated, activeRole, hasPermission } = useRole();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/roles");
      return;
    }

    if (requiredRole && activeRole !== requiredRole) {
      router.push("/");
      return;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      router.push("/");
      return;
    }
  }, [isAuthenticated, activeRole, hasPermission, requiredRole, requiredPermission, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Redirecting to authentication...</p>
        </div>
      </div>
    );
  }

  if (requiredRole && activeRole !== requiredRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Access Denied: This page requires {requiredRole} role</p>
          <button
            onClick={() => router.push("/")}
            className="text-blue-600 hover:underline"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Access Denied: Insufficient permissions</p>
          <button
            onClick={() => router.push("/")}
            className="text-blue-600 hover:underline"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
