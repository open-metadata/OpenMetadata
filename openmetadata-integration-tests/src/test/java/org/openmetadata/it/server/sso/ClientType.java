package org.openmetadata.it.server.sso;

/**
 * OAuth2 client type — selects between {@code response_type=id_token} (browser receives
 * the token directly, no client secret) and {@code response_type=code} (browser gets a
 * code, OM exchanges it server-side using a client secret).
 */
public enum ClientType {
  PUBLIC,
  CONFIDENTIAL
}
