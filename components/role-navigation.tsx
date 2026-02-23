"use client";

import { useRole } from "@/lib/context/role-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  User,
  FileCheck,
  CheckCircle2,
  Shield,
  Star,
  Building2,
  FileText,
  Plus,
  History,
  XCircle,
  Mail,
  Settings,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import RoleManagementService from "@/lib/services/role-management-service";

const iconMap: Record<string, any> = {
  LayoutDashboard,
  User,
  FileCheck,
  CheckCircle2,
  Shield,
  Star,
  Building2,
  FileText,
  Plus,
  History,
  XCircle,
  Mail,
  Settings,
  BarChart3,
};

export function RoleNavigation() {
  const { activeRole } = useRole();
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    main: true,
  });

  const items = RoleManagementService.getNavigationItems(activeRole);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {RoleManagementService.getRoleDisplayName(activeRole)}
          </h3>
          <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
        </div>

        <Collapsible
          open={openSections["main"]}
          onOpenChange={() => toggleSection("main")}
        >
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = iconMap[item.icon] || FileText;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start gap-3 text-sm",
                      isActive && "bg-blue-50 text-blue-700 dark:bg-blue-950"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </Collapsible>

        <div className="pt-4 mt-4 border-t">
          <p className="text-xs text-muted-foreground px-2 mb-3">
            {items[0]?.description}
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
