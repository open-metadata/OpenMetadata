/**
 * Administrative MCP OAuth client inventory. Never includes client secrets or tokens.
 */
export interface OauthClient {
    clientId?:     string;
    clientName?:   string;
    issuedAt?:     number;
    redirectUris?: string[];
}
