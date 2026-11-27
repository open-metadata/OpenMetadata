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

package org.openmetadata.service.migration.utils.v212;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.IdBatches;

/**
 * Recounts every data product lineage rollup from the asset edges it stands for. Released versions
 * wrote an edge from a product to itself, lost counts on session-consolidated edits and never
 * followed CSV imports. A rollup row ({@code ChildAssets}) gets its count, is inserted when missing
 * and is deleted when no asset edge connects the products. An edge drawn between the products keeps
 * its details and only carries the count
 * (ADR:2026-11-26-data-product-lineage-rollups-move-by-exact-deltas-and-drawn-edges-stay). The
 * lineage views read search, which the reindex command rebuilds.
 */
@Slf4j
public final class DataProductLineageRebuild {

  public static final String STEP_NAME = "rebuildDataProductLineage";

  private static final String DATA_PRODUCT = "dataProduct";
  private static final String DATA_PRODUCT_TABLE = "data_product_entity";
  private static final String SOURCE = "source";
  private static final String ASSET_EDGES = "assetEdges";
  private static final String CREATED_AT = "createdAt";
  private static final String UPDATED_AT = "updatedAt";
  private static final String CREATED_BY = "createdBy";
  private static final String UPDATED_BY = "updatedBy";
  private static final String ROLLUP_SOURCE = "ChildAssets";
  private static final String ROLLUP_AUTHOR = "admin";
  private static final int HAS = Relationship.HAS.ordinal();
  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();

  // Asset edges between the assets of a product in the batch and the assets of another product.
  private static final String COUNTS =
      "SELECT src.fromId, dst.fromId, COUNT(*) FROM entity_relationship src"
          + " JOIN entity_relationship lin ON lin.fromId = src.toId AND lin.relation = :upstream"
          + " JOIN entity_relationship dst ON dst.toId = lin.toId AND dst.relation = :has"
          + " AND dst.fromEntity = :dataProduct"
          + " WHERE src.fromId IN (<ids>) AND src.fromEntity = :dataProduct AND src.relation = :has"
          + " AND dst.fromId <> src.fromId"
          + " GROUP BY src.fromId, dst.fromId";
  private static final String STORED =
      "SELECT fromId, toId, json FROM entity_relationship WHERE fromId IN (<ids>)"
          + " AND fromEntity = :dataProduct AND toEntity = :dataProduct AND relation = :upstream"
          + " AND relationType = ''";
  private static final String INSERT_MYSQL =
      "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType,"
          + " json) VALUES (:fromId, :toId, :dataProduct, :dataProduct, :upstream, '', :json)";
  private static final String INSERT_POSTGRES =
      "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType,"
          + " json) VALUES (:fromId, :toId, :dataProduct, :dataProduct, :upstream, '',"
          + " CAST(:json AS jsonb))";
  private static final String EDGE =
      " WHERE fromId = :fromId AND toId = :toId AND relation = :upstream AND relationType = ''";
  private static final String UPDATE_MYSQL = "UPDATE entity_relationship SET json = :json" + EDGE;
  private static final String UPDATE_POSTGRES =
      "UPDATE entity_relationship SET json = CAST(:json AS jsonb)" + EDGE;
  private static final String DELETE = "DELETE FROM entity_relationship" + EDGE;

  private DataProductLineageRebuild() {}

  public static int rebuildAll(final Handle handle, final ConnectionType connectionType) {
    final int changed =
        IdBatches.fold(
            handle,
            DATA_PRODUCT_TABLE,
            0,
            (total, batch) -> total + rebuild(handle, connectionType, batch));
    LOG.info(
        "Rebuilt data product lineage: {} rollups changed. Run `./bootstrap/openmetadata-ops.sh"
            + " reindex --entities=dataProduct` so the lineage views read them.",
        changed);
    return changed;
  }

  /** Rebuilds the rollups from the given data products and returns how many rows it changed. */
  public static int rebuild(
      final Handle handle, final ConnectionType connectionType, final List<String> fromIds) {
    final Map<ProductPair, Integer> counts = counts(handle, fromIds);
    final Map<ProductPair, JsonNode> stored = stored(handle, fromIds);
    final Set<ProductPair> pairs = new HashSet<>(stored.keySet());
    pairs.addAll(counts.keySet());
    int changed = 0;
    for (final ProductPair pair : pairs) {
      final boolean rowChanged =
          stored.containsKey(pair)
              ? reconcileStored(handle, connectionType, pair, stored.get(pair), counts)
              : insertCounted(handle, connectionType, pair, counts.getOrDefault(pair, 0));
      changed += rowChanged ? 1 : 0;
    }
    return changed;
  }

  private static Map<ProductPair, Integer> counts(final Handle handle, final List<String> ids) {
    final Map<ProductPair, Integer> counts = new HashMap<>();
    handle
        .createQuery(COUNTS)
        .bindList("ids", ids)
        .bind("dataProduct", DATA_PRODUCT)
        .bind("has", HAS)
        .bind("upstream", UPSTREAM)
        .map(
            (rs, ctx) -> Map.entry(new ProductPair(rs.getString(1), rs.getString(2)), rs.getInt(3)))
        .forEach(count -> counts.put(count.getKey(), count.getValue()));
    return counts;
  }

  private static Map<ProductPair, JsonNode> stored(final Handle handle, final List<String> ids) {
    final Map<ProductPair, JsonNode> stored = new HashMap<>();
    handle
        .createQuery(STORED)
        .bindList("ids", ids)
        .bind("dataProduct", DATA_PRODUCT)
        .bind("upstream", UPSTREAM)
        .map(
            (rs, ctx) ->
                Map.entry(
                    new ProductPair(rs.getString(1), rs.getString(2)), details(rs.getString(3))))
        .forEach(row -> stored.put(row.getKey(), row.getValue()));
    return stored;
  }

  private static JsonNode details(final String json) {
    return json == null ? NullNode.getInstance() : JsonUtils.readTree(json);
  }

  private static boolean insertCounted(
      final Handle handle,
      final ConnectionType connectionType,
      final ProductPair pair,
      final int count) {
    final boolean counted = count > 0;
    if (counted) {
      write(
              handle.createUpdate(
                  connectionType == ConnectionType.MYSQL ? INSERT_MYSQL : INSERT_POSTGRES),
              pair,
              newRollup(count))
          .bind("dataProduct", DATA_PRODUCT)
          .execute();
    }
    return counted;
  }

  // A row this rollup wrote is fixed outright; a drawn edge only carries the count. A row whose
  // details are not an object is left as it is.
  private static boolean reconcileStored(
      final Handle handle,
      final ConnectionType connectionType,
      final ProductPair pair,
      final JsonNode stored,
      final Map<ProductPair, Integer> counts) {
    final int count = pair.isSelf() ? 0 : counts.getOrDefault(pair, 0);
    final boolean rollup = ROLLUP_SOURCE.equals(stored.path(SOURCE).asText());
    final Integer target = count > 0 ? count : null;
    final boolean delete = stored.isObject() && rollup && target == null;
    final boolean recount =
        stored.isObject() && !delete && !Objects.equals(assetEdges(stored), target);
    if (delete) {
      bind(handle.createUpdate(DELETE), pair).execute();
    } else if (recount) {
      final ObjectNode details = ((ObjectNode) stored).deepCopy();
      if (target == null) {
        details.remove(ASSET_EDGES);
      } else {
        details.put(ASSET_EDGES, target);
      }
      write(
              handle.createUpdate(
                  connectionType == ConnectionType.MYSQL ? UPDATE_MYSQL : UPDATE_POSTGRES),
              pair,
              details)
          .execute();
    }
    return delete || recount;
  }

  private static Integer assetEdges(final JsonNode details) {
    final JsonNode assetEdges = details.get(ASSET_EDGES);
    return assetEdges == null || assetEdges.isNull() ? null : assetEdges.asInt();
  }

  private static ObjectNode newRollup(final int count) {
    final long now = System.currentTimeMillis();
    final ObjectNode details = JsonNodeFactory.instance.objectNode();
    details.put(CREATED_AT, now);
    details.put(UPDATED_AT, now);
    details.put(CREATED_BY, ROLLUP_AUTHOR);
    details.put(UPDATED_BY, ROLLUP_AUTHOR);
    details.put(SOURCE, ROLLUP_SOURCE);
    details.put(ASSET_EDGES, count);
    return details;
  }

  private static Update write(
      final Update update, final ProductPair pair, final ObjectNode details) {
    return bind(update, pair).bind("json", details.toString());
  }

  private static Update bind(final Update update, final ProductPair pair) {
    return update
        .bind("fromId", pair.fromId())
        .bind("toId", pair.toId())
        .bind("upstream", UPSTREAM);
  }

  private record ProductPair(String fromId, String toId) {
    boolean isSelf() {
      return fromId.equals(toId);
    }
  }
}
