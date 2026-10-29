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

package org.openmetadata.service.security;

import jakarta.ws.rs.BadRequestException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.policyevaluator.SubjectCache;

/**
 * The caller's selected (navbar) domain for the current request, resolved once by the auth filter
 * from the user's persisted {@code defaultDomain} (or, for a bot impersonating the user, from the
 * domain the bot names) and carried alongside {@code CatalogSecurityContext.activeDomain}. Like the active persona it is a view preference: list
 * views narrow to it, and it must never be used for authorization.
 */
@Slf4j
public final class ActiveDomainContext {
  private static final ThreadLocal<EntityReference> ACTIVE_DOMAIN = new ThreadLocal<>();

  private ActiveDomainContext() {}

  /** The persisted selection of {@code userName}, or null for bots and unknown users. */
  public static EntityReference resolve(String userName, boolean isBot) {
    if (isBot || userName == null) {
      return null;
    }
    try {
      return SubjectCache.getUserContext(userName).getDefaultDomain();
    } catch (Exception e) {
      // e.g. the user is not provisioned yet (first login): no selection, never a failed request.
      LOG.debug("No active domain for user {}: {}", userName, e.getMessage());
      return null;
    }
  }

  /**
   * The domain an impersonating bot names in {@code X-OpenMetadata-Domain}: its FQN, percent-encoded
   * as UTF-8. Unlike a stale persisted selection, an unknown domain fails the request: the caller
   * asked for a scope, and silently listing the whole catalog is the answer it must not get.
   */
  public static EntityReference resolveRequested(String encodedFqn) {
    try {
      // Percent-decoding only: '+' is a literal character in a domain name, not a space.
      String fqn = URLDecoder.decode(encodedFqn.replace("+", "%2B"), StandardCharsets.UTF_8);
      return Entity.getEntityReferenceByName(Entity.DOMAIN, fqn, Include.NON_DELETED);
    } catch (IllegalArgumentException | EntityNotFoundException e) {
      throw new BadRequestException("Unknown domain in X-OpenMetadata-Domain: " + encodedFqn);
    }
  }

  public static void setActiveDomain(EntityReference activeDomain) {
    if (activeDomain == null) {
      ACTIVE_DOMAIN.remove();
    } else {
      ACTIVE_DOMAIN.set(activeDomain);
    }
  }

  public static EntityReference getActiveDomain() {
    return ACTIVE_DOMAIN.get();
  }

  public static void clear() {
    ACTIVE_DOMAIN.remove();
  }
}
