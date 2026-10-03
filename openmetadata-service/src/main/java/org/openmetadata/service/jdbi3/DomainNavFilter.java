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

  /**
   * Where the list's parent (the entity a list is confined to, e.g. a schema's tables) sits relative
   * to the selection. A child's effective domain is its own, else its parent's.
   */
  public enum ParentScope {
    /** The list is not confined to a parent. */
    NONE,
    /** The parent's effective domain is the selection or under it. */
    IN_SELECTION,
    /** The parent's effective domain is outside the selection. */
    OUTSIDE_SELECTION,
    /** The list is confined to a parent that could not be resolved: list its children in full. */
    UNRESOLVED
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
    apply(
        filter,
        entityType,
        supportsDomains,
        selectedDomainIds,
        selectedDomainFqnHash,
        ParentScope.NONE);
  }

  /**
   * As above, for a list confined to a parent: with the parent {@link ParentScope#IN_SELECTION},
   * children without a domain of their own (inheriting the parent's) also match.
   */
  public static void apply(
      ListFilter filter,
      String entityType,
      boolean supportsDomains,
      String selectedDomainIds,
      String selectedDomainFqnHash,
      ParentScope parent) {
    String explicitDomainIds = filter.getQueryParams().get("domainId");
    boolean hasExplicitDomain = explicitDomainIds != null;
    boolean echoesSelection =
        hasExplicitDomain
            && !nullOrEmpty(selectedDomainIds)
            && explicitDomainIds.replace("'", "").equals(selectedDomainIds);
    if (parent == ParentScope.UNRESOLVED) {
      if (echoesSelection) {
        filter.removeQueryParam("domainId");
      }
      return;
    }
    if (shouldApply(
        entityType, supportsDomains, hasExplicitDomain && !echoesSelection, selectedDomainIds)) {
      stamp(filter, entityType, selectedDomainIds, selectedDomainFqnHash);
      if (parent == ParentScope.IN_SELECTION) {
        filter.addQueryParam("domainAccessControl", Boolean.TRUE.toString());
      }
    }
  }

  private static void stamp(
      ListFilter filter, String entityType, String domainIds, String domainFqnHash) {
    filter.addQueryParam("domainId", domainIds);
    if (!nullOrEmpty(domainFqnHash)) {
      filter.addQueryParam("domainFqnHash", domainFqnHash);
    }
    if (filter.getQueryParams().get("entityType") == null) {
      filter.addQueryParam("entityType", entityType);
    }
  }
}
