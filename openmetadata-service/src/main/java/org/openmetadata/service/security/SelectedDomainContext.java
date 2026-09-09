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
 * Request-scoped carrier for the caller's selected (navbar) domain, mirroring {@link
 * ActivePersonaContext}.
 *
 * <p>Populated by {@code JwtFilter} from the user's persisted {@code defaultDomain} (never for
 * bots), and read by the list path to narrow domain-scoped list views. Holds the selected domain
 * id, or a comma-separated set of ids once sub-domain descendants are expanded. Deliberately kept
 * out of the authentication {@code SecurityContext}: it is a view preference consumed only in list
 * filtering, never in authorization.
 */
public final class SelectedDomainContext {
  private static final ThreadLocal<String> SELECTED_DOMAIN_IDS = new ThreadLocal<>();

  private SelectedDomainContext() {}

  public static void setSelectedDomainIds(String domainIds) {
    if (nullOrEmpty(domainIds)) {
      SELECTED_DOMAIN_IDS.remove();
    } else {
      SELECTED_DOMAIN_IDS.set(domainIds);
    }
  }

  public static String getSelectedDomainIds() {
    return SELECTED_DOMAIN_IDS.get();
  }

  public static void clear() {
    SELECTED_DOMAIN_IDS.remove();
  }
}
