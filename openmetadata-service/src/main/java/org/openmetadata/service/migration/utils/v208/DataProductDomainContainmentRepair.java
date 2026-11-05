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

package org.openmetadata.service.migration.utils.v208;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toSet;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.migration.utils.IdBatches;

/**
 * A data product stores its domains twice: domain HAS dataProduct, which the API reads, and domain
 * CONTAINS dataProduct, which the "Data Product Domain Validation" rule reads. Before 1.12.12 and
 * 1.13.1, a domain change rewrote only HAS, so a data product moved on those versions still
 * contains its old domain. On 2.0 the rule then rejects every edit to the product's assets, which
 * sit in the new domain. This rewrites CONTAINS to match HAS.
 */
@Slf4j
public final class DataProductDomainContainmentRepair {

  public static final String STEP_NAME = "repairDataProductDomainContainment";

  private static final String DATA_PRODUCT_TABLE = "data_product_entity";
  private static final int CONTAINS = Relationship.CONTAINS.ordinal();
  private static final int HAS = Relationship.HAS.ordinal();

  private DataProductDomainContainmentRepair() {}

  public static void repairAll(final Handle handle, final CollectionDAO collectionDAO) {
    final int repaired =
        IdBatches.fold(
            handle,
            DATA_PRODUCT_TABLE,
            0,
            (count, batch) -> count + repair(collectionDAO.relationshipDAO(), batch));
    LOG.info("Repaired domain containment of {} data products", repaired);
  }

  /** Repairs the given data products and returns how many needed it. */
  public static int repair(
      final EntityRelationshipDAO relationshipDAO, final List<String> dataProductIds) {
    final List<DomainLinks> drifted =
        loadLinks(relationshipDAO, dataProductIds).stream().filter(DomainLinks::isDrifted).toList();
    drifted.forEach(links -> rewriteContainment(relationshipDAO, links));
    return drifted.size();
  }

  private static List<DomainLinks> loadLinks(
      final EntityRelationshipDAO relationshipDAO, final List<String> dataProductIds) {
    final List<EntityRelationshipObject> live =
        relationshipDAO.findFromBatchWithRelations(
            dataProductIds, DATA_PRODUCT, List.of(CONTAINS, HAS), Include.NON_DELETED);
    final List<EntityRelationshipObject> anyContainment =
        relationshipDAO.findFromBatchWithRelations(
            dataProductIds, DATA_PRODUCT, List.of(CONTAINS), Include.ALL);
    return DomainLinks.of(live, anyContainment);
  }

  // Each statement commits on its own, so the missing link is written before the stale one goes:
  // an interrupted run leaves the product in both domains, which the rule accepts, not in neither.
  private static void rewriteContainment(
      final EntityRelationshipDAO relationshipDAO, final DomainLinks links) {
    for (final UUID domainId : links.missingContainment()) {
      // insert() upserts json only; dropping the row first revives a soft-deleted one.
      relationshipDAO.delete(domainId, DOMAIN, links.dataProductId(), DATA_PRODUCT, CONTAINS);
      relationshipDAO.insert(domainId, links.dataProductId(), DOMAIN, DATA_PRODUCT, CONTAINS);
    }
    for (final UUID domainId : links.staleContainment()) {
      relationshipDAO.delete(domainId, DOMAIN, links.dataProductId(), DATA_PRODUCT, CONTAINS);
    }
    LOG.warn(
        "Data product {} contained domains {} but belongs to {}; containment rewritten",
        links.dataProductId(),
        links.liveContainment(),
        links.shown());
  }

  /**
   * One data product's domain links. {@code shown} is the live HAS set, {@code liveContainment}
   * the live CONTAINS set and {@code anyContainment} every CONTAINS row, soft-deleted ones too.
   */
  record DomainLinks(
      UUID dataProductId, Set<UUID> shown, Set<UUID> liveContainment, Set<UUID> anyContainment) {

    /** A product with no HAS row has nothing to repair from, so it is left alone. */
    boolean isDrifted() {
      return !shown.isEmpty() && !shown.equals(liveContainment);
    }

    Set<UUID> missingContainment() {
      return difference(shown, liveContainment);
    }

    Set<UUID> staleContainment() {
      return difference(anyContainment, shown);
    }

    static List<DomainLinks> of(
        final List<EntityRelationshipObject> live,
        final List<EntityRelationshipObject> anyContainment) {
      final Map<UUID, Set<UUID>> shown = domainsByProduct(live, HAS);
      final Map<UUID, Set<UUID>> liveContainment = domainsByProduct(live, CONTAINS);
      final Map<UUID, Set<UUID>> containment = domainsByProduct(anyContainment, CONTAINS);
      final Set<UUID> products = new HashSet<>(shown.keySet());
      products.addAll(containment.keySet());
      return products.stream()
          .map(
              id ->
                  new DomainLinks(
                      id,
                      shown.getOrDefault(id, Set.of()),
                      liveContainment.getOrDefault(id, Set.of()),
                      containment.getOrDefault(id, Set.of())))
          .toList();
    }

    private static Map<UUID, Set<UUID>> domainsByProduct(
        final List<EntityRelationshipObject> rows, final int relation) {
      return rows.stream()
          .filter(row -> row.getRelation() == relation && DOMAIN.equals(row.getFromEntity()))
          .collect(
              groupingBy(
                  row -> UUID.fromString(row.getToId()),
                  mapping(row -> UUID.fromString(row.getFromId()), toSet())));
    }

    private static Set<UUID> difference(final Set<UUID> from, final Set<UUID> without) {
      final Set<UUID> result = new HashSet<>(from);
      result.removeAll(without);
      return Set.copyOf(result);
    }
  }
}
