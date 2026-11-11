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

import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * The owner of one cache entry: the canonical user name a token was minted for. One principal has
 * one entry holding every OpenMetadata-signed token stored for it (the JWT in
 * {@code authenticationMechanism} plus every personal access token row). For a bot token presented
 * with {@code X-Impersonate-User}, the principal is the bot (the token's own principal), never the
 * impersonation target.
 *
 * <p>{@link #of} is the only place that decides how a name becomes a principal, and
 * {@link #nameHash} the only place that decides which row it denotes, so the verifier, the source
 * and the write side can never disagree.
 */
public record CredentialSubject(String principal) {
  /** Canonicalizes through {@link UserRepository#canonicalUserName}, which builds a user's FQN. */
  public CredentialSubject {
    if (principal == null || principal.isBlank()) {
      throw new IllegalArgumentException("A credential subject needs a principal name");
    }
    principal = UserRepository.canonicalUserName(principal);
  }

  /** "Alice" and "alice" give one subject, because they denote one user row. */
  public static CredentialSubject of(String userName) {
    return new CredentialSubject(userName);
  }

  /** Exactly the {@code user_entity.nameHash} of the user row this principal names. */
  String nameHash() {
    return FullyQualifiedName.buildHash(EntityInterfaceUtil.quoteName(principal));
  }
}
