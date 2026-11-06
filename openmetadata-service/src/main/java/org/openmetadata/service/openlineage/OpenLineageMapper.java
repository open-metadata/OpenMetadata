/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.openlineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.openlineage.ColumnLineageFacet;
import org.openmetadata.schema.api.lineage.openlineage.ColumnLineageField;
import org.openmetadata.schema.api.lineage.openlineage.EventType;
import org.openmetadata.schema.api.lineage.openlineage.Fields;
import org.openmetadata.schema.api.lineage.openlineage.InputField;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageInputDataset;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageJob;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageOutputDataset;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRun;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRunEvent;
import org.openmetadata.schema.api.lineage.openlineage.OutputDatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.ParentJobFacet;
import org.openmetadata.schema.api.lineage.openlineage.ParentRunFacet;
import org.openmetadata.schema.api.lineage.openlineage.RunFacets;
import org.openmetadata.schema.api.lineage.openlineage.UnresolvedEntity;
import org.openmetadata.schema.configuration.OpenLineageEventType;
import org.openmetadata.schema.configuration.OpenLineageSettings;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;

@Slf4j
public class OpenLineageMapper {

  private static final String OPEN_LINEAGE_USER = "openlineage";

  /** Namespace and name, the identity OpenLineage gives every dataset and job. */
  private record OpenLineageName(String namespace, String name) {}

  /** What every edge of one event shares. */
  private record EdgeDetails(
      String description, EntityReference pipeline, String sqlQuery, long eventTimeMs) {}

  private final OpenLineageEntityResolver entityResolver;
  private final Set<String> allowedEventTypes;

  public OpenLineageMapper(OpenLineageEntityResolver entityResolver) {
    this(entityResolver, null);
  }

  public OpenLineageMapper(OpenLineageEntityResolver entityResolver, OpenLineageSettings settings) {
    this.entityResolver = entityResolver;

    if (settings != null
        && settings.getEventTypeFilter() != null
        && !settings.getEventTypeFilter().isEmpty()) {
      this.allowedEventTypes =
          settings.getEventTypeFilter().stream()
              .map(OpenLineageEventType::value)
              .collect(Collectors.toSet());
    } else {
      this.allowedEventTypes = Set.of("COMPLETE");
    }
  }

  public OpenLineageEventPlan mapRunEvent(OpenLineageRunEvent event, String updatedBy) {
    return isProcessable(event) ? planEvent(event, updatedBy) : OpenLineageEventPlan.skippedEvent();
  }

  private boolean isProcessable(OpenLineageRunEvent event) {
    boolean processable =
        event != null
            && shouldProcessEvent(event)
            && !nullOrEmpty(event.getInputs())
            && !nullOrEmpty(event.getOutputs());
    if (!processable) {
      LOG.debug("Skipping OpenLineage event: filtered event type, or no inputs or outputs");
    }
    return processable;
  }

  /**
   * Resolves every dataset once, then writes an edge for each input/output pair whose ends both
   * resolved. The datasets and job that did not resolve are kept for the response.
   */
  private OpenLineageEventPlan planEvent(OpenLineageRunEvent event, String updatedBy) {
    Map<String, UnresolvedEntity> unresolvedDatasets = new LinkedHashMap<>();
    Map<OpenLineageInputDataset, EntityReference> inputs =
        resolveDatasets(
            event.getInputs(),
            input -> entityResolver.resolveDataset(input, updatedBy),
            input -> new OpenLineageName(input.getNamespace(), input.getName()),
            unresolvedDatasets);
    Map<OpenLineageOutputDataset, EntityReference> outputs =
        resolveDatasets(
            event.getOutputs(),
            output -> entityResolver.resolveDataset(output, updatedBy),
            output -> new OpenLineageName(output.getNamespace(), output.getName()),
            unresolvedDatasets);
    List<UnresolvedEntity> unresolvedJobs = new ArrayList<>();
    EdgeDetails details = edgeDetails(event, resolvePipeline(event, unresolvedJobs));
    return new OpenLineageEventPlan(
        false,
        buildEdges(details, inputs, outputs),
        List.copyOf(unresolvedDatasets.values()),
        unresolvedJobs);
  }

  private static <D> Map<D, EntityReference> resolveDatasets(
      List<D> datasets,
      Function<D, OpenLineageResolution> resolve,
      Function<D, OpenLineageName> nameOf,
      Map<String, UnresolvedEntity> unresolved) {
    Map<D, EntityReference> resolvedDatasets = new LinkedHashMap<>();
    for (D dataset : datasets) {
      OpenLineageName name = nameOf.apply(dataset);
      switch (resolve.apply(dataset)) {
        case OpenLineageResolution.Resolved resolved -> resolvedDatasets.put(
            dataset, resolved.entity());
        case OpenLineageResolution.Unresolved failure -> unresolved.putIfAbsent(
            buildOpenLineageDatasetName(name.namespace(), name.name()),
            toUnresolvedEntity(name, failure));
      }
    }
    return resolvedDatasets;
  }

  private List<AddLineage> buildEdges(
      EdgeDetails details,
      Map<OpenLineageInputDataset, EntityReference> inputs,
      Map<OpenLineageOutputDataset, EntityReference> outputs) {
    Map<String, String> inputNameToFqnMap = buildInputFqnMap(inputs);
    List<AddLineage> lineageRequests = new ArrayList<>();
    outputs.forEach(
        (output, outputRef) -> {
          List<ColumnLineage> columnLineages =
              extractColumnLineage(output, inputNameToFqnMap, outputRef.getFullyQualifiedName());
          for (EntityReference inputRef : inputs.values()) {
            List<ColumnLineage> relevantColumnLineage =
                filterColumnLineageForInput(columnLineages, inputRef.getFullyQualifiedName());
            lineageRequests.add(buildEdge(details, inputRef, outputRef, relevantColumnLineage));
          }
        });
    return lineageRequests;
  }

  private static AddLineage buildEdge(
      EdgeDetails details,
      EntityReference inputRef,
      EntityReference outputRef,
      List<ColumnLineage> columnLineage) {
    LineageDetails lineageDetails =
        new LineageDetails()
            .withSource(LineageDetails.Source.OPEN_LINEAGE)
            .withDescription(details.description())
            .withPipeline(details.pipeline())
            .withSqlQuery(details.sqlQuery())
            .withColumnsLineage(columnLineage.isEmpty() ? null : columnLineage)
            .withCreatedAt(details.eventTimeMs())
            .withUpdatedAt(details.eventTimeMs())
            .withCreatedBy(OPEN_LINEAGE_USER)
            .withUpdatedBy(OPEN_LINEAGE_USER);
    return new AddLineage()
        .withEdge(
            new EntitiesEdge()
                .withFromEntity(inputRef)
                .withToEntity(outputRef)
                .withLineageDetails(lineageDetails));
  }

  /**
   * eventTime is the pipeline runtime moment the edge was actually observed; preserving it lets
   * historical replay (e.g. Kinesis backlog) reconstruct the real timeline rather than collapsing
   * everything to ingestion wall-clock.
   */
  private EdgeDetails edgeDetails(OpenLineageRunEvent event, EntityReference pipeline) {
    return new EdgeDetails(
        buildDescription(event), pipeline, extractSqlQuery(event), resolveEventTimeMillis(event));
  }

  private boolean shouldProcessEvent(OpenLineageRunEvent event) {
    EventType eventType = event.getEventType();
    if (eventType == null) {
      return allowedEventTypes.contains("COMPLETE");
    }
    return allowedEventTypes.contains(eventType.value());
  }

  private static long resolveEventTimeMillis(OpenLineageRunEvent event) {
    Date eventTime = event.getEventTime();
    long resolved;
    if (eventTime != null) {
      resolved = eventTime.getTime();
    } else {
      Long nominalStart = parseNominalStartTime(event);
      resolved = (nominalStart != null) ? nominalStart : System.currentTimeMillis();
    }
    return resolved;
  }

  private static Long parseNominalStartTime(OpenLineageRunEvent event) {
    Long resolved = null;
    OpenLineageRun run = event.getRun();
    RunFacets facets = (run != null) ? run.getFacets() : null;
    Map<String, Object> additional = (facets != null) ? facets.getAdditionalProperties() : null;
    Object nominalTime = (additional != null) ? additional.get("nominalTime") : null;
    if (nominalTime instanceof Map) {
      Object nominalStart = ((Map<?, ?>) nominalTime).get("nominalStartTime");
      if (nominalStart instanceof String) {
        try {
          resolved = Instant.parse((String) nominalStart).toEpochMilli();
        } catch (Exception e) {
          LOG.debug(
              "Failed to parse nominalStartTime from OpenLineage event {}: {}",
              run != null ? run.getRunId() : "unknown",
              e.getMessage());
        }
      }
    }
    return resolved;
  }

  private Map<String, String> buildInputFqnMap(
      Map<OpenLineageInputDataset, EntityReference> inputs) {
    Map<String, String> map = new HashMap<>();
    inputs.forEach(
        (input, ref) ->
            map.put(
                buildOpenLineageDatasetName(input.getNamespace(), input.getName()),
                ref.getFullyQualifiedName()));
    return map;
  }

  private EntityReference resolvePipeline(
      OpenLineageRunEvent event, List<UnresolvedEntity> unresolvedJobs) {
    OpenLineageName job = pipelineJob(event);
    EntityReference pipeline = null;
    if (job != null) {
      switch (entityResolver.resolvePipeline(job.namespace(), job.name())) {
        case OpenLineageResolution.Resolved resolved -> pipeline = resolved.entity();
        case OpenLineageResolution.Unresolved failure -> unresolvedJobs.add(
            toUnresolvedEntity(job, failure));
      }
    }
    return pipeline;
  }

  /** The parent run's job is preferred, matching the Python connector, then the event's own. */
  private static OpenLineageName pipelineJob(OpenLineageRunEvent event) {
    OpenLineageName parentJob = parentJobName(event);
    return parentJob != null ? parentJob : eventJobName(event);
  }

  private static OpenLineageName parentJobName(OpenLineageRunEvent event) {
    RunFacets facets = event.getRun() != null ? event.getRun().getFacets() : null;
    ParentRunFacet parent = facets != null ? facets.getParent() : null;
    ParentJobFacet job = parent != null ? parent.getJob() : null;
    return job == null || nullOrEmpty(job.getNamespace()) || nullOrEmpty(job.getName())
        ? null
        : new OpenLineageName(job.getNamespace(), job.getName());
  }

  private static OpenLineageName eventJobName(OpenLineageRunEvent event) {
    OpenLineageJob job = event.getJob();
    return job == null || nullOrEmpty(job.getName())
        ? null
        : new OpenLineageName(job.getNamespace(), job.getName());
  }

  private static UnresolvedEntity toUnresolvedEntity(
      OpenLineageName name, OpenLineageResolution.Unresolved failure) {
    return new UnresolvedEntity()
        .withNamespace(name.namespace())
        .withName(name.name())
        .withReason(failure.reason())
        .withMessage(failure.message());
  }

  private String extractSqlQuery(OpenLineageRunEvent event) {
    if (event.getJob() != null
        && event.getJob().getFacets() != null
        && event.getJob().getFacets().getSql() != null) {
      return event.getJob().getFacets().getSql().getQuery();
    }
    return null;
  }

  private List<ColumnLineage> extractColumnLineage(
      OpenLineageOutputDataset output, Map<String, String> inputNameToFqnMap, String outputFqn) {

    List<ColumnLineage> columnLineages = new ArrayList<>();

    // Check outputFacets first (OpenLineage spec location), fall back to dataset facets
    ColumnLineageFacet columnLineageFacet = null;
    OutputDatasetFacets outputFacets = output.getOutputFacets();
    if (outputFacets != null) {
      columnLineageFacet = outputFacets.getColumnLineage();
    }
    if (columnLineageFacet == null && output.getFacets() != null) {
      columnLineageFacet = output.getFacets().getColumnLineage();
    }
    if (columnLineageFacet == null || columnLineageFacet.getFields() == null) {
      return columnLineages;
    }

    Fields fieldsWrapper = columnLineageFacet.getFields();
    Map<String, ColumnLineageField> fields = fieldsWrapper.getAdditionalProperties();
    for (Map.Entry<String, ColumnLineageField> entry : fields.entrySet()) {
      String outputColumnName = entry.getKey();
      ColumnLineageField fieldInfo = entry.getValue();

      if (fieldInfo.getInputFields() == null || fieldInfo.getInputFields().isEmpty()) {
        continue;
      }

      List<String> fromColumns = new ArrayList<>();
      for (InputField inputField : fieldInfo.getInputFields()) {
        String inputOlName =
            buildOpenLineageDatasetName(inputField.getNamespace(), inputField.getName());
        String inputFqn = inputNameToFqnMap.get(inputOlName);
        if (inputFqn != null) {
          String columnFqn = inputFqn + "." + inputField.getField();
          fromColumns.add(columnFqn);
        }
      }

      if (!fromColumns.isEmpty()) {
        String toColumn = outputFqn + "." + outputColumnName;
        ColumnLineage columnLineage =
            new ColumnLineage()
                .withFromColumns(fromColumns)
                .withToColumn(toColumn)
                .withFunction(fieldInfo.getTransformationDescription());
        columnLineages.add(columnLineage);
      }
    }

    return columnLineages;
  }

  private List<ColumnLineage> filterColumnLineageForInput(
      List<ColumnLineage> allColumnLineage, String inputFqn) {
    List<ColumnLineage> filtered = new ArrayList<>();
    for (ColumnLineage cl : allColumnLineage) {
      List<String> relevantFromColumns = new ArrayList<>();
      for (String fromCol : cl.getFromColumns()) {
        if (fromCol.startsWith(inputFqn + ".")) {
          relevantFromColumns.add(fromCol);
        }
      }
      if (!relevantFromColumns.isEmpty()) {
        ColumnLineage filteredCl =
            new ColumnLineage()
                .withFromColumns(relevantFromColumns)
                .withToColumn(cl.getToColumn())
                .withFunction(cl.getFunction());
        filtered.add(filteredCl);
      }
    }
    return filtered;
  }

  private static String buildOpenLineageDatasetName(String namespace, String name) {
    return namespace + "/" + name;
  }

  private String buildDescription(OpenLineageRunEvent event) {
    StringBuilder sb = new StringBuilder();
    sb.append("Lineage from OpenLineage event");
    if (event.getJob() != null) {
      sb.append(" for job: ").append(event.getJob().getNamespace());
      sb.append("/").append(event.getJob().getName());
    }
    if (event.getRun() != null && event.getRun().getRunId() != null) {
      sb.append(" (run: ").append(event.getRun().getRunId()).append(")");
    }
    return sb.toString();
  }
}
