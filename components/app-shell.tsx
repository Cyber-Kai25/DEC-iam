"use client";

import React, { useState } from "react";
import { useRole } from "@/lib/context/role-context";
import { RoleSwitcher } from "./role-switcher";
import { RoleNavigation } from "./role-navigation";
import { Button } from "@/components/ui/button";
import { Menu, X, Bell, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { currentUser, activeRole, logout, isLoggingOut } = useRole();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      if (logout) {
        await logout();
      }
      // Redirect to login page
      router.push("/auth/login");
    } catch (error) {
      console.error("[v0] Logout error:", error);
      router.push("/auth/login");
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 border-r bg-muted/40 overflow-hidden`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                DID
              </div>
              <span className="hidden sm:inline">Identity Hub</span>
            </Link>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-hidden">
            <RoleNavigation />
          </div>

          {/* User Section */}
          {currentUser && (
            <div className="p-4 border-t bg-background">
              <div className="p-3 bg-muted rounded-lg mb-3">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Current Role
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs"
                >
                  {activeRole.charAt(0).toUpperCase() + activeRole.slice(1)}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs text-muted-foreground"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut className="h-3 w-3 mr-2" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background sticky top-0 z-40">
          <div className="flex items-center justify-between px-6 py-3">
            {/* Left Section */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>

              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Welcome back,</span>
                <span className="text-sm font-semibold">
                  {currentUser?.email || "User"}
                </span>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-3">
              {/* Role Switcher */}
              <RoleSwitcher />

              {/* Notifications */}
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                >
                  <div>
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {currentUser?.email?.[0]?.toUpperCase() || "U"}
                    </div>
                  </div>
                </Button>

                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="text-red-600"
                    disabled={isLoggingOut}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
