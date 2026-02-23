"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, Organization } from "@/lib/types/did";
import RoleManagementService from "@/lib/services/role-management-service";

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

  // Storage
  saveUserState: () => void;
  loadUserState: () => void;
  clearUserState: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>("owner");
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Load user state from localStorage on mount
  useEffect(() => {
    loadUserState();
  }, []);

  const switchRole = (role: UserRole): boolean => {
    if (!currentUser) return false;
    const updated = RoleManagementService.switchRole(currentUser, role);
    if (updated) {
      setCurrentUser(updated);
      setActiveRole(role);
      saveUserState();
      return true;
    }
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
      if (currentUser) {
        const state = {
          user: currentUser,
          activeRole,
          activeOrganization,
          organizations,
        };
        localStorage.setItem("role-app-state", JSON.stringify(state));
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
          setActiveRole(state.activeRole || "owner");
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
    } catch (err) {
      console.error("[v0] Error clearing role state:", err);
    }
  };

  const value: RoleContextType = {
    currentUser,
    isAuthenticated: !!currentUser,
    setCurrentUser,
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
    saveUserState,
    loadUserState,
    clearUserState,
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
