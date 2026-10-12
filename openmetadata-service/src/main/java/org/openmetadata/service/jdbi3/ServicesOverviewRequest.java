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
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.services.ServiceHealth;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;

/**
 * Validated, normalized parameters for {@code GET /v1/services/overview}. The resource binds and
 * normalizes; everything downstream reads a value object rather than re-deriving defaults.
 *
 * @param entityTypes the counted universe
 * @param listEntityTypes the subset that {@code data} is drawn from — the caller's active tab
 * @param serviceTypes connector filter; affects the list only, never the count maps
 * @param healths health filter; affects the list only, never the count maps
 */
public record ServicesOverviewRequest(
    Set<String> entityTypes,
    Set<String> listEntityTypes,
    Set<String> serviceTypes,
    Set<ServiceHealth> healths,
    String q,
    boolean includeHealth,
    int limit,
    int offset,
    boolean ascending,
    Include include,
    UUID domainId,
    ProviderType excludeProvider) {

  /**
   * Ceiling on {@code offset + limit}. The merge holds {@code (name, id)} tuples for up to this many
   * rows per entity type, so an unbounded offset would be an unbounded allocation. Deep paging over
   * services is not a real access pattern; the per-service-type list APIs offer cursor paging for
   * anyone who needs it.
   */
  public static final int MAX_WINDOW = 10_000;

  /** Above this, the estate is large enough that operators should know clients cannot cache it. */
  public static final int LARGE_ESTATE_WARN_THRESHOLD = 5_000;

  /**
   * How many keys to scan per entity type. Without a health filter the global window {@code [offset,
   * offset + limit)} can never need more than {@code offset + limit} rows from any single type. A
   * health filter is applied after the scan — it lives in the time-series table, not on the service
   * row — so the scan can no longer be bounded that way and falls back to the hard window.
   */
  public int keyScanLimit() {
    return nullOrEmpty(healths) ? Math.min(offset + limit, MAX_WINDOW) : MAX_WINDOW;
  }

  /**
   * Narrows both the counted universe and the listed types to {@code allowed}, for callers who may
   * only view some service types. Intersecting rather than replacing {@code listEntityTypes} keeps
   * an explicit tab selection honoured while still dropping anything unauthorized.
   */
  public ServicesOverviewRequest restrictedTo(Set<String> allowed) {
    Set<String> listTypes =
        listEntityTypes.stream().filter(allowed::contains).collect(Collectors.toSet());
    return new ServicesOverviewRequest(
        allowed,
        listTypes,
        serviceTypes,
        healths,
        q,
        includeHealth,
        limit,
        offset,
        ascending,
        include,
        domainId,
        excludeProvider);
  }
}
