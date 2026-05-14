"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/context/role-context";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Award, CheckCircle2, ArrowRight } from "lucide-react";
import RoleManagementService from "@/lib/services/role-management-service";
import { User as UserType, UserRole } from "@/lib/types/did";
import { createClient } from "@/lib/supabase/client";

export default function RoleSelectionPage() {
  const { setCurrentUser, currentUser, activeRole, isAuthenticated } = useRole();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(["owner"]);

  const roles: { role: UserRole; icon: any; title: string; description: string }[] = [
    {
      role: "owner",
      icon: User,
      title: "Identity Owner",
      description: "Manage your digital identity and credentials",
    },
    {
      role: "issuer",
      icon: Award,
      title: "Credential Issuer",
      description: "Issue verifiable credentials to others",
    },
    {
      role: "verifier",
      icon: CheckCircle2,
      title: "Credential Verifier",
      description: "Verify credentials from identity owners",
    },
  ];

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    );
  };

  useEffect(() => {
    // If user is already authenticated and has an active role, send them to their dashboard.
    if (isAuthenticated && activeRole) {
      router.replace(`/${activeRole}/dashboard`);
      return;
    }

    // If not authenticated, send them to login.
    if (!isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [activeRole, isAuthenticated, router]);

  const handleGetStarted = async () => {
    if (selectedRoles.length === 0) {
      alert("Please select at least one role");
      return;
    }

    // Create a user with selected roles
    const firstRole = selectedRoles[0];
    let stableUserId = currentUser?.id;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        stableUserId = data.user.id;
      }
    } catch {
      // ignore
    }

    if (!stableUserId) {
      router.push("/auth/login");
      return;
    }

    const newUser: UserType = {
      id: stableUserId,
      email: email || undefined,
      roles: selectedRoles,
      activeRole: firstRole,
      createdAt: new Date(),
    };

    console.log(`[v0] Creating user with roles: ${selectedRoles.join(", ")}, activeRole: ${firstRole}`);
    setCurrentUser(newUser);
    
    // Ensure router redirects to the first selected role's dashboard
    router.push(`/${firstRole}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-lg font-bold">
              DID
            </div>
            <h1 className="text-3xl font-bold">Decentralized Identity Hub</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Choose your role and manage digital identities securely
          </p>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {roles.map(({ role, icon: Icon, title, description }) => {
            const isSelected = selectedRoles.includes(role);
            return (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className="focus:outline-none"
              >
                <Card
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200"
                      : "hover:border-slate-400"
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${
                        isSelected
                          ? "bg-blue-100"
                          : "bg-muted"
                      }`}>
                        <Icon className={`h-6 w-6 ${
                          isSelected ? "text-blue-600" : "text-muted-foreground"
                        }`} />
                      </div>
                      {isSelected && (
                        <Badge className="bg-blue-600">Selected</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </button>
            );
          })}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">For Identity Owners</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Create & manage your digital identity</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Receive & store credentials</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Control access policies</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">For Issuers & Verifiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Issue verifiable credentials</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Verify credential authenticity</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Maintain audit trails</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Enter your email and select your role(s) to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Email (optional)
              </label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Selected Roles: {selectedRoles.join(", ") || "None"}
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedRoles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {RoleManagementService.getRoleDisplayName(role)}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              onClick={handleGetStarted}
              disabled={selectedRoles.length === 0}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="text-xs text-muted-foreground text-center pt-2">
              You can switch between roles anytime after signing in
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
