"use client";

import { useRole } from "@/lib/context/role-context";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Shield,
  Lock,
  Zap,
  Network,
  CheckCircle2,
  Users,
  Layers,
} from "lucide-react";
import { useEffect } from "react";
import Link from "next/link";

export default function LandingPage() {
  const { isAuthenticated, activeRole, currentUser } = useRole();
  const router = useRouter();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (isAuthenticated && activeRole) {
      console.log(`[v0] Redirecting authenticated user to ${activeRole}/dashboard`);
      router.push(`/${activeRole}/dashboard`);
    } else if (isAuthenticated && !activeRole && currentUser) {
      // Fallback: redirect to first available role if activeRole not set
      const firstRole = currentUser.roles[0];
      console.log(`[v0] No activeRole, redirecting to first available: ${firstRole}`);
      router.push(`/${firstRole}/dashboard`);
    }
  }, [isAuthenticated, activeRole, currentUser?.roles.length, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm">
              DID
            </div>
            <span>Identity Hub</span>
          </div>
          <Link href="/roles">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-balance">
                Decentralized Identity for Everyone
              </h1>
              <p className="text-xl text-muted-foreground text-balance">
                Create, manage, and verify digital identities on blockchain with complete privacy and control. Support for issuers and verifiers in one unified platform.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/roles" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2">
                  Get Started Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent">
                Learn More
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-8 border-t">
              <div>
                <div className="text-2xl font-bold text-blue-600">W3C</div>
                <p className="text-sm text-muted-foreground">Standards Compliant</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">3 Roles</div>
                <p className="text-sm text-muted-foreground">Owner, Issuer, Verifier</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">ZKP</div>
                <p className="text-sm text-muted-foreground">Privacy First</p>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="hidden md:flex items-center justify-center">
            <div className="relative w-full aspect-square max-w-md">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl blur-3xl"></div>
              <div className="relative bg-white rounded-3xl p-8 shadow-xl border">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                    <Shield className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold">DID Created</p>
                      <p className="text-xs text-muted-foreground">Ethereum Sepolia</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="text-sm font-semibold">Credentials Verified</p>
                      <p className="text-xs text-muted-foreground">3 active credentials</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
                    <Zap className="h-6 w-6 text-purple-600" />
                    <div>
                      <p className="text-sm font-semibold">Access Controlled</p>
                      <p className="text-xs text-muted-foreground">Fine-grained policies</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Roles Section */}
      <section className="bg-white py-24 border-t">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Three Powerful Roles</h2>
            <p className="text-lg text-muted-foreground text-balance">
              All in one unified platform for complete identity ecosystem management
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Identity Owner */}
            <Card className="border-2 hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">OWNER</span>
                </div>
                <CardTitle>Identity Owner</CardTitle>
                <CardDescription>
                  Control your digital identity and credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Create & manage DIDs</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Receive credentials</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Control access policies</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Present credentials</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Credential Issuer */}
            <Card className="border-2 hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Layers className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">ISSUER</span>
                </div>
                <CardTitle>Credential Issuer</CardTitle>
                <CardDescription>
                  Issue verifiable credentials to others
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Create templates</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Issue credentials</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Manage revocation</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Audit trail</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Credential Verifier */}
            <Card className="border-2 hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Shield className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">VERIFIER</span>
                </div>
                <CardTitle>Credential Verifier</CardTitle>
                <CardDescription>
                  Verify credentials from identity owners
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span>Create requests</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span>Verify credentials</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span>Define policies</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span>View analytics</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Enterprise-Grade Security</h2>
          <p className="text-lg text-muted-foreground text-balance">
            Built with modern cryptography and blockchain standards
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex gap-4">
              <Shield className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">W3C Standard DIDs</h3>
                <p className="text-sm text-muted-foreground">
                  Ethereum-backed did:ethr identifiers with full DID Document support
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Lock className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">End-to-End Encryption</h3>
                <p className="text-sm text-muted-foreground">
                  AES-256-GCM encryption for all data exchanges
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Zap className="h-6 w-6 text-purple-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Zero-Knowledge Proofs</h3>
                <p className="text-sm text-muted-foreground">
                  Privacy-preserving verification without revealing data
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <Network className="h-6 w-6 text-orange-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Blockchain Backed</h3>
                <p className="text-sm text-muted-foreground">
                  Ethereum Sepolia testnet for credential anchoring
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Users className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Self-Sovereign Identity</h3>
                <p className="text-sm text-muted-foreground">
                  Complete control over your digital identity
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Layers className="h-6 w-6 text-indigo-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Verifiable Credentials</h3>
                <p className="text-sm text-muted-foreground">
                  W3C compliant credentials with cryptographic proof
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-600 py-24 border-t">
        <div className="max-w-4xl mx-auto px-6 text-center text-white space-y-8">
          <h2 className="text-4xl font-bold">Ready to Build?</h2>
          <p className="text-lg opacity-90">
            Get started with the unified decentralized identity platform supporting owners, issuers, and verifiers
          </p>
          <Link href="/roles" className="inline-block">
            <Button size="lg" className="gap-2 bg-white text-blue-600 hover:bg-gray-100">
              Start Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>Built with Next.js, Web3, and blockchain technology</p>
        </div>
      </footer>
    </div>
  );
}
