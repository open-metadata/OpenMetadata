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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

/**
 * Holds the global (navbar-selected) domain sent on the request via the {@code X-OpenMetadata-Domain}
 * header, so code paths that don't have the {@link jakarta.ws.rs.core.SecurityContext} at hand can
 * still read it. Mirrors {@link ActivePersonaContext}. The value is a single domain fully-qualified
 * name; it is only ever used to NARROW a listing within the user's accessible domains, never for
 * authorization.
 */
public final class ActiveDomainContext {
  private static final ThreadLocal<String> ACTIVE_DOMAIN = new ThreadLocal<>();

  private ActiveDomainContext() {}

  public static void setActiveDomain(String activeDomain) {
    if (nullOrEmpty(activeDomain)) {
      ACTIVE_DOMAIN.remove();
    } else {
      ACTIVE_DOMAIN.set(activeDomain);
    }
  }

  public static String getActiveDomain() {
    return ACTIVE_DOMAIN.get();
  }

  public static void clear() {
    ACTIVE_DOMAIN.remove();
  }
}
