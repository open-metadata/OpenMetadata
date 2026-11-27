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

package org.openmetadata.service.migration.utils.v211;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.migration.utils.IdBatches;

/**
 * Deletes the lineage edges from a data product to itself. Data product lineage was recounted for
 * every pair of products on an asset's lineage edges, the asset's own product included, so an edge
 * between two assets of one product wrote one, and the lineage views showed the product feeding
 * itself. Only the rollup's own rows ({@code ChildAssets}) are deleted. The data product search
 * documents keep a deleted edge until they are reindexed, which the step logs.
 */
@Slf4j
public final class DataProductLineageSelfLoopRepair {

  public static final String STEP_NAME = "deleteDataProductLineageSelfLoops";

  private static final String DATA_PRODUCT = "dataProduct";
  private static final String DATA_PRODUCT_TABLE = "data_product_entity";
  private static final String SOURCE_FIELD = "source";
  private static final String ROLLUP_SOURCE = "ChildAssets";
  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();

  private static final String SELF_LOOPS =
      "FROM entity_relationship WHERE toId IN (<ids>) AND fromId = toId"
          + " AND fromEntity = :dataProduct AND toEntity = :dataProduct AND relation = :upstream";

  private DataProductLineageSelfLoopRepair() {}

  public static int deleteAll(final Handle handle) {
    final int deleted =
        IdBatches.fold(
            handle, DATA_PRODUCT_TABLE, 0, (count, batch) -> count + delete(handle, batch));
    LOG.info(
        "Deleted {} data product lineage edges to the product itself; reindex dataProduct to drop"
            + " them from the lineage views",
        deleted);
    return deleted;
  }

  /** Deletes the given data products' rollup edges to themselves and returns how many it deleted. */
  public static int delete(final Handle handle, final List<String> dataProductIds) {
    final List<String> looped = rollupSelfLoops(handle, dataProductIds);
    if (!looped.isEmpty()) {
      handle
          .createUpdate("DELETE " + SELF_LOOPS)
          .bindList("ids", looped)
          .bind("dataProduct", DATA_PRODUCT)
          .bind("upstream", UPSTREAM)
          .execute();
    }
    return looped.size();
  }

  private static List<String> rollupSelfLoops(
      final Handle handle, final List<String> dataProductIds) {
    return handle
        .createQuery("SELECT toId, json " + SELF_LOOPS)
        .bindList("ids", dataProductIds)
        .bind("dataProduct", DATA_PRODUCT)
        .bind("upstream", UPSTREAM)
        .map((rs, ctx) -> new StoredEdge(rs.getString(1), rs.getString(2)))
        .list()
        .stream()
        .filter(StoredEdge::isRollup)
        .map(StoredEdge::dataProductId)
        .toList();
  }

  private record StoredEdge(String dataProductId, String json) {
    boolean isRollup() {
      final JsonNode details = json == null ? null : JsonUtils.readTree(json);
      return details != null && ROLLUP_SOURCE.equals(details.path(SOURCE_FIELD).asText());
    }
  }
}
