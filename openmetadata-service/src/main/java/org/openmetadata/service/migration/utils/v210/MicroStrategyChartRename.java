/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.CHART;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.DASHBOARD_SERVICE;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Renames MicroStrategy charts from {@code <pageKey><vizKey>} to {@code
 * <dossierId>_<pageKey><vizKey>}.
 *
 * <p>Page and visualization keys repeat across dossiers, so the connector used to write the charts
 * of different dossiers into one entity. A dashboard is named by its dossier id, so each linked
 * chart can be renamed in place: the chart keeps its id, and with it everything users added. A
 * chart linked to several dashboards is renamed for the one whose id sorts first and copied, with
 * the user-added metadata, for each of the others.
 *
 * <p>It runs after the 2.1.0 conversation and custom property migrations, whose tables the chart
 * repository reads. Idempotent: a chart already named after its dashboard is left alone. A failure
 * is logged and skipped per chart; the upgrade must not fail over metadata the next ingestion run
 * can still recreate.
 * ADR:2026-11-05-microstrategy-charts-are-named-by-dossier-and-the-search-is-paged
 */
@Slf4j
public final class MicroStrategyChartRename {
  public static final String STEP_NAME = "renameMicroStrategyChartsByDossier";
  private static final String SERVICE_TYPE = "MicroStrategy";
  private static final String COPIED_FIELDS =
      "owners,followers,tags,domains,dataProducts,extension";

  private MicroStrategyChartRename() {}

  /** Charts renamed or copied, so a test can assert a second run changes nothing. */
  public static int renameAll(final Handle handle, final CollectionDAO collectionDAO) {
    int changed = 0;
    for (UUID serviceId : microStrategyServices(handle)) {
      changed += renameService(collectionDAO, serviceId);
    }
    if (changed > 0) {
      LOG.info("Renamed or copied {} MicroStrategy charts by dossier", changed);
    }
    return changed;
  }

  private static List<UUID> microStrategyServices(final Handle handle) {
    return handle
        .createQuery("SELECT id FROM dashboard_service_entity WHERE serviceType = :serviceType")
        .bind("serviceType", SERVICE_TYPE)
        .mapTo(String.class)
        .list()
        .stream()
        .map(UUID::fromString)
        .toList();
  }

  private static int renameService(final CollectionDAO collectionDAO, final UUID serviceId) {
    int changed = 0;
    try {
      DashboardService service =
          collectionDAO.dashboardServiceDAO().findEntityById(serviceId, Include.ALL);
      for (CollectionDAO.EntityRelationshipRecord record :
          collectionDAO
              .relationshipDAO()
              .findTo(serviceId, DASHBOARD_SERVICE, Relationship.CONTAINS.ordinal(), CHART)) {
        changed += renameChart(collectionDAO, service, record.getId());
      }
    } catch (Exception e) {
      LOG.warn("Could not rename the charts of MicroStrategy service {}", serviceId, e);
    }
    return changed;
  }

  private static int renameChart(
      final CollectionDAO collectionDAO, final DashboardService service, final UUID chartId) {
    int changed = 0;
    try {
      Chart chart = collectionDAO.chartDAO().findEntityById(chartId, Include.ALL);
      List<Dashboard> dashboards = linkedDashboards(collectionDAO, chartId);
      boolean legacy =
          !dashboards.isEmpty()
              && dashboards.stream().noneMatch(d -> chart.getName().startsWith(prefix(d)));
      if (legacy) {
        changed += copyForOtherDashboards(collectionDAO, service, chart, dashboards);
        changed += renameInPlace(collectionDAO, service, chart, dashboards.getFirst());
      }
    } catch (Exception e) {
      LOG.warn("Could not rename MicroStrategy chart {}", chartId, e);
    }
    return changed;
  }

  /** Sorted by id text, so the dashboard that keeps the original chart is the same on every run. */
  private static List<Dashboard> linkedDashboards(
      final CollectionDAO collectionDAO, final UUID chartId) {
    List<UUID> ids =
        collectionDAO
            .relationshipDAO()
            .findFrom(chartId, CHART, Relationship.HAS.ordinal(), DASHBOARD)
            .stream()
            .map(CollectionDAO.EntityRelationshipRecord::getId)
            .toList();
    if (ids.isEmpty()) {
      return List.of();
    }
    List<Dashboard> dashboards =
        new ArrayList<>(collectionDAO.dashboardDAO().findEntitiesByIds(ids, Include.ALL));
    dashboards.sort(Comparator.comparing(dashboard -> dashboard.getId().toString()));
    return dashboards;
  }

  private static int copyForOtherDashboards(
      final CollectionDAO collectionDAO,
      final DashboardService service,
      final Chart chart,
      final List<Dashboard> dashboards) {
    if (dashboards.size() < 2) {
      return 0;
    }
    EntityRepository<Chart> repository =
        (EntityRepository<Chart>) Entity.<Chart>getEntityRepository(CHART);
    Chart source =
        repository.get(
            null, chart.getId(), repository.getFields(COPIED_FIELDS), Include.ALL, false);
    int copied = 0;
    for (Dashboard dashboard : dashboards.subList(1, dashboards.size())) {
      if (copyFor(collectionDAO, repository, service, source, dashboard)) {
        copied++;
      }
    }
    return copied;
  }

  private static boolean copyFor(
      final CollectionDAO collectionDAO,
      final EntityRepository<Chart> repository,
      final DashboardService service,
      final Chart source,
      final Dashboard dashboard) {
    boolean copied = false;
    String name = prefix(dashboard) + source.getName();
    try {
      if (!exists(collectionDAO, service, name)) {
        Chart copy = repository.createInternal(copyOf(service, source, dashboard, name));
        followAsBefore(collectionDAO, source, copy);
        copied = true;
      }
      // The dashboard now links its own chart, or the one a newer ingestion run already created.
      collectionDAO
          .relationshipDAO()
          .delete(dashboard.getId(), DASHBOARD, source.getId(), CHART, Relationship.HAS.ordinal());
      EntityRepository.invalidateCacheForEntity(
          DASHBOARD, dashboard.getId(), dashboard.getFullyQualifiedName());
      reindex(dashboard.getEntityReference());
    } catch (Exception e) {
      LOG.warn(
          "Could not copy MicroStrategy chart {} for dashboard {}; the next ingestion run "
              + "recreates it without the user-added metadata",
          source.getFullyQualifiedName(),
          dashboard.getFullyQualifiedName(),
          e);
    }
    return copied;
  }

  private static Chart copyOf(
      final DashboardService service,
      final Chart source,
      final Dashboard dashboard,
      final String name) {
    return new Chart()
        .withId(UUID.randomUUID())
        .withName(name)
        .withDisplayName(source.getDisplayName())
        .withDescription(source.getDescription())
        .withChartType(source.getChartType())
        .withSourceUrl(source.getSourceUrl())
        .withService(service.getEntityReference())
        .withDashboards(List.of(dashboard.getEntityReference()))
        .withTags(source.getTags())
        .withOwners(ownOnly(source.getOwners()))
        .withDomains(ownOnly(source.getDomains()))
        .withDataProducts(source.getDataProducts())
        .withExtension(source.getExtension())
        .withLifeCycle(source.getLifeCycle())
        .withUpdatedBy(ADMIN_USER_NAME)
        .withUpdatedAt(System.currentTimeMillis());
  }

  private static void followAsBefore(
      final CollectionDAO collectionDAO, final Chart source, final Chart copy) {
    for (EntityReference follower : listOrEmpty(source.getFollowers())) {
      collectionDAO
          .relationshipDAO()
          .insert(
              follower.getId(), copy.getId(), Entity.USER, CHART, Relationship.FOLLOWS.ordinal());
    }
  }

  private static int renameInPlace(
      final CollectionDAO collectionDAO,
      final DashboardService service,
      final Chart chart,
      final Dashboard dashboard) {
    String name = prefix(dashboard) + chart.getName();
    if (exists(collectionDAO, service, name)) {
      // A newer ingestion run already created the chart under its new name; merging two charts
      // is not this migration's call, and the next run marks the old one stale.
      LOG.warn(
          "MicroStrategy chart {} not renamed: {} already exists",
          chart.getFullyQualifiedName(),
          name);
      return 0;
    }
    String oldFqn = chart.getFullyQualifiedName();
    chart.setName(name);
    chart.setFullyQualifiedName(FullyQualifiedName.add(service.getFullyQualifiedName(), name));
    // runOnce records the step even when a chart fails, so a chart is renamed with its tags and
    // threads in one transaction or not at all.
    Entity.getJdbi()
        .useTransaction(handle -> rename(handle.attach(CollectionDAO.class), chart, oldFqn));
    EntityRepository.invalidateCacheForEntity(CHART, chart.getId(), oldFqn);
    EntityRepository.invalidateCacheForEntity(
        DASHBOARD, dashboard.getId(), dashboard.getFullyQualifiedName());
    reindex(chart.getEntityReference());
    reindex(dashboard.getEntityReference());
    return 1;
  }

  private static void rename(final CollectionDAO dao, final Chart chart, final String oldFqn) {
    String newFqn = chart.getFullyQualifiedName();
    dao.tagUsageDAO().updateTargetFQNHash(oldFqn, newFqn);
    dao.fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);
    dao.conversationDAO()
        .updateEntityReference(
            CHART,
            chart.getId().toString(),
            oldFqn,
            newFqn,
            FullyQualifiedName.buildHash(newFqn),
            JsonUtils.pojoToJson(chart.getEntityReference()));
    dao.chartDAO().update(chart);
  }

  private static boolean exists(
      final CollectionDAO collectionDAO, final DashboardService service, final String name) {
    var chartDAO = collectionDAO.chartDAO();
    return chartDAO.existsByName(
        chartDAO.getTableName(),
        chartDAO.getNameHashColumn(),
        FullyQualifiedName.add(service.getFullyQualifiedName(), name));
  }

  private static String prefix(final Dashboard dashboard) {
    return dashboard.getName() + "_";
  }

  /** The search index is rebuilt by a reindex too, so an unreachable search must not fail this. */
  private static void reindex(final EntityReference reference) {
    try {
      Entity.getSearchRepository().updateEntity(reference);
    } catch (Exception e) {
      LOG.warn(
          "Could not reindex {} {}; run a reindex after the upgrade",
          reference.getType(),
          reference.getFullyQualifiedName(),
          e);
    }
  }

  /** Inherited owners and domains come from the service or dashboard, not from the chart. */
  private static List<EntityReference> ownOnly(final List<EntityReference> references) {
    return listOrEmpty(references).stream()
        .filter(reference -> !Boolean.TRUE.equals(reference.getInherited()))
        .toList();
  }
}
