/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.auth0.jwt.RegisteredClaims;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;

/**
 * The {@code aud} values an authentication entry point accepts on a token OpenMetadata signed.
 *
 * <p>OpenMetadata writes {@code aud} only on the access tokens its MCP OAuth server mints, where it
 * names the MCP resource the token was issued for (RFC 8707). Such a token is accepted only by an
 * entry point serving that resource. The REST API and the push-feed handshake serve no audience, so
 * they refuse every OpenMetadata-signed token that carries one. A token OpenMetadata signed without
 * {@code aud} (login and session tokens, bot tokens, personal access tokens, and MCP access tokens
 * minted before audience binding) is accepted on every entry point, the MCP endpoint included.
 * Identity provider tokens are not judged here: {@link ProviderTokenValidator} checks their
 * audience against the configured client ids.
 * ADR:2026-11-25-mcp-oauth-binds-tokens-to-the-canonical-resource
 */
public final class TokenAudience {
  /** The REST API and the push-feed handshake: no audience names them. */
  public static final TokenAudience OPENMETADATA_API = new TokenAudience(audience -> false);

  private static final String ISSUED_FOR_ANOTHER_RESOURCE =
      "Token was issued for another resource.";

  private final Predicate<String> namesServedResource;

  private TokenAudience(Predicate<String> namesServedResource) {
    this.namesServedResource = Objects.requireNonNull(namesServedResource);
  }

  /**
   * An entry point serving its own resource, which {@code namesServedResource} recognizes in one
   * {@code aud} value. It must answer false for a resource it cannot resolve, so the entry point
   * fails closed.
   */
  public static TokenAudience servedResourceNamedBy(Predicate<String> namesServedResource) {
    return new TokenAudience(namesServedResource);
  }

  /**
   * Accepts a token without {@code aud}. Otherwise every {@code aud} value must be text and one of
   * them must name the served resource: a JSON null, an empty list, a non-text value or a null
   * element is refused.
   *
   * @throws AuthenticationException the token was issued for another resource
   */
  public void requireAddressedHere(DecodedJWT jwt) {
    if (!jwt.getClaim(RegisteredClaims.AUDIENCE).isMissing() && !isAddressedHere(jwt)) {
      throw AuthenticationException.getInvalidTokenException(ISSUED_FOR_ANOTHER_RESOURCE);
    }
  }

  private boolean isAddressedHere(DecodedJWT jwt) {
    List<String> audiences = jwt.getAudience();
    return !nullOrEmpty(audiences)
        && audiences.stream().allMatch(Objects::nonNull)
        && audiences.stream().anyMatch(namesServedResource);
  }
}
