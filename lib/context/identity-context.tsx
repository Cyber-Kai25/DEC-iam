"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Identity,
  VerifiableCredential,
  AccessControlPolicy,
  DataExchangeMessage,
} from "@/lib/types/did";
import DIDService from "@/lib/services/did-service";
import VerificationService from "@/lib/services/verification-service";
import AccessControlService from "@/lib/services/access-control-service";
import DataExchangeService from "@/lib/services/data-exchange-service";
import BlockchainService from "@/lib/services/blockchain-service";
import SupabaseRepository from "@/lib/services/supabase-repository";
import { createClient } from "@/lib/supabase/client";
import { ethers } from "ethers";

interface IdentityContextType {
  // Current Identity
  currentIdentity: Identity | null;
  isLoading: boolean;
  error: string | null;

  // Identity Management
  createIdentity: (name?: string) => Promise<Identity | null>;
  loadIdentity: (id: string) => Promise<Identity | null>;
  updateIdentity: (identity: Identity) => Promise<Identity | null>;
  deleteIdentity: (id: string) => Promise<boolean>;
  exportIdentity: (identity: Identity) => string;
  importIdentity: (json: string) => Promise<Identity | null>;

  // Credentials
  credentials: VerifiableCredential[];
  createCredential: (
    subjectDID: string,
    credentialType: string,
    credentialSubject: Record<string, unknown>,
    expirationDays?: number
  ) => Promise<VerifiableCredential | null>;
  verifyCredential: (credential: VerifiableCredential) => Promise<boolean>;
  revokeCredential: (credentialId: string) => Promise<boolean>;
  addCredential: (credential: VerifiableCredential) => void;

  // Access Control
  policies: AccessControlPolicy[];
  createPolicy: (
    resourceId: string,
    resourceType: "credential" | "data" | "service"
  ) => Promise<AccessControlPolicy | null>;
  updatePolicy: (policy: AccessControlPolicy) => Promise<AccessControlPolicy | null>;
  deletePolicy: (policyId: string) => Promise<boolean>;
  evaluateAccess: (
    policyId: string,
    requesterDID: string,
    action: string
  ) => Promise<boolean>;
  addPolicy: (policy: AccessControlPolicy) => void;

  // Data Exchange
  messages: DataExchangeMessage[];
  sendMessage: (
    to: string,
    data: string
  ) => Promise<DataExchangeMessage | null>;
  receiveMessage: (message: DataExchangeMessage) => Promise<string | null>;
  addMessage: (message: DataExchangeMessage) => void;

  // Blockchain
  registerDIDOnchain: (identity: Identity) => Promise<string | null>;
  revokeDIDOnchain: (identity: Identity) => Promise<string | null>;
  resolveDIDOnchain: (did: string) => Promise<Record<string, unknown> | null>;

  // Storage
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => Promise<void>;
  clearLocalStorage: () => void;
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentIdentity, setCurrentIdentity] = useState<Identity | null>(null);
  const [credentials, setCredentials] = useState<VerifiableCredential[]>([]);
  const [policies, setPolicies] = useState<AccessControlPolicy[]>([]);
  const [messages, setMessages] = useState<DataExchangeMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identities, setIdentities] = useState<Map<string, Identity>>(new Map());

  // Initialize blockchain on mount
  useEffect(() => {
    const initBlockchain = async () => {
      await BlockchainService.initializeProvider();
    };
    initBlockchain();
  }, []);

  // Detect user from Supabase auth session (source of truth)
  useEffect(() => {
    const supabase = createClient();

    const syncFromSession = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);
      } catch (err) {
        console.error("[v0] Error reading Supabase session:", err);
        setCurrentUserId(null);
      }
    };

    syncFromSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      syncFromSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Detect user from localStorage (set by RoleProvider)
  useEffect(() => {
    const checkUserState = async () => {
      try {
        const stored = localStorage.getItem("role-app-state");
        if (stored) {
          const state = JSON.parse(stored);
          if (state.user?.id && state.user.id !== currentUserId) {
            setCurrentUserId(state.user.id);
          }
        }
      } catch (err) {
        console.error("[v0] Error checking user state:", err);
      }
    };

    checkUserState();
    // Check every second if user has changed
    const interval = setInterval(checkUserState, 1000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  // Load from Supabase when user ID changes
  useEffect(() => {
    if (currentUserId) {
      loadFromSupabase(currentUserId);
    }
  }, [currentUserId]);

  const handleError = (err: unknown, context: string) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[v0] Error in ${context}:`, message);
    setError(`${context}: ${message}`);
  };

  // Identity Management Functions
  const createIdentity = async (name?: string): Promise<Identity | null> => {
    try {
      setIsLoading(true);
      setError(null);

      // Single identity per owner: if one exists, keep it
      try {
        const existingRes = await fetch('/api/identities', {
          method: 'GET',
          headers: { 'x-active-role': 'owner' },
        });
        const existingJson = await existingRes.json();
        const existing = existingJson?.success ? (existingJson.data as Identity[]) : [];
        if (existing.length > 0) {
          setCurrentIdentity(existing[0]);
          const newIdentities = new Map(existing.map((id) => [id.id, id]));
          setIdentities(newIdentities);
          return existing[0];
        }
      } catch {
        // ignore
      }

      const res = await fetch('/api/identities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-active-role': 'owner',
        },
        body: JSON.stringify({ name: name || 'Owner Identity' }),
      });
      const contentType = res.headers.get('content-type') || '';
      const json = contentType.includes('application/json') ? await res.json() : null;
      if (!res.ok || !json?.success || !json?.data) {
        setError(
          json?.error ||
            (res.status === 401
              ? 'Unauthorized: please log in again'
              : 'Failed to create identity')
        );
        return null;
      }

      const savedIdentity = json.data as Identity;
      setCurrentIdentity(savedIdentity);

      const newIdentities = new Map(identities);
      newIdentities.set(savedIdentity.id, savedIdentity);
      setIdentities(newIdentities);

      return savedIdentity;
    } catch (err) {
      handleError(err, "createIdentity");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const loadIdentity = async (id: string): Promise<Identity | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const identity = identities.get(id);
      if (identity) {
        setCurrentIdentity(identity);
        return identity;
      }

      return null;
    } catch (err) {
      handleError(err, "loadIdentity");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateIdentity = async (
    identity: Identity
  ): Promise<Identity | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const updated = {
        ...identity,
        updatedAt: new Date(),
      };

      if (currentUserId) {
        const saved = await SupabaseRepository.saveIdentity(updated, currentUserId);
        if (saved) {
          setCurrentIdentity(saved);
          const newIdentities = new Map(identities);
          newIdentities.set(saved.id, saved);
          setIdentities(newIdentities);
          return saved;
        }
      }

      setCurrentIdentity(updated);

      const newIdentities = new Map(identities);
      newIdentities.set(identity.id, updated);
      setIdentities(newIdentities);

      return updated;
    } catch (err) {
      handleError(err, "updateIdentity");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteIdentity = async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const target = identities.get(id);
      if (currentUserId && target?.did) {
        const ok = await SupabaseRepository.deleteIdentity(target.did);
        if (!ok) {
          return false;
        }
      }

      if (currentIdentity?.id === id) {
        setCurrentIdentity(null);
      }

      const newIdentities = new Map(identities);
      newIdentities.delete(id);
      setIdentities(newIdentities);

      return true;
    } catch (err) {
      handleError(err, "deleteIdentity");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const exportIdentity = (identity: Identity): string => {
    return DIDService.exportIdentity(identity);
  };

  const importIdentity = async (json: string): Promise<Identity | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const identity = DIDService.importIdentity(json);
      if (identity) {
        let savedIdentity = identity;
        if (currentUserId) {
          savedIdentity =
            (await SupabaseRepository.saveIdentity(identity, currentUserId)) || identity;
          console.log("[v0] Imported identity saved to Supabase:", {
            did: savedIdentity.did,
            userId: currentUserId,
          });
        }

        setCurrentIdentity(savedIdentity);

        const newIdentities = new Map(identities);
        newIdentities.set(savedIdentity.id, savedIdentity);
        setIdentities(newIdentities);

        return savedIdentity;
      }

      return null;
    } catch (err) {
      handleError(err, "importIdentity");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Credential Functions
  const createCredential = async (
    subjectDID: string,
    credentialType: string,
    credentialSubject: Record<string, unknown>,
    expirationDays?: number
  ): Promise<VerifiableCredential | null> => {
    try {
      if (!currentIdentity || !currentIdentity.privateKeyHex) {
        setError("No identity available");
        return null;
      }

      const credential = VerificationService.createVerifiableCredential(
        currentIdentity.did,
        subjectDID,
        credentialType,
        credentialSubject,
        currentIdentity.privateKeyHex,
        expirationDays || 365
      );

      // Save to Supabase if user is authenticated
      let savedCredential = credential;
      if (currentUserId) {
        savedCredential = await SupabaseRepository.saveCredential(credential, currentUserId) || credential;
        console.log("[v0] Credential saved to Supabase:", { credentialId: savedCredential.id, userId: currentUserId });
      }

      try {
        const credentialHash = ethers.keccak256(
          ethers.toUtf8Bytes(JSON.stringify(savedCredential))
        );
        const tx = await BlockchainService.anchorAuditHashWithWallet(
          credentialHash,
          "credential"
        );
        console.log("[v0] Credential audit anchor tx:", tx.hash);
      } catch (err) {
        console.warn("[v0] Audit anchoring failed (non-blocking):", err);
      }

      setCredentials([...credentials, savedCredential]);
      return savedCredential;
    } catch (err) {
      handleError(err, "createCredential");
      return null;
    }
  };

  const verifyCredential = async (
    credential: VerifiableCredential
  ): Promise<boolean> => {
    try {
      const result = VerificationService.verifyCredential(credential);
      return result.valid;
    } catch (err) {
      handleError(err, "verifyCredential");
      return false;
    }
  };

  const revokeCredential = async (credentialId: string): Promise<boolean> => {
    try {
      // Revoke in Supabase if user is authenticated
      if (currentUserId) {
        const success = await SupabaseRepository.revokeCredential(credentialId);
        if (!success) {
          console.warn("[v0] Failed to revoke credential in Supabase:", credentialId);
          return false;
        }
      }
      
      setCredentials(credentials.filter((c) => c.id !== credentialId));
      return true;
    } catch (err) {
      handleError(err, "revokeCredential");
      return false;
    }
  };

  const addCredential = (credential: VerifiableCredential) => {
    setCredentials([...credentials, credential]);
  };

  // Access Control Functions
  const createPolicy = async (
    resourceId: string,
    resourceType: "credential" | "data" | "service"
  ): Promise<AccessControlPolicy | null> => {
    try {
      if (!currentIdentity) {
        setError("No identity available");
        return null;
      }

      const policy = AccessControlService.createPolicy(
        resourceId,
        resourceType,
        currentIdentity.did
      );

      // Save to Supabase if user is authenticated
      let savedPolicy = policy;
      if (currentUserId) {
        savedPolicy = await SupabaseRepository.savePolicy(policy, currentUserId) || policy;
        console.log("[v0] Policy saved to Supabase:", { policyId: savedPolicy.id, userId: currentUserId });
      }

      setPolicies([...policies, savedPolicy]);
      return savedPolicy;
    } catch (err) {
      handleError(err, "createPolicy");
      return null;
    }
  };

  const updatePolicy = async (
    policy: AccessControlPolicy
  ): Promise<AccessControlPolicy | null> => {
    try {
      const updated = {
        ...policy,
        updatedAt: new Date(),
      };

      if (currentUserId) {
        const saved = await SupabaseRepository.savePolicy(updated, currentUserId);
        if (saved) {
          setPolicies(policies.map((p) => (p.id === policy.id ? saved : p)));
          return saved;
        }
      }

      setPolicies(
        policies.map((p) => (p.id === policy.id ? updated : p))
      );

      return updated;
    } catch (err) {
      handleError(err, "updatePolicy");
      return null;
    }
  };

  const deletePolicy = async (policyId: string): Promise<boolean> => {
    try {
      if (currentUserId) {
        const ok = await SupabaseRepository.deletePolicy(policyId);
        if (!ok) {
          return false;
        }
      }

      setPolicies(policies.filter((p) => p.id !== policyId));
      return true;
    } catch (err) {
      handleError(err, "deletePolicy");
      return false;
    }
  };

  const evaluateAccess = async (
    policyId: string,
    requesterDID: string,
    action: string
  ): Promise<boolean> => {
    try {
      const policy = policies.find((p) => p.id === policyId);
      if (!policy) {
        return false;
      }

      const result = AccessControlService.evaluateAccess(
        policy,
        requesterDID,
        action
      );

      return result.allowed;
    } catch (err) {
      handleError(err, "evaluateAccess");
      return false;
    }
  };

  const addPolicy = (policy: AccessControlPolicy) => {
    setPolicies([...policies, policy]);
  };

  // Data Exchange Functions
  const sendMessage = async (
    to: string,
    data: string
  ): Promise<DataExchangeMessage | null> => {
    try {
      if (!currentIdentity) {
        setError("No identity available");
        return null;
      }

      const message = await DataExchangeService.createExchangeMessage(
        currentIdentity.did,
        to,
        data,
        currentIdentity.publicKeyHex // Use own public key for demo
      );

      setMessages([...messages, message]);
      return message;
    } catch (err) {
      handleError(err, "sendMessage");
      return null;
    }
  };

  const receiveMessage = async (
    message: DataExchangeMessage
  ): Promise<string | null> => {
    try {
      if (!currentIdentity || !currentIdentity.privateKeyHex) {
        setError("No identity available");
        return null;
      }

      const decryptedData = await DataExchangeService.decryptExchangeMessage(
        message,
        currentIdentity.privateKeyHex
      );

      const isValid = await DataExchangeService.verifyMessageIntegrity(
        message,
        decryptedData
      );

      if (!isValid) {
        throw new Error("Message integrity check failed");
      }

      return decryptedData;
    } catch (err) {
      handleError(err, "receiveMessage");
      return null;
    }
  };

  const addMessage = (message: DataExchangeMessage) => {
    setMessages([...messages, message]);
  };

  // Blockchain Functions
  const registerDIDOnchain = async (identity: Identity): Promise<string | null> => {
    try {
      const tx = await BlockchainService.registerDID(
        identity.did,
        identity.publicKeyHex,
        identity.walletAddress,
        identity.privateKeyHex
      );

      console.log("[v0] DID registered on-chain:", tx.hash);
      return tx.hash;
    } catch (err) {
      handleError(err, "registerDIDOnchain");
      return null;
    }
  };

  const revokeDIDOnchain = async (identity: Identity): Promise<string | null> => {
    try {
      const tx = await BlockchainService.revokeDID(
        identity.did,
        identity.walletAddress
      );

      console.log("[v0] DID revoked on-chain:", tx.hash);
      return tx.hash;
    } catch (err) {
      handleError(err, "revokeDIDOnchain");
      return null;
    }
  };

  const resolveDIDOnchain = async (
    did: string
  ): Promise<Record<string, unknown> | null> => {
    try {
      const registry = await BlockchainService.resolveDIDOnchain(did);
      return registry ? (registry as unknown as Record<string, unknown>) : null;
    } catch (err) {
      handleError(err, "resolveDIDOnchain");
      return null;
    }
  };

  // Storage Functions
  const saveToLocalStorage = () => {
    try {
      const data = {
        currentIdentity,
        credentials,
        policies,
        messages,
        identities: Array.from(identities.entries()),
      };

      localStorage.setItem("identity-app-state", JSON.stringify(data));
      console.log("[v0] Identity data saved to localStorage");
    } catch (err) {
      handleError(err, "saveToLocalStorage");
    }
  };

  const loadFromSupabase = async (userId: string) => {
    try {
      setIsLoading(true);

      // Load identities via API (server-side access to DB)
      const identitiesRes = await fetch('/api/identities', {
        method: 'GET',
        headers: { 'x-active-role': 'owner' },
      });
      const identitiesContentType = identitiesRes.headers.get('content-type') || '';
      if (!identitiesRes.ok) {
        const text = await identitiesRes.text().catch(() => '');
        setError(
          `loadFromSupabase: Failed to fetch identities (${identitiesRes.status}). ` +
            (text ? text.slice(0, 200) : '')
        );
        return;
      }

      if (!identitiesContentType.includes('application/json')) {
        const text = await identitiesRes.text().catch(() => '');
        setError(
          `loadFromSupabase: Expected JSON from /api/identities but got '${identitiesContentType}'. ` +
            (text ? text.slice(0, 200) : '')
        );
        return;
      }

      const identitiesJson = await identitiesRes.json();
      const userIdentities = identitiesJson?.success ? (identitiesJson.data as Identity[]) : [];

      if (userIdentities.length === 0) {
        setIdentities(new Map());
        setCurrentIdentity(null);
        setCredentials([]);
        setPolicies([]);
        setMessages([]);
        return;
      }

      const identityMap = new Map(userIdentities.map((id) => [id.id, id]));
      setIdentities(identityMap);
      setCurrentIdentity(userIdentities[0]);
      console.log("[v0] Loaded identities from API:", { count: userIdentities.length });

      const allCredentials = await SupabaseRepository.getCredentials(userId, "owner");
      setCredentials(allCredentials);
      console.log("[v0] Loaded credentials from Supabase:", { count: allCredentials.length });

      const allPolicies = await SupabaseRepository.getPolicies(userIdentities[0].did);
      setPolicies(allPolicies);
      console.log("[v0] Loaded policies from Supabase:", { count: allPolicies.length });
    } catch (err) {
      handleError(err, "loadFromSupabase");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromLocalStorage = async () => {
    try {
      setIsLoading(true);

      const stored = localStorage.getItem("identity-app-state");
      if (stored) {
        const data = JSON.parse(stored);

        setCurrentIdentity(data.currentIdentity);
        setCredentials(data.credentials || []);
        setPolicies(data.policies || []);
        setMessages(data.messages || []);

        if (data.identities) {
          setIdentities(new Map(data.identities));
        }
        console.log("[v0] Loaded identity data from localStorage");
      }
    } catch (err) {
      handleError(err, "loadFromLocalStorage");
    } finally {
      setIsLoading(false);
    }
  };

  const clearLocalStorage = () => {
    try {
      localStorage.removeItem("identity-app-state");
      setCurrentIdentity(null);
      setCredentials([]);
      setPolicies([]);
      setMessages([]);
      setIdentities(new Map());
      console.log("[v0] Cleared identity data from localStorage");
    } catch (err) {
      handleError(err, "clearLocalStorage");
    }
  };

  const value: IdentityContextType = {
    currentIdentity,
    isLoading,
    error,
    createIdentity,
    loadIdentity,
    updateIdentity,
    deleteIdentity,
    exportIdentity,
    importIdentity,
    credentials,
    createCredential,
    verifyCredential,
    revokeCredential,
    addCredential,
    policies,
    createPolicy,
    updatePolicy,
    deletePolicy,
    evaluateAccess,
    addPolicy,
    messages,
    sendMessage,
    receiveMessage,
    addMessage,
    registerDIDOnchain,
    revokeDIDOnchain,
    resolveDIDOnchain,
    saveToLocalStorage,
    loadFromLocalStorage,
    clearLocalStorage,
  };

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (context === undefined) {
    throw new Error("useIdentity must be used within IdentityProvider");
  }
  return context;
}
