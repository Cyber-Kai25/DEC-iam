import { createClient } from "@/lib/supabase/client";
import { Identity, VerifiableCredential, AccessControlPolicy, ConsentRecord, RevocationRecord, RevocationRegistry, DataRetention, DataLifecycleEvent, DataExchangeMessage, CredentialRequest } from "@/lib/types/did";

/**
 * Supabase Repository Service
 * Handles all database operations with transaction support
 */
export class SupabaseRepository {
  private static async getClient() {
    return createClient();
  }

  // ============================================================================
  // DATA EXCHANGE MESSAGES (Verification Requests)
  // ============================================================================

  static async saveDataExchangeMessage(
    message: DataExchangeMessage
  ): Promise<DataExchangeMessage | null> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("data_exchange_messages")
        .upsert(
          {
            message_id: message.id,
            from_did: message.from,
            to_did: message.to,
            data_hash: message.dataHash,
            encrypted_data: message.encryptedData,
            encryption_algorithm: message.encryptionAlgorithm,
            nonce: message.nonce,
            status: message.status,
            credential_request: (message.credentialRequest || null) as unknown as Record<
              string,
              unknown
            >,
            expires_at: message.expiresAt ? new Date(message.expiresAt) : null,
            read_at: null,
          },
          { onConflict: "message_id" }
        )
        .select()
        .single();

      if (error || !data) return null;
      return this.mapDataExchangeMessageFromDB(data);
    } catch {
      return null;
    }
  }

  static async getDataExchangeMessagesForDid(
    did: string,
    direction: "inbox" | "outbox" = "inbox"
  ): Promise<DataExchangeMessage[]> {
    try {
      const supabase = await this.getClient();
      let query = supabase.from("data_exchange_messages").select("*");
      query =
        direction === "inbox"
          ? query.eq("to_did", did)
          : query.eq("from_did", did);

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error || !data) return [];
      return (data || []).map((row: any) => this.mapDataExchangeMessageFromDB(row));
    } catch {
      return [];
    }
  }

  static async updateDataExchangeMessageStatus(
    messageId: string,
    status: DataExchangeMessage["status"],
    encryptedData?: string
  ): Promise<DataExchangeMessage | null> {
    try {
      const supabase = await this.getClient();
      const update: Record<string, unknown> = { status };
      if (encryptedData !== undefined) {
        update.encrypted_data = encryptedData;
      }

      const { data, error } = await supabase
        .from("data_exchange_messages")
        .update(update)
        .eq("message_id", messageId)
        .select()
        .single();

      if (error || !data) return null;
      return this.mapDataExchangeMessageFromDB(data);
    } catch {
      return null;
    }
  }

  // ============================================================================
  // IDENTITIES CRUD
  // ============================================================================

  static async saveIdentity(identity: Identity, userId: string): Promise<Identity | null> {
    try {
      const supabase = this.getClient();
      
      const { data, error } = await (await supabase)
        .from("identities")
        .upsert(
          {
            did: identity.did,
            wallet_address: identity.walletAddress,
            public_key_hex: identity.publicKeyHex,
            private_key_hex: identity.privateKeyHex,
            name: identity.name,
            description: identity.description,
            did_document: identity.didDocument,
            metadata: { ...identity.metadata, userId },
          },
          { onConflict: "did" }
        )
        .select()
        .single();

      if (error) {
        console.error("[v0] Error saving identity:", error);
        return null;
      }

      console.log("[v0] Identity saved to Supabase:", identity.did);
      return this.mapIdentityFromDB(data);
    } catch (error) {
      console.error("[v0] Exception saving identity:", error);
      return null;
    }
  }

  static async getIdentity(did: string): Promise<Identity | null> {
    try {
      const supabase = this.getClient();
      
      const { data, error } = await (await supabase)
        .from("identities")
        .select("*")
        .eq("did", did)
        .single();

      if (error) {
        console.error("[v0] Error fetching identity:", error);
        return null;
      }

      return this.mapIdentityFromDB(data);
    } catch (error) {
      console.error("[v0] Exception fetching identity:", error);
      return null;
    }
  }

  static async getUserIdentities(userId: string): Promise<Identity[]> {
    try {
      const supabase = this.getClient();
      
      const { data, error } = await (await supabase)
        .from("identities")
        .select("*")
        .eq("metadata->>userId", userId);

      if (error) {
        console.error("[v0] Error fetching user identities:", error);
        return [];
      }

      return data.map(this.mapIdentityFromDB) || [];
    } catch (error) {
      console.error("[v0] Exception fetching user identities:", error);
      return [];
    }
  }

  static async deleteIdentity(did: string): Promise<boolean> {
    try {
      const supabase = this.getClient();
      
      const { error } = await (await supabase)
        .from("identities")
        .delete()
        .eq("did", did);

      if (error) {
        console.error("[v0] Error deleting identity:", error);
        return false;
      }

      console.log("[v0] Identity deleted:", did);
      return true;
    } catch (error) {
      console.error("[v0] Exception deleting identity:", error);
      return false;
    }
  }

  // ============================================================================
  // CREDENTIALS CRUD
  // ============================================================================

  static async saveCredential(
    credential: VerifiableCredential,
    userId: string
  ): Promise<VerifiableCredential | null> {
    try {
      const supabase = this.getClient();
      
      const { data, error } = await (await supabase)
        .from("verifiable_credentials")
        .upsert(
          {
            credential_id: credential.id,
            issuer_did: credential.issuer,
            subject_did: credential.credentialSubject?.id || "",
            credential_type: credential.type,
            issuance_date: new Date(credential.issuanceDate).toISOString(),
            expiration_date: credential.expirationDate
              ? new Date(credential.expirationDate).toISOString()
              : null,
            credential_subject: credential.credentialSubject,
            proof: credential.proof,
            credential_json: credential,
            status: "active",
            blockchain_hash: null,
          },
          { onConflict: "credential_id" }
        )
        .select()
        .single();

      if (error) {
        console.error("[v0] Error saving credential:", error);
        return null;
      }

      console.log("[v0] Credential saved to Supabase:", credential.id);
      return this.mapCredentialFromDB(data);
    } catch (error) {
      console.error("[v0] Exception saving credential:", error);
      return null;
    }
  }

  static async getCredentials(
    userId: string,
    role: "owner" | "issuer" | "verifier"
  ): Promise<VerifiableCredential[]> {
    try {
      const supabase = this.getClient();
      let query = (await supabase).from("verifiable_credentials").select("*");

      // Filter based on the user's DID, so each user only sees their own credentials.
      const identities = await this.getUserIdentities(userId);
      const personalDid = identities[0]?.did;

      if (role === "owner") {
        if (personalDid) {
          query = query.eq("subject_did", personalDid);
        }
        query = query.eq("status", "active");
      } else if (role === "issuer") {
        // For issuer, credentials are issued with the ORGANIZATION DID, not personal DID.
        // Look up the org DID via organization_memberships → organizations.
        const orgDid = await this.getOrganizationDidForUser(userId);
        const issuerDid = orgDid || personalDid;
        if (issuerDid) {
          query = query.eq("issuer_did", issuerDid);
        }
        // Show all statuses (active + revoked) so issuer can see full history
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("[v0] Error fetching credentials:", error);
        return [];
      }

      return (data || []).map(this.mapCredentialFromDB);
    } catch (error) {
      console.error("[v0] Exception fetching credentials:", error);
      return [];
    }
  }

  /**
   * Look up the organization DID for a user via memberships table.
   */
  private static async getOrganizationDidForUser(userId: string): Promise<string | null> {
    try {
      const supabase = this.getClient();
      const { data: membership, error: memErr } = await (await supabase)
        .from("organization_memberships")
        .select("organization_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (memErr || !membership) return null;

      const orgId = (membership as any).organization_id as string;
      const { data: org, error: orgErr } = await (await supabase)
        .from("organizations")
        .select("did")
        .eq("id", orgId)
        .maybeSingle();

      if (orgErr || !org) return null;
      return ((org as any).did as string) || null;
    } catch {
      return null;
    }
  }

  static async revokeCredential(credentialId: string): Promise<boolean> {
    try {
      const supabase = this.getClient();
      
      const { error } = await (await supabase)
        .from("verifiable_credentials")
        .update({ status: "revoked" })
        .eq("credential_id", credentialId);

      if (error) {
        console.error("[v0] Error revoking credential:", error);
        return false;
      }

      console.log("[v0] Credential revoked:", credentialId);
      return true;
    } catch (error) {
      console.error("[v0] Exception revoking credential:", error);
      return false;
    }
  }

  // ============================================================================
  // POLICIES CRUD
  // ============================================================================

  static async savePolicy(
    policy: AccessControlPolicy,
    userId: string
  ): Promise<AccessControlPolicy | null> {
    try {
      const supabase = this.getClient();
      
      const { data, error } = await (await supabase)
        .from("access_control_policies")
        .upsert(
          {
            id: policy.id,
            resource_id: policy.resourceId,
            resource_type: policy.resourceType,
            owner_did: policy.owner,
            active: policy.active,
            policy_json: policy,
          },
          { onConflict: "id" }
        )
        .select()
        .single();

      if (error) {
        console.error("[v0] Error saving policy:", error);
        return null;
      }

      console.log("[v0] Policy saved to Supabase:", policy.id);
      return this.mapPolicyFromDB(data);
    } catch (error) {
      console.error("[v0] Exception saving policy:", error);
      return null;
    }
  }

  static async getPolicies(ownerDid: string): Promise<AccessControlPolicy[]> {
    try {
      const supabase = this.getClient();
      
      const { data, error } = await (await supabase)
        .from("access_control_policies")
        .select("*")
        .eq("owner_did", ownerDid)
        .eq("active", true);

      if (error) {
        console.error("[v0] Error fetching policies:", error);
        return [];
      }

      return (data || []).map(this.mapPolicyFromDB);
    } catch (error) {
      console.error("[v0] Exception fetching policies:", error);
      return [];
    }
  }

  static async deletePolicy(policyId: string): Promise<boolean> {
    try {
      const supabase = this.getClient();
      
      const { error } = await (await supabase)
        .from("access_control_policies")
        .update({ active: false })
        .eq("id", policyId);

      if (error) {
        console.error("[v0] Error deleting policy:", error);
        return false;
      }

      console.log("[v0] Policy deleted:", policyId);
      return true;
    } catch (error) {
      console.error("[v0] Exception deleting policy:", error);
      return false;
    }
  }

  // ============================================================================
  // DATA LIFECYCLE CRUD
  // ============================================================================

  static async getDataLifecycle(credentialId: string): Promise<DataRetention | null> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("data_lifecycle")
        .select("*")
        .eq("resource_id", credentialId)
        .single();

      if (error || !data) return null;
      return data as unknown as DataRetention;
    } catch {
      return null;
    }
  }

  static async getLifecycleEvents(credentialId: string): Promise<DataLifecycleEvent[]> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("data_lifecycle_events")
        .select("*")
        .eq("credential_id", credentialId)
        .order("timestamp", { ascending: false });

      if (error || !data) return [];
      return data as unknown as DataLifecycleEvent[];
    } catch {
      return [];
    }
  }

  static async getUserDataLifecycles(userId: string): Promise<DataRetention[]> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("data_lifecycle")
        .select("*")
        .eq("user_id", userId);

      if (error || !data) return [];
      return data as unknown as DataRetention[];
    } catch {
      return [];
    }
  }

  static async saveDataLifecycle(lifecycle: DataRetention): Promise<DataRetention | null> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("data_lifecycle")
        .upsert(lifecycle as unknown as Record<string, unknown>)
        .select()
        .single();

      if (error || !data) return null;
      return data as unknown as DataRetention;
    } catch {
      return null;
    }
  }

  static async saveLifecycleEvent(event: DataLifecycleEvent): Promise<DataLifecycleEvent | null> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("data_lifecycle_events")
        .insert(event as unknown as Record<string, unknown>)
        .select()
        .single();

      if (error || !data) return null;
      return data as unknown as DataLifecycleEvent;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // CONSENT CRUD
  // ============================================================================

  static async getConsentRecord(consentId: string): Promise<ConsentRecord | null> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("consent_records")
        .select("*")
        .eq("id", consentId)
        .single();

      if (error || !data) return null;
      return data as unknown as ConsentRecord;
    } catch {
      return null;
    }
  }

  static async getUserConsentRecords(userId: string): Promise<ConsentRecord[]> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("consent_records")
        .select("*")
        .eq("user_id", userId);

      if (error || !data) return [];
      return data as unknown as ConsentRecord[];
    } catch {
      return [];
    }
  }

  static async saveConsentRecord(record: ConsentRecord): Promise<ConsentRecord | null> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("consent_records")
        .upsert(record as unknown as Record<string, unknown>)
        .select()
        .single();

      if (error || !data) return null;
      return data as unknown as ConsentRecord;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // REVOCATION CRUD
  // ============================================================================

  static async getRevocationRegistry(userId: string): Promise<RevocationRegistry | null> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("revocation_records")
        .select("*")
        .eq("revoked_by", userId);

      if (error || !data || data.length === 0) return null;
      const records = data as unknown as RevocationRecord[];
      return {
        id: `registry-${userId}`,
        revokedItems: records,
        createdAt: records[0]?.revokedAt ?? new Date(),
        updatedAt: records[records.length - 1]?.revokedAt ?? new Date(),
        issuerId: userId,
      };
    } catch {
      return null;
    }
  }

  static async saveRevocationRecord(record: RevocationRecord): Promise<RevocationRecord | null> {
    try {
      const supabase = await this.getClient();
      const { data, error } = await supabase
        .from("revocation_records")
        .insert(record as unknown as Record<string, unknown>)
        .select()
        .single();

      if (error || !data) return null;
      return data as unknown as RevocationRecord;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private static mapIdentityFromDB(data: any): Identity {
    return {
      id: data.id,
      did: data.did,
      didDocument: data.did_document,
      publicKeyHex: data.public_key_hex,
      privateKeyHex: data.private_key_hex,
      publicKey: new Uint8Array(Buffer.from(data.public_key_hex, "hex")),
      privateKey: data.private_key_hex
        ? new Uint8Array(Buffer.from(data.private_key_hex, "hex"))
        : undefined,
      walletAddress: data.wallet_address,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      name: data.name,
      description: data.description,
      metadata: data.metadata,
    };
  }

  private static mapCredentialFromDB(data: any): VerifiableCredential {
    const base = data.credential_json || {
      id: data.credential_id,
      type: data.credential_type,
      issuer: data.issuer_did,
      issuanceDate: new Date(data.issuance_date),
      expirationDate: data.expiration_date ? new Date(data.expiration_date) : undefined,
      credentialSubject: data.credential_subject,
      proof: data.proof,
    };
    // Always attach DB status so UI can distinguish active vs revoked
    base._status = data.status || "active";
    base._credentialId = data.credential_id;
    base._subjectDid = data.subject_did;
    // Issuer name (stored in credential_json at issuance time)
    if (!base._issuerName && data.credential_json?._issuerName) {
      base._issuerName = data.credential_json._issuerName;
    }
    return base;
  }

  private static mapPolicyFromDB(data: any): AccessControlPolicy {
    return data.policy_json || {
      id: data.id,
      resourceId: data.resource_id,
      resourceType: data.resource_type,
      owner: data.owner_did,
      rules: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      active: data.active,
    };
  }

  private static mapDataExchangeMessageFromDB(data: any): DataExchangeMessage {
    return {
      id: data.message_id,
      from: data.from_did,
      to: data.to_did,
      dataHash: data.data_hash,
      encryptedData: data.encrypted_data,
      encryptionAlgorithm: data.encryption_algorithm,
      nonce: data.nonce,
      timestamp: data.created_at ? new Date(data.created_at) : new Date(),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      credentialRequest: (data.credential_request || undefined) as CredentialRequest | undefined,
      status: data.status,
    };
  }
}

export default SupabaseRepository;
