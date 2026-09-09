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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import org.openmetadata.service.security.SelectedDomainContext;

/**
 * Applies the global (navbar) domain filter to a paginated list, from the caller's persisted
 * selected domain ({@link SelectedDomainContext}).
 *
 * <p>The decision is {@code supportsDomains && !isExcluded(entityType)} and only fires for a
 * user-facing list that has not already been scoped explicitly via {@code ?domain=}. Internal bulk
 * reads (reindex, {@code listAll}) never route through here, so they always see every domain.
 */
public final class DomainNavFilter {
  private DomainNavFilter() {}

  /**
   * True when the navbar domain filter should narrow a list of {@code entityType}.
   *
   * @param supportsDomains the entity's intrinsic {@code EntityRepository.supportsDomains}
   * @param hasExplicitDomain whether the caller already passed {@code ?domain=}/{@code domainId}
   * @param selectedDomainIds the caller's selected domain id(s), or null/empty when none
   */
  public static boolean shouldApply(
      String entityType,
      boolean supportsDomains,
      boolean hasExplicitDomain,
      String selectedDomainIds) {
    return supportsDomains
        && !hasExplicitDomain
        && !nullOrEmpty(selectedDomainIds)
        && !DomainFilterExclusions.isExcluded(entityType);
  }

  /** Stamps the selected domain onto {@code filter} when {@link #shouldApply} allows it. */
  public static void apply(ListFilter filter, String entityType, boolean supportsDomains) {
    String selectedDomainIds = SelectedDomainContext.getSelectedDomainIds();
    boolean hasExplicitDomain = filter.getQueryParams().get("domainId") != null;
    if (shouldApply(entityType, supportsDomains, hasExplicitDomain, selectedDomainIds)) {
      filter.addQueryParam("domainId", selectedDomainIds);
      if (filter.getQueryParams().get("entityType") == null) {
        filter.addQueryParam("entityType", entityType);
      }
    }
  }
}
