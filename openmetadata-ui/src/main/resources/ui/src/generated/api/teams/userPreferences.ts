/**
 * Per-user opaque UI preferences bag. Not a full entity - no versioning, audit, or
 * soft-delete. Stored independently of the User entity so it can evolve without affecting
 * User schema/versioning.
 */
export interface UserPreferences {
    /**
     * Opaque per-user UI preferences (e.g. appMode).
     */
    preferences: { [key: string]: any };
    /**
     * Last update time corresponding to the new version of the preferences in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * Unique identifier of the User this preferences bag belongs to.
     */
    userId: string;
}
