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

/**
 * Resolves the lifetime of the JWT that OpenMetadata issues for itself after an SSO login. Both the
 * OIDC and SAML configurations persist this as a user-editable value, and a non-positive one mints
 * tokens whose expiry equals their issue time, so every request 401s and the client refreshes
 * forever. Mirrors {@link org.openmetadata.service.security.session.SessionTimeoutResolver}, which
 * guards the sibling sessionExpiry setting the same way.
 */
public final class TokenValidityResolver {
  public static final int DEFAULT_TOKEN_VALIDITY_SECONDS = 3600;
  public static final int MIN_TOKEN_VALIDITY_SECONDS = 1;
  public static final String VALIDATION_MESSAGE = "Token validity must be at least 1 second";

  private TokenValidityResolver() {}

  public static boolean isValid(Integer validitySeconds) {
    return validitySeconds != null && validitySeconds >= MIN_TOKEN_VALIDITY_SECONDS;
  }

  /**
   * Whether a persisted value should be rejected on write. An absent value is accepted because the
   * schema default applies and {@link #resolveOrDefault} covers it at runtime; only an explicitly
   * configured non-positive value is a configuration error.
   */
  public static boolean isConfiguredInvalid(Integer validitySeconds) {
    return validitySeconds != null && validitySeconds < MIN_TOKEN_VALIDITY_SECONDS;
  }

  public static int resolveOrDefault(Integer validitySeconds) {
    return isValid(validitySeconds) ? validitySeconds : DEFAULT_TOKEN_VALIDITY_SECONDS;
  }
}
