"use client";

import { useRole } from "@/lib/context/role-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RoleManagementService from "@/lib/services/role-management-service";
import { ChevronDown, User, Award, CheckCircle2 } from "lucide-react";

const roleIcons = {
  owner: User,
  issuer: Award,
  verifier: CheckCircle2,
};

export function RoleSwitcher() {
  const { activeRole, getUserRoles, switchRole } = useRole();

  const roles = getUserRoles();
  const roleDisplay = RoleManagementService.getRoleDisplayName(activeRole);
  const RoleIcon = roleIcons[activeRole];

  if (roles.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 bg-transparent"
        asChild
      >
        <div>
          <RoleIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">{roleDisplay}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
      </Button>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {roles.map((role) => {
          const isActive = role === activeRole;
          const display = RoleManagementService.getRoleDisplayName(role);
          const description = RoleManagementService.getRoleDescription(role);
          const Icon = roleIcons[role];

          return (
            <DropdownMenuItem
              key={role}
              onClick={() => switchRole(role)}
              className="flex flex-col items-start gap-1 py-2"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="font-medium">{display}</span>
                {isActive && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Active
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground ml-6">
                {description}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
