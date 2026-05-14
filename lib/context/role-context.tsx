"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, Organization } from "@/lib/types/did";
import RoleManagementService from "@/lib/services/role-management-service";
import { createClient } from "@/lib/supabase/client";

interface RoleContextType {
  // User management
  currentUser: User | null;
  isAuthenticated: boolean;
  setCurrentUser: (user: User) => void;

  // Role management
  activeRole: UserRole;
  switchRole: (role: UserRole) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasPermission: (action: string) => boolean;
  getUserRoles: () => UserRole[];

  // Organization management
  activeOrganization: Organization | null;
  setActiveOrganization: (org: Organization) => void;
  organizations: Organization[];
  addOrganization: (org: Organization) => void;

  // Navigation
  getRoleNavigation: () => Array<{
    label: string;
    href: string;
    icon: string;
    description: string;
  }>;

  // Logout functionality
  logout?: () => Promise<void>;
  isLoggingOut?: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>("owner");
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const setCurrentUserAndPersist = (user: User) => {
    setCurrentUser(user);

    const nextRole: UserRole =
      user.activeRole && user.roles.includes(user.activeRole)
        ? user.activeRole
        : (user.roles[0] || "owner");
    setActiveRole(nextRole);

    try {
      const state = {
        user: { ...user, activeRole: nextRole },
        activeRole: nextRole,
        activeOrganization,
        organizations,
      };
      localStorage.setItem("role-app-state", JSON.stringify(state));
      console.log(`[v0] Saved state via setCurrentUser with activeRole: ${nextRole}`);
    } catch (err) {
      console.error("[v0] Error saving role state during setCurrentUser:", err);
    }
  };

  // Load user state from localStorage on mount
  useEffect(() => {
    loadUserState();
  }, []);

  // Validate and sync activeRole with currentUser
  useEffect(() => {
    if (!currentUser) {
      return; // No user, skip sync
    }

    // If no activeRole set, use user's activeRole or first available role
    if (!activeRole) {
      const roleToSet = currentUser.activeRole || currentUser.roles[0];
      console.log(`[v0] No active role set, initializing to: ${roleToSet}`);
      setActiveRole(roleToSet);
    } 
    // If activeRole is set but not in user's roles, switch to valid role
    else if (!currentUser.roles.includes(activeRole)) {
      const fallbackRole = currentUser.activeRole || currentUser.roles[0];
      console.warn(`[v0] Active role '${activeRole}' not available, switching to: ${fallbackRole}`);
      setActiveRole(fallbackRole);
    }
    // If activeRole is valid and different from user's activeRole, sync it
    else if (currentUser.activeRole !== activeRole) {
      console.log(`[v0] Syncing context active role ${activeRole} with user`);
      // This is correct - context takes precedence after first load
    }
  }, [currentUser?.id, currentUser?.roles.length, activeRole]);

  const logout = async () => {
    try {
      setIsLoggingOut(true);
      const supabase = createClient();
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear local state
      clearUserState();
    } catch (error) {
      console.error("[v0] Error during logout:", error);
      // Still clear state even if Supabase logout fails
      clearUserState();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const switchRole = (role: UserRole): boolean => {
    if (!currentUser) {
      console.warn("[v0] Cannot switch role: no current user");
      return false;
    }
    
    // Validate that user has the requested role
    if (!currentUser.roles.includes(role)) {
      console.warn(`[v0] User does not have role: ${role}`);
      return false;
    }

    // If already active role, skip switch
    if (activeRole === role) {
      console.log(`[v0] Role '${role}' already active, skipping switch`);
      return true;
    }
    
    const updated = RoleManagementService.switchRole(currentUser, role);
    if (updated) {
      // Update user with new activeRole
      const userWithActiveRole = { ...updated, activeRole: role };
      setCurrentUser(userWithActiveRole);
      setActiveRole(role);

      // Persist immediately using the intended next role (avoid stale state reads)
      try {
        const state = {
          user: userWithActiveRole,
          activeRole: role,
          activeOrganization,
          organizations,
        };
        localStorage.setItem("role-app-state", JSON.stringify(state));
        console.log(`[v0] Saved state with activeRole: ${role}`);
      } catch (err) {
        console.error("[v0] Error saving role state during switchRole:", err);
      }

      console.log(`[v0] Successfully switched to role: ${role}`);
      return true;
    }
    console.warn(`[v0] Failed to switch role: ${role}`);
    return false;
  };

  const hasRole = (role: UserRole): boolean => {
    if (!currentUser) return false;
    return RoleManagementService.hasRole(currentUser, role);
  };

  const hasPermission = (action: string): boolean => {
    if (!currentUser) return false;
    return RoleManagementService.canPerformAction(currentUser, action);
  };

  const getUserRoles = (): UserRole[] => {
    if (!currentUser) return [];
    return currentUser.roles;
  };

  const getRoleNavigation = () => {
    return RoleManagementService.getNavigationItems(activeRole);
  };

  const addOrganization = (org: Organization) => {
    setOrganizations((prev) => [...prev, org]);
    saveUserState();
  };

  const saveUserState = () => {
    try {
      if (currentUser && activeRole) {
        // Ensure user object has current activeRole synced
        const userWithRole = { ...currentUser, activeRole };
        
        const state = {
          user: userWithRole,
          activeRole: activeRole,
          activeOrganization,
          organizations,
        };
        localStorage.setItem("role-app-state", JSON.stringify(state));
        console.log(`[v0] Saved state with activeRole: ${activeRole}`);
      }
    } catch (err) {
      console.error("[v0] Error saving role state:", err);
    }
  };

  const loadUserState = () => {
    try {
      const stored = localStorage.getItem("role-app-state");
      if (stored) {
        const state = JSON.parse(stored);
        if (state.user) {
          setCurrentUser(state.user);
          
          // Validate activeRole exists in user's roles, fallback to first role
          const validRole = state.activeRole && state.user.roles.includes(state.activeRole)
            ? state.activeRole
            : state.user.roles[0];
          
          console.log(`[v0] Loaded user with activeRole: ${validRole}`);
          setActiveRole(validRole);
          
          if (state.activeOrganization) {
            setActiveOrganization(state.activeOrganization);
          }
          if (state.organizations) {
            setOrganizations(state.organizations);
          }
        }
      }
    } catch (err) {
      console.error("[v0] Error loading role state:", err);
    }
  };

  const clearUserState = () => {
    try {
      localStorage.removeItem("role-app-state");
      setCurrentUser(null);
      setActiveRole("owner");
      setActiveOrganization(null);
      setOrganizations([]);
      console.log("[v0] User state cleared");
    } catch (err) {
      console.error("[v0] Error clearing role state:", err);
    }
  };

  const value: RoleContextType = {
    currentUser,
    isAuthenticated: !!currentUser,
    setCurrentUser: setCurrentUserAndPersist,
    activeRole,
    switchRole,
    hasRole,
    hasPermission,
    getUserRoles,
    activeOrganization,
    setActiveOrganization,
    organizations,
    addOrganization,
    getRoleNavigation,
    logout,
    isLoggingOut,
  };

  return (
    <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return context;
}
