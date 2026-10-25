/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.security.credentials;

import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.auth.ServiceTokenType;

/**
 * What a signature-verified bearer token is, as far as stored-credential revocation is concerned.
 * Parsed once, at the authentication boundary, from three facts: whether OpenMetadata's own key
 * signed it, its {@code isBot} claim and its {@code tokenType} claim. Every token lands in exactly
 * one variant, so no claim combination escapes the stored-token check, and the switch over this
 * type in {@link CredentialVerifier#require} is exhaustive.
 */
public sealed interface OmCredential
    permits OmCredential.Stored, OmCredential.NotStored, OmCredential.Unrecognized {

  /** A credential with a server-side current value; valid only while that value holds it. */
  record Stored(CredentialSubject subject) implements OmCredential {}

  /**
   * A token with no stored value to compare against: identity-provider tokens and OpenMetadata
   * login or session tokens. Session-bound tokens keep their existing {@code sessionId} read and
   * logout keeps its denylist; neither is this module's concern.
   */
  record NotStored() implements OmCredential {}

  /** A claim combination OpenMetadata never mints for an API credential. Always rejected. */
  record Unrecognized(String reason) implements OmCredential {}

  /** The {@code tokenType} claim, parsed. {@code UNKNOWN} is a present value outside the enum. */
  enum TokenTypeClaim {
    ABSENT,
    BOT,
    OM_USER,
    PERSONAL_ACCESS,
    UNKNOWN;

    private static final Map<String, TokenTypeClaim> BY_CLAIM =
        Arrays.stream(ServiceTokenType.values())
            .collect(Collectors.toUnmodifiableMap(ServiceTokenType::value, TokenTypeClaim::of));

    static TokenTypeClaim parse(String claim) {
      return claim == null || claim.isBlank() ? ABSENT : BY_CLAIM.getOrDefault(claim, UNKNOWN);
    }

    /** Exhaustive, so a new {@link ServiceTokenType} fails compilation until the table decides it. */
    private static TokenTypeClaim of(ServiceTokenType type) {
      return switch (type) {
        case BOT -> BOT;
        case OM_USER -> OM_USER;
        case PERSONAL_ACCESS -> PERSONAL_ACCESS;
      };
    }
  }

  /**
   * Total classification over (signedByOpenMetadata, isBot, tokenType):
   *
   * <pre>
   *  OM key  isBot   tokenType                            result
   *  no      true    any                                  Unrecognized
   *  no      false   any                                  NotStored
   *  yes     true    ABSENT | BOT                         Stored(principal)
   *  yes     true    OM_USER | PERSONAL_ACCESS | UNKNOWN  Unrecognized
   *  yes     false   PERSONAL_ACCESS                      Stored(principal)
   *  yes     false   ABSENT | OM_USER                     NotStored
   *  yes     false   BOT | UNKNOWN                        Unrecognized
   * </pre>
   *
   * @param tokenTypeClaim the raw {@code tokenType} claim, null when absent
   * @param tokenPrincipal the user name the token was minted for, before any impersonation swap
   */
  static OmCredential classify(
      boolean signedByOpenMetadata,
      boolean isBotClaim,
      String tokenTypeClaim,
      String tokenPrincipal) {
    TokenTypeClaim tokenType = TokenTypeClaim.parse(tokenTypeClaim);
    OmCredential credential;
    if (signedByOpenMetadata) {
      credential = classifyOpenMetadataSigned(isBotClaim, tokenType, tokenPrincipal);
    } else {
      credential = isBotClaim ? unrecognized(false, isBotClaim, tokenType) : new NotStored();
    }
    return credential;
  }

  /** One case per row of the table; the ternary in each row is the isBot column. */
  private static OmCredential classifyOpenMetadataSigned(
      boolean isBotClaim, TokenTypeClaim tokenType, String tokenPrincipal) {
    return switch (tokenType) {
      case ABSENT -> isBotClaim ? stored(tokenPrincipal) : new NotStored();
      case BOT -> isBotClaim ? stored(tokenPrincipal) : unrecognized(true, isBotClaim, tokenType);
      case OM_USER -> isBotClaim ? unrecognized(true, isBotClaim, tokenType) : new NotStored();
      case PERSONAL_ACCESS -> isBotClaim
          ? unrecognized(true, isBotClaim, tokenType)
          : stored(tokenPrincipal);
      case UNKNOWN -> unrecognized(true, isBotClaim, tokenType);
    };
  }

  private static Stored stored(String tokenPrincipal) {
    return new Stored(CredentialSubject.of(tokenPrincipal));
  }

  private static Unrecognized unrecognized(
      boolean signedByOpenMetadata, boolean isBotClaim, TokenTypeClaim tokenType) {
    return new Unrecognized(
        "signedByOpenMetadata=%s, isBot=%s, tokenType=%s"
            .formatted(signedByOpenMetadata, isBotClaim, tokenType));
  }
}
