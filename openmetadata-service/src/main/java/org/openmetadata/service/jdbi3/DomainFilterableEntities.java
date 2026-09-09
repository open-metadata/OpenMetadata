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
import org.openmetadata.service.Entity;

/**
 * Entity types the global (navbar) domain filter is allowed to narrow.
 *
 * <p>The filter is a strict domain-membership condition, so applying it to a type that is not
 * domain-scoped in practice (e.g. user/team/policy/tag) returns an empty list rather than a
 * narrowed one — which would empty Settings pages and tag pickers. The list is therefore an
 * explicit allowlist of domain-scoped catalog assets and governance artifacts, and is
 * safe-by-default: a new entity type is not filtered until it is added here.
 */
public final class DomainFilterableEntities {
  private DomainFilterableEntities() {}

  private static final Set<String> ENTITY_TYPES =
      Set.of(
          // Services
          Entity.DATABASE_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.DASHBOARD_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.METADATA_SERVICE,
          Entity.SEARCH_SERVICE,
          Entity.API_SERVICE,
          // Data assets
          Entity.DATABASE,
          Entity.DATABASE_SCHEMA,
          Entity.TABLE,
          Entity.STORED_PROCEDURE,
          Entity.DASHBOARD,
          Entity.DASHBOARD_DATA_MODEL,
          Entity.CHART,
          Entity.PIPELINE,
          Entity.TOPIC,
          Entity.CONTAINER,
          Entity.SEARCH_INDEX,
          Entity.MLMODEL,
          Entity.API_COLLECTION,
          Entity.API_ENDPOINT,
          Entity.DIRECTORY,
          Entity.FILE,
          Entity.SPREADSHEET,
          Entity.WORKSHEET,
          // Domain-scoped governance
          Entity.GLOSSARY,
          Entity.GLOSSARY_TERM,
          Entity.DATA_PRODUCT,
          Entity.METRIC);

  /** True when the global domain filter should narrow lists of the given entity type. */
  public static boolean isFilterable(String entityType) {
    return !nullOrEmpty(entityType) && ENTITY_TYPES.contains(entityType);
  }
}
