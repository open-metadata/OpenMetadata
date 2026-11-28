package org.openmetadata.service.lineage;

import static org.openmetadata.service.Entity.CHART;
import static org.openmetadata.service.Entity.DASHBOARD;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.api.lineage.DashboardChartLineageBatchRequest;
import org.openmetadata.schema.api.lineage.DashboardChartLineageBatchResponse;
import org.openmetadata.schema.api.lineage.DashboardChartLineageBatchResult;
import org.openmetadata.schema.api.lineage.DashboardChartLineageBatchResult.ErrorCode;
import org.openmetadata.schema.api.lineage.DashboardChartLineageBatchResult.Status;
import org.openmetadata.schema.api.lineage.DashboardChartLineagePair;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.security.AuthorizationException;

@Slf4j
public final class DashboardChartLineageBatchService {
  private final LineageRepository lineage;
  private final BiFunction<String, UUID, EntityReference> resolveEndpoint;

  public DashboardChartLineageBatchService(
      LineageRepository lineage, BiFunction<String, UUID, EntityReference> resolveEndpoint) {
    this.lineage = lineage;
    this.resolveEndpoint = resolveEndpoint;
  }

  public DashboardChartLineageBatchResponse write(
      DashboardChartLineageBatchRequest request,
      String updatedBy,
      BiConsumer<EntityReference, MetadataOperation> authorize) {
    List<DashboardChartLineagePair> pairs = request.getPairs();
    if (pairs.stream().anyMatch(Objects::isNull) || new HashSet<>(pairs).size() != pairs.size()) {
      throw new IllegalArgumentException("Dashboard chart pairs must be distinct and non-null");
    }
    List<DashboardChartLineageBatchResult> results =
        pairs.stream().map(pair -> writePair(pair, updatedBy, authorize)).toList();
    return new DashboardChartLineageBatchResponse().withResults(results);
  }

  private DashboardChartLineageBatchResult writePair(
      DashboardChartLineagePair pair,
      String updatedBy,
      BiConsumer<EntityReference, MetadataOperation> authorize) {
    DashboardChartLineageBatchResult result =
        new DashboardChartLineageBatchResult()
            .withDashboardId(pair.getDashboardId())
            .withChartId(pair.getChartId());
    try {
      authorizePair(pair, authorize);
      switch (lineage.createDashboardChartLineage(pair, updatedBy)) {
        case CREATED -> result.setStatus(Status.CREATED);
        case PRESENT -> result.setStatus(Status.PRESENT);
        case NOT_MEMBER -> fail(result, ErrorCode.NOT_MEMBER);
        case PROJECTION_FAILED -> fail(result, ErrorCode.PROJECTION_FAILED);
      }
    } catch (AuthorizationException exception) {
      fail(result, ErrorCode.FORBIDDEN);
    } catch (EntityNotFoundException exception) {
      fail(result, ErrorCode.NOT_FOUND);
    } catch (JdbiException exception) {
      LOG.warn(
          "Could not create dashboard chart lineage {} to {}",
          pair.getDashboardId(),
          pair.getChartId(),
          exception);
      fail(result, ErrorCode.WRITE_FAILED);
    }
    return result;
  }

  private void authorizePair(
      DashboardChartLineagePair pair, BiConsumer<EntityReference, MetadataOperation> authorize) {
    Optional<EntityReference> dashboard = findEndpoint(DASHBOARD, pair.getDashboardId());
    Optional<EntityReference> chart = findEndpoint(CHART, pair.getChartId());
    dashboard.ifPresent(end -> authorize.accept(end, MetadataOperation.VIEW_BASIC));
    chart.ifPresent(end -> authorize.accept(end, MetadataOperation.VIEW_BASIC));
    EntityReference from =
        dashboard.orElseThrow(() -> EntityNotFoundException.byId(pair.getDashboardId().toString()));
    EntityReference to =
        chart.orElseThrow(() -> EntityNotFoundException.byId(pair.getChartId().toString()));
    authorize.accept(from, MetadataOperation.EDIT_LINEAGE);
    authorize.accept(to, MetadataOperation.EDIT_LINEAGE);
  }

  private Optional<EntityReference> findEndpoint(String type, UUID id) {
    Optional<EntityReference> endpoint;
    try {
      endpoint = Optional.of(resolveEndpoint.apply(type, id));
    } catch (EntityNotFoundException exception) {
      endpoint = Optional.empty();
    }
    return endpoint;
  }

  private static void fail(DashboardChartLineageBatchResult result, ErrorCode error) {
    result.setStatus(Status.FAILED);
    result.setErrorCode(error);
  }
}
