declare module '@analytics/session-utils' {
  export type Session = {
    id: string;
    created: number;
    createdAt: string;
    expires: number;
    expiresAt: string;
    elapsed: number;
    remaining: number;
    isNew: boolean;
  };

  export const getSession: (
    minutes?: number,
    persistedOnly?: boolean
  ) => Session;

  export const setSession: (
    minutes?: number,
    extra = {},
    extend?: boolean
  ) => Session;
}
