/**
 * App-wide UI configuration. Seeded from yaml/env on first boot; DB-backed and
 * admin-mutable at runtime afterwards (yaml is ignored once a DB row exists).
 */
export interface AppConfiguration {
    /**
     * Tenant-wide 'first impression' app-mode default. Seeds the app mode for users who have
     * not chosen one; user preference and persona-level app mode still win over this default.
     * Null means no tenant default is configured.
     */
    defaultAppMode?: DefaultAppMode | null;
}

export enum DefaultAppMode {
    AI = "ai",
    Classic = "classic",
}
