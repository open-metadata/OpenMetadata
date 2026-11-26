/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.socket;

import java.time.Instant;
import java.util.List;

/**
 * The validated identity a push-feed socket may act as: the user id (UUID as a string) the socket
 * is keyed under, the session id its handshake was accepted with, the provider value of the
 * configuration that validated the handshake, and the expiry of the token a socket without a
 * session was accepted on. All come from {@link SocketAddressFilter#authenticate} — never from a
 * client-supplied value. The provider is null only when the filter has no configuration to validate
 * a token with. The token expiry is null for a socket with a session, which its session governs,
 * and for a token without exp.
 */
public record HandshakeIdentity(
    String userId, String sessionId, String provider, Instant tokenExpiresAt) {
  public static final String USER_ID_HEADER = "UserId";
  public static final String SESSION_ID_HEADER = "SessionId";
  public static final String PROVIDER_HEADER = "AuthProvider";

  /** Epoch milliseconds. */
  public static final String TOKEN_EXPIRES_AT_HEADER = "TokenExpiresAt";

  /** The headers the handshake stamps on a socket; a client's own value for any never survives. */
  public static final List<String> STAMPED_HEADERS =
      List.of(USER_ID_HEADER, SESSION_ID_HEADER, PROVIDER_HEADER, TOKEN_EXPIRES_AT_HEADER);

  /** An identity no token expiry bounds. */
  public HandshakeIdentity(String userId, String sessionId, String provider) {
    this(userId, sessionId, provider, null);
  }

  /** The value stamped as {@link #TOKEN_EXPIRES_AT_HEADER}; null when no expiry bounds the socket. */
  public String tokenExpiresAtHeaderValue() {
    return tokenExpiresAt == null ? null : String.valueOf(tokenExpiresAt.toEpochMilli());
  }
}
