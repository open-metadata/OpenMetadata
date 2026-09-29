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
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.services.ServiceHealth;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Derives a single health state per service by reducing the most recent run of each of its ingestion
 * pipelines, worst-wins.
 *
 * <p>Health is not stored on the service entity: a pipeline's runs live in the generic {@code
 * entity_extension_time_series} table keyed by the pipeline's FQN hash. This provider resolves that
 * in three batched queries whose cost is flat in the number of services requested — one relationship
 * lookup, one pipeline-reference resolution, and one windowed read of the single latest run per
 * pipeline. Nothing here is per-service.
 *
 * <p>It deliberately reads only the latest run ({@code rn = 1}) rather than the five that {@code
 * IngestionPipelineRepository} retains for the {@code pipelineStatuses} field, and it never
 * deserializes the {@code status[]} step array with its failure stack traces.
 */
@Slf4j
public class ServiceHealthProvider {
  private final CollectionDAO daoCollection;

  /**
   * Worst-wins precedence. Ordinal order is the reduction order, so combining two states is a max
   * rather than a chain of comparisons. States absent from this map (queued, running, stopped) are
   * non-terminal and leave a service at {@link ServiceHealth#NOT_RUN}, matching what the UI has
   * always shown for a service whose pipelines have never completed.
   */
  private static final Map<PipelineStatusType, ServiceHealth> TERMINAL_STATES =
      new EnumMap<>(PipelineStatusType.class);

  private static final List<ServiceHealth> WORST_WINS_ORDER =
      List.of(
          ServiceHealth.NOT_RUN,
          ServiceHealth.SUCCESS,
          ServiceHealth.PARTIAL_SUCCESS,
          ServiceHealth.FAILED);

  static {
    TERMINAL_STATES.put(PipelineStatusType.SUCCESS, ServiceHealth.SUCCESS);
    TERMINAL_STATES.put(PipelineStatusType.PARTIAL_SUCCESS, ServiceHealth.PARTIAL_SUCCESS);
    TERMINAL_STATES.put(PipelineStatusType.FAILED, ServiceHealth.FAILED);
  }

  public ServiceHealthProvider(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  /**
   * Health for each of {@code serviceIds}. Every requested id is present in the result: a service
   * with no pipelines, or whose pipelines have not completed a run, maps to {@link
   * ServiceHealth#NOT_RUN}.
   */
  public Map<UUID, ServiceHealth> healthByServiceId(List<UUID> serviceIds) {
    Map<UUID, ServiceHealth> health = new HashMap<>();
    serviceIds.forEach(id -> health.put(id, ServiceHealth.NOT_RUN));
    if (!nullOrEmpty(serviceIds)) {
      applyPipelineStates(health, serviceIds);
    }
    return health;
  }

  private void applyPipelineStates(Map<UUID, ServiceHealth> health, List<UUID> serviceIds) {
    List<CollectionDAO.EntityRelationshipObject> links = findPipelineLinks(serviceIds);
    Map<UUID, String> fqnByPipelineId = resolvePipelineFqns(links);
    Map<String, PipelineStatusType> latestStates = latestStatesByFqnHash(fqnByPipelineId.values());
    Map<UUID, List<PipelineStatusType>> statesByService = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject link : links) {
      PipelineStatusType state = stateOf(link, fqnByPipelineId, latestStates);
      if (state != null) {
        statesByService
            .computeIfAbsent(UUID.fromString(link.getFromId()), id -> new ArrayList<>())
            .add(state);
      }
    }
    statesByService.forEach((serviceId, states) -> health.put(serviceId, worstOf(states)));
  }

  /**
   * The reduction itself, kept free of any data access so it can be tested directly. This is the
   * contract the Connections UI relied on client-side before health moved server-side, so the two
   * must agree exactly: worst terminal state wins, and no terminal state at all means never run.
   */
  static ServiceHealth worstOf(Collection<PipelineStatusType> latestStates) {
    ServiceHealth worst = ServiceHealth.NOT_RUN;
    for (PipelineStatusType state : latestStates) {
      ServiceHealth candidate = TERMINAL_STATES.get(state);
      if (candidate != null
          && WORST_WINS_ORDER.indexOf(candidate) > WORST_WINS_ORDER.indexOf(worst)) {
        worst = candidate;
      }
    }
    return worst;
  }

  private PipelineStatusType stateOf(
      CollectionDAO.EntityRelationshipObject link,
      Map<UUID, String> fqnByPipelineId,
      Map<String, PipelineStatusType> latestStates) {
    String fqn = fqnByPipelineId.get(UUID.fromString(link.getToId()));
    return fqn == null ? null : latestStates.get(FullyQualifiedName.buildHash(fqn));
  }

  private List<CollectionDAO.EntityRelationshipObject> findPipelineLinks(List<UUID> serviceIds) {
    List<String> ids = serviceIds.stream().map(UUID::toString).toList();
    return daoCollection
        .relationshipDAO()
        .findToBatch(ids, Relationship.CONTAINS.ordinal(), INGESTION_PIPELINE, Include.NON_DELETED);
  }

  private Map<UUID, String> resolvePipelineFqns(
      List<CollectionDAO.EntityRelationshipObject> links) {
    List<UUID> pipelineIds =
        links.stream().map(link -> UUID.fromString(link.getToId())).distinct().toList();
    Map<UUID, String> fqns = new HashMap<>();
    if (!pipelineIds.isEmpty()) {
      List<EntityReference> refs =
          Entity.getEntityReferencesByIds(INGESTION_PIPELINE, pipelineIds, Include.NON_DELETED);
      refs.forEach(ref -> fqns.put(ref.getId(), ref.getFullyQualifiedName()));
    }
    return fqns;
  }

  private Map<String, PipelineStatusType> latestStatesByFqnHash(Collection<String> fqns) {
    List<String> hashes =
        new ArrayList<>(fqns.stream().map(FullyQualifiedName::buildHash).toList());
    Map<String, String> jsonByHash =
        daoCollection
            .entityExtensionTimeSeriesDao()
            .getLatestExtensionBatch(hashes, IngestionPipelineRepository.PIPELINE_STATUS_EXTENSION);
    Map<String, PipelineStatusType> states = new HashMap<>();
    jsonByHash.forEach((hash, json) -> putState(states, hash, json));
    return states;
  }

  private void putState(Map<String, PipelineStatusType> states, String hash, String json) {
    PipelineStatus status = JsonUtils.readValue(json, PipelineStatus.class);
    if (status != null && status.getPipelineState() != null) {
      states.put(hash, status.getPipelineState());
    }
  }
}
