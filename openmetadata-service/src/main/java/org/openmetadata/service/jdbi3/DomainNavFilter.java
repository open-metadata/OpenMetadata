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

import java.util.Set;

/**
 * Applies the global (navbar) domain filter to a list from the caller's persisted selected domain.
 *
 * <p>A view preference, not access control: it narrows what a list shows and never blocks a direct
 * read. The decision is {@code supportsDomains && !isExcluded(entityType)} and only fires for a
 * user-facing list that has not already been scoped explicitly via {@code ?domain=}. It is invoked
 * from the single list hook ({@code EntityUtil.addDomainQueryParam}), so internal bulk reads such as
 * reindex never route through it.
 */
public final class DomainNavFilter {
  private DomainNavFilter() {}

  /** List params that confine a list to the children of one entity. */
  private static final Set<String> PARENT_SCOPE_PARAMS =
      Set.of(
          "service",
          "database",
          "databaseSchema",
          "parent",
          "directChildrenOf",
          "apiCollection",
          "directory",
          "spreadsheet",
          "aboutEntity",
          "entityFQNHash",
          "entityLink");

  private static boolean isScopedToParent(ListFilter filter) {
    return PARENT_SCOPE_PARAMS.stream()
        .anyMatch(param -> !nullOrEmpty(filter.getQueryParams().get(param)));
  }

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

  /**
   * Stamps the selection onto {@code filter} when {@link #shouldApply} allows it. {@code
   * selectedDomainFqnHash} lets the list also match assets in the selected domain's sub-domains
   * (a parent pick includes its descendants); pass null to match the exact domain only.
   *
   * <p>An explicit {@code ?domain=} keeps control of which domain is listed. When it merely echoes
   * the request's active domain (the UI sends the navbar pick on every list call), it is the
   * navbar selection and gets the same sub-domain matching; any other explicit domain is left as
   * the caller passed it.
   */
  public static void apply(
      ListFilter filter,
      String entityType,
      boolean supportsDomains,
      String selectedDomainIds,
      String selectedDomainFqnHash) {
    String explicitDomainIds = filter.getQueryParams().get("domainId");
    boolean hasExplicitDomain = explicitDomainIds != null;
    boolean echoesSelection =
        hasExplicitDomain
            && !nullOrEmpty(selectedDomainIds)
            && explicitDomainIds.replace("'", "").equals(selectedDomainIds);
    if (isScopedToParent(filter)) {
      // Children of an opened entity (e.g. a glossary's terms) are listed in full; they mostly
      // inherit the parent's domain and hold no domain row of their own.
      if (echoesSelection) {
        filter.removeQueryParam("domainId");
      }
      return;
    }
    if (!shouldApply(
        entityType, supportsDomains, hasExplicitDomain && !echoesSelection, selectedDomainIds)) {
      return;
    }
    filter.addQueryParam("domainId", selectedDomainIds);
    if (!nullOrEmpty(selectedDomainFqnHash)) {
      filter.addQueryParam("domainFqnHash", selectedDomainFqnHash);
    }
    if (filter.getQueryParams().get("entityType") == null) {
      filter.addQueryParam("entityType", entityType);
    }
  }
}
