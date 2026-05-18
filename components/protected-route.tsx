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
      router.replace("/roles");
      return;
    }

    if (requiredRole && activeRole !== requiredRole) {
      router.replace(`/${activeRole}/dashboard`);
      return;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      router.replace(`/${activeRole}/dashboard`);
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

  if (
    (requiredRole && activeRole !== requiredRole) ||
    (requiredPermission && !hasPermission(requiredPermission))
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
