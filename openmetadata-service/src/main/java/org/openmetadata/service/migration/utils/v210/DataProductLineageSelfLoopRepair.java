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

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.service.Entity.DATA_PRODUCT;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.migration.utils.IdBatches;

/**
 * Deletes the lineage edges from a data product to itself. Data product lineage was recounted for
 * every pair of products on an asset's lineage edges, the asset's own product included, so an edge
 * between two assets of one product wrote one, and the lineage views showed the product feeding
 * itself. Only the rollup's own rows ({@code ChildAssets}) are deleted. The data product
 * search documents keep a deleted edge until they are reindexed, which the step logs.
 */
@Slf4j
public final class DataProductLineageSelfLoopRepair {

  public static final String STEP_NAME = "deleteDataProductLineageSelfLoops";

  private static final String DATA_PRODUCT_TABLE = "data_product_entity";
  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();

  private DataProductLineageSelfLoopRepair() {}

  public static int deleteAll(final Handle handle, final CollectionDAO collectionDAO) {
    final int deleted =
        IdBatches.fold(
            handle,
            DATA_PRODUCT_TABLE,
            0,
            (count, batch) -> count + delete(collectionDAO.relationshipDAO(), batch));
    LOG.info(
        "Deleted {} data product lineage edges to the product itself; reindex dataProduct to drop"
            + " them from the lineage views",
        deleted);
    return deleted;
  }

  /** Deletes the given data products' rollup edges to themselves and returns how many it deleted. */
  public static int delete(
      final EntityRelationshipDAO relationshipDAO, final List<String> dataProductIds) {
    final List<EntityRelationshipObject> selfLoops =
        relationshipDAO
            .findFromBatchWithRelations(
                dataProductIds, DATA_PRODUCT, List.of(UPSTREAM), Include.ALL)
            .stream()
            .filter(DataProductLineageSelfLoopRepair::isRollupSelfLoop)
            .toList();
    for (final EntityRelationshipObject selfLoop : selfLoops) {
      final UUID dataProductId = UUID.fromString(selfLoop.getToId());
      relationshipDAO.delete(dataProductId, DATA_PRODUCT, dataProductId, DATA_PRODUCT, UPSTREAM);
    }
    return selfLoops.size();
  }

  private static boolean isRollupSelfLoop(final EntityRelationshipObject edge) {
    final LineageDetails details = JsonUtils.readValue(edge.getJson(), LineageDetails.class);
    return edge.getFromId().equals(edge.getToId())
        && details != null
        && details.getSource() == LineageDetails.Source.CHILD_ASSETS;
  }
}
