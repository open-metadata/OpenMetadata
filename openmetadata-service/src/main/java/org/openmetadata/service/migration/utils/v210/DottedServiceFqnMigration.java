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

import static org.openmetadata.service.Entity.CHART;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.DASHBOARD_SERVICE;
import static org.openmetadata.service.Entity.MESSAGING_SERVICE;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.MLMODEL_SERVICE;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.PIPELINE_SERVICE;
import static org.openmetadata.service.Entity.TOPIC;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Repairs the stored FQN and fqnHash of Dashboard, Chart, Pipeline, Topic and MlModel entities that
 * were created under a service whose name contains a dot (e.g. {@code my.service}) before OM 1.1.0.
 *
 * <p>Those repositories historically built the child FQN with {@code getService().getName()} instead
 * of {@code getService().getFullyQualifiedName()} (fixed for the code in {@code 9dbaabad44}, PR
 * #11960, Jun 2023). {@link FullyQualifiedName#add(String, String)} does not re-quote its first
 * argument, so a dotted service name produced {@code my.service.child} (3 segments) instead of the
 * canonical {@code "my.service".child} (2 segments). Since fqnHash is a per-segment hash, the stored
 * hash never matches the canonical lookup key, leaving the row unreachable and duplicated on
 * re-ingestion.
 *
 * <p>The v1.11.2 / v1.12.0 repair ({@code utils/v1120/MigrationUtil}) covered Database, Schema,
 * Table, StoredProcedure, DashboardDataModel and APICollection/APIEndpoint, but omitted these five
 * sibling types. Because a native migration only re-runs for the current and previous release train,
 * re-homing the repair into v210 is what lets already-upgraded (1.13 / 2.0 / 2.1) instances heal.
 * The corruption is written in the Java repository layer, so it is identical on MySQL and PostgreSQL;
 * both {@code mysql/v210} and {@code postgres/v210} invoke this pass.
 */
@Slf4j
public final class DottedServiceFqnMigration {

  private DottedServiceFqnMigration() {}

  // Cap how many child entities are materialized at once. findEntitiesByIds chunks the SQL IN-list
  // internally, so this only bounds in-memory rows per unit (kept large to avoid extra round
  // trips).
  private static final int BATCH_SIZE = 1000;

  private enum RepairOutcome {
    FIXED,
    UNCHANGED,
    DUPLICATE_BLOCKED,
    FAILED
  }

  /** Per-hierarchy accumulator: rows healed, and rows left for manual merge. */
  private static final class RepairTally {
    private int fixed;
    private final List<UUID> blocked = new ArrayList<>();
  }

  /**
   * A direct service -> child hierarchy whose child FQNs may need repair. The DAOs are resolved
   * lazily so nothing on {@code collectionDAO} is touched for a hierarchy with no dotted services.
   */
  private record ServiceChildHierarchy(
      String serviceTable,
      String serviceType,
      String childType,
      Function<CollectionDAO, EntityDAO<?>> serviceDao,
      Function<CollectionDAO, EntityDAO<?>> childDao) {}

  private static final List<ServiceChildHierarchy> HIERARCHIES =
      List.of(
          new ServiceChildHierarchy(
              "dashboard_service_entity",
              DASHBOARD_SERVICE,
              DASHBOARD,
              CollectionDAO::dashboardServiceDAO,
              CollectionDAO::dashboardDAO),
          new ServiceChildHierarchy(
              "dashboard_service_entity",
              DASHBOARD_SERVICE,
              CHART,
              CollectionDAO::dashboardServiceDAO,
              CollectionDAO::chartDAO),
          new ServiceChildHierarchy(
              "pipeline_service_entity",
              PIPELINE_SERVICE,
              PIPELINE,
              CollectionDAO::pipelineServiceDAO,
              CollectionDAO::pipelineDAO),
          new ServiceChildHierarchy(
              "messaging_service_entity",
              MESSAGING_SERVICE,
              TOPIC,
              CollectionDAO::messagingServiceDAO,
              CollectionDAO::topicDAO),
          new ServiceChildHierarchy(
              "mlmodel_service_entity",
              MLMODEL_SERVICE,
              MLMODEL,
              CollectionDAO::mlModelServiceDAO,
              CollectionDAO::mlModelDAO));

  public static void repairDottedServiceChildFqns(Handle handle, CollectionDAO collectionDAO) {
    for (ServiceChildHierarchy hierarchy : HIERARCHIES) {
      repairHierarchy(handle, collectionDAO, hierarchy);
    }
  }

  private static void repairHierarchy(
      Handle handle, CollectionDAO collectionDAO, ServiceChildHierarchy hierarchy) {
    Set<UUID> serviceIds = findServicesWithDotsInName(handle, hierarchy.serviceTable());
    if (serviceIds.isEmpty()) {
      return;
    }
    RepairTally tally = new RepairTally();
    for (UUID serviceId : serviceIds) {
      repairServiceChildren(collectionDAO, hierarchy, serviceId, tally);
    }
    if (tally.fixed > 0) {
      LOG.info(
          "Repaired {} {} FQNs under dotted-name services", tally.fixed, hierarchy.childType());
    }
    if (!tally.blocked.isEmpty()) {
      // Surfaced at WARN (not swallowed) so an operator can merge the duplicates by hand.
      LOG.warn(
          "{} {} rows under dotted-name services were left unhealed because a canonical row already "
              + "exists at the target FQN (re-ingestion duplicate); merge manually: {}",
          tally.blocked.size(),
          hierarchy.childType(),
          tally.blocked);
    }
  }

  private static void repairServiceChildren(
      CollectionDAO collectionDAO,
      ServiceChildHierarchy hierarchy,
      UUID serviceId,
      RepairTally tally) {
    try {
      // Include.ALL so a soft-deleted service still has its (also soft-deleted) children repaired.
      EntityInterface service =
          hierarchy.serviceDao().apply(collectionDAO).findEntityById(serviceId, Include.ALL);
      String serviceFqn = service == null ? null : service.getFullyQualifiedName();
      // Only a quoted service FQN could have produced the unquoted-dotted corruption.
      if (serviceFqn == null || !serviceFqn.contains("\"")) {
        return;
      }
      EntityDAO<?> childDao = hierarchy.childDao().apply(collectionDAO);
      List<UUID> childIds =
          new ArrayList<>(
              findChildEntityIds(
                  collectionDAO, serviceId, hierarchy.serviceType(), hierarchy.childType()));
      // Process in bounded batches: one batched read per chunk, at most BATCH_SIZE rows in memory.
      for (int start = 0; start < childIds.size(); start += BATCH_SIZE) {
        List<UUID> batch = childIds.subList(start, Math.min(start + BATCH_SIZE, childIds.size()));
        repairChildBatch(childDao, hierarchy.childType(), serviceFqn, batch, tally);
      }
    } catch (Exception e) {
      LOG.warn(
          "Error repairing {} under service {}: {}",
          hierarchy.childType(),
          serviceId,
          e.getMessage());
    }
  }

  private static void repairChildBatch(
      EntityDAO<?> childDao,
      String childType,
      String serviceFqn,
      List<UUID> childIds,
      RepairTally tally) {
    // Include.ALL so soft-deleted children (still linked to the service) are repaired too; a later
    // restore would otherwise keep the invalid FQN/hash and duplicate on re-ingestion.
    List<? extends EntityInterface> children = childDao.findEntitiesByIds(childIds, Include.ALL);
    for (EntityInterface child : children) {
      recordOutcome(tally, child.getId(), repairChild(childDao, childType, serviceFqn, child));
    }
  }

  private static void recordOutcome(RepairTally tally, UUID childId, RepairOutcome outcome) {
    if (outcome == RepairOutcome.FIXED) {
      tally.fixed++;
    } else if (outcome == RepairOutcome.DUPLICATE_BLOCKED) {
      tally.blocked.add(childId);
    }
  }

  private static RepairOutcome repairChild(
      EntityDAO<?> childDao, String childType, String serviceFqn, EntityInterface child) {
    try {
      String expectedFqn = FullyQualifiedName.add(serviceFqn, child.getName());
      if (expectedFqn.equals(child.getFullyQualifiedName())) {
        return RepairOutcome.UNCHANGED;
      }
      // A prior re-ingestion may already hold a canonical row at the target FQN. Rewriting this
      // row's fqnHash to match would violate the fqnHash UNIQUE constraint, so leave it for a
      // manual merge (e.g. two dashboards, one per FQN form) rather than swallowing the failure.
      if (childDao.existsByName(
          childDao.getTableName(), childDao.getNameHashColumn(), expectedFqn)) {
        return RepairOutcome.DUPLICATE_BLOCKED;
      }
      LOG.debug("Fixing {} FQN: {} -> {}", childType, child.getFullyQualifiedName(), expectedFqn);
      child.setFullyQualifiedName(expectedFqn);
      // update(EntityInterface) rewrites both the FQN in the JSON and the @BindFQN-hashed fqnHash.
      childDao.update(child);
      return RepairOutcome.FIXED;
    } catch (Exception e) {
      LOG.warn("Error repairing {} entity {}: {}", childType, child.getId(), e.getMessage());
      return RepairOutcome.FAILED;
    }
  }

  private static Set<UUID> findServicesWithDotsInName(Handle handle, String serviceTable) {
    Set<UUID> serviceIds = new HashSet<>();
    String query = String.format("SELECT id FROM %s WHERE name LIKE '%%.%%'", serviceTable);
    try {
      List<Map<String, Object>> rows = handle.createQuery(query).mapToMap().list();
      for (Map<String, Object> row : rows) {
        Object idObj = row.get("id");
        if (idObj != null) {
          serviceIds.add(UUID.fromString(idObj.toString()));
        }
      }
    } catch (Exception e) {
      LOG.warn(
          "Error finding services with dots in name from {}: {}", serviceTable, e.getMessage());
    }
    return serviceIds;
  }

  private static Set<UUID> findChildEntityIds(
      CollectionDAO collectionDAO, UUID serviceId, String fromType, String toType) {
    Set<UUID> childIds = new HashSet<>();
    List<CollectionDAO.EntityRelationshipRecord> records =
        collectionDAO
            .relationshipDAO()
            .findTo(serviceId, fromType, Relationship.CONTAINS.ordinal(), toType);
    for (CollectionDAO.EntityRelationshipRecord record : records) {
      childIds.add(record.getId());
    }
    return childIds;
  }
}
