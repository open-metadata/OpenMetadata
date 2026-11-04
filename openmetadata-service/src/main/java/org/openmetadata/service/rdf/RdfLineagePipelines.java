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
package org.openmetadata.service.rdf;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfEntityLiveness.Endpoint;
import org.openmetadata.service.rdf.RdfRepository.LineageEdgeData;

/**
 * A lineage edge's details can name the pipeline that produced it, in their JSON only. The graph
 * holds live entities only, so a soft-deleted pipeline is left out of the details it projects.
 */
final class RdfLineagePipelines {
  private RdfLineagePipelines() {}

  static LineageDetails withLivePipeline(
      final LineageDetails details, final RdfEntityLiveness liveness) {
    final Endpoint pipeline = pipelineOf(details);
    return pipeline == null || liveness.isLive(pipeline.entityType(), pipeline.entityId())
        ? details
        : withoutPipeline(details);
  }

  /** Checks every named pipeline with one query per entity type. */
  static List<LineageEdgeData> withLivePipelines(
      final List<LineageEdgeData> edges, final RdfEntityLiveness liveness) {
    final Set<Endpoint> pipelines =
        edges.stream()
            .map(edge -> pipelineOf(edge.details()))
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    final Set<Endpoint> live = pipelines.isEmpty() ? Set.of() : liveness.liveEndpoints(pipelines);
    return edges.stream().map(edge -> withoutDeadPipeline(edge, live)).toList();
  }

  private static LineageEdgeData withoutDeadPipeline(
      final LineageEdgeData edge, final Set<Endpoint> live) {
    final Endpoint pipeline = pipelineOf(edge.details());
    return pipeline == null || live.contains(pipeline)
        ? edge
        : new LineageEdgeData(
            edge.fromType(),
            edge.fromId(),
            edge.toType(),
            edge.toId(),
            withoutPipeline(edge.details()));
  }

  private static LineageDetails withoutPipeline(final LineageDetails details) {
    return JsonUtils.deepCopy(details, LineageDetails.class).withPipeline(null);
  }

  private static Endpoint pipelineOf(final LineageDetails details) {
    final EntityReference pipeline = details == null ? null : details.getPipeline();
    return pipeline == null || pipeline.getId() == null
        ? null
        : new Endpoint(
            pipeline.getType() != null ? pipeline.getType() : Entity.PIPELINE, pipeline.getId());
  }
}
