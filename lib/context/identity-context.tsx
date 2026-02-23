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

  // Load from local storage on mount
  useEffect(() => {
    loadFromLocalStorage();
  }, []);

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

      const identity = DIDService.createIdentity(name);
      setCurrentIdentity(identity);

      const newIdentities = new Map(identities);
      newIdentities.set(identity.id, identity);
      setIdentities(newIdentities);

      return identity;
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
        setCurrentIdentity(identity);

        const newIdentities = new Map(identities);
        newIdentities.set(identity.id, identity);
        setIdentities(newIdentities);

        return identity;
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

      setCredentials([...credentials, credential]);
      return credential;
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

      setPolicies([...policies, policy]);
      return policy;
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

      setPolicies(
        policies.map((p) => (p.id === policy.id ? updated : p))
      );

      return updated;
    } catch (err) {
      handleError(err, "updatePolicy");
      return null;
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
      return registry ? (registry as Record<string, unknown>) : null;
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
    } catch (err) {
      handleError(err, "saveToLocalStorage");
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
