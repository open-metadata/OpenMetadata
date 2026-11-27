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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.openlineage.ColumnLineageFacet;
import org.openmetadata.schema.api.lineage.openlineage.ColumnLineageField;
import org.openmetadata.schema.api.lineage.openlineage.EventType;
import org.openmetadata.schema.api.lineage.openlineage.Fields;
import org.openmetadata.schema.api.lineage.openlineage.InputField;
import org.openmetadata.schema.api.lineage.openlineage.InputFieldTransformation;
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
import org.openmetadata.schema.type.DependencyType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.IndirectColumn;
import org.openmetadata.schema.type.LineageDetails;

@Slf4j
public class OpenLineageMapper {

  private static final String OPEN_LINEAGE_USER = "openlineage";

  /** Namespace and name, the identity OpenLineage gives every dataset and job. */
  private record OpenLineageName(String namespace, String name) {}

  /** What every edge of one event shares. */
  private record EdgeDetails(
      String description, EntityReference pipeline, String sqlQuery, long eventTimeMs) {}

  /** Display text and structured type/subtype extracted for one input column transformation. */
  private record ColumnTransformation(
      String function, String transformationType, String transformationSubtype) {}

  /** Per-output column lineage and dataset-level indirect columns extracted from a facet. */
  private record ExtractedColumnLineage(
      List<ColumnLineage> columns, List<IndirectColumn> indirectColumns) {}

  /** Column-level lineage payload attached to a single upstream-to-downstream edge. */
  private record EdgeColumnData(
      List<ColumnLineage> columns,
      List<IndirectColumn> indirectColumns,
      DependencyType dependencyType) {}

  /**
   * The stored columns of one dataset, which say how a field is written in a column FQN. A field
   * with no stored column keeps its spelling, and the lineage write drops it.
   */
  private record DatasetColumns(String datasetFqn, Map<String, String> fqnsByFieldPath) {
    String columnFqn(String field) {
      String storedFqn =
          fqnsByFieldPath.getOrDefault(
              field, fqnsByFieldPath.get(OpenLineageColumnMapper.toStoredName(field)));
      return storedFqn != null ? storedFqn : datasetFqn + "." + field;
    }
  }

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
    Map<String, EntityReference> inputsByName = indexInputsByName(inputs);
    Map<String, DatasetColumns> inputColumns = new HashMap<>();
    List<AddLineage> lineageRequests = new ArrayList<>();
    outputs.forEach(
        (output, outputRef) -> {
          ExtractedColumnLineage extracted =
              extractColumnLineage(output, inputsByName, inputColumns, outputRef);
          for (EntityReference inputRef : inputs.values()) {
            String inputFqn = inputRef.getFullyQualifiedName();
            List<ColumnLineage> relevantColumnLineage =
                filterColumnLineageForInput(extracted.columns(), inputFqn);
            List<IndirectColumn> relevantIndirectColumns =
                filterIndirectColumnsForInput(extracted.indirectColumns(), inputFqn);
            DependencyType dependencyType =
                computeDependencyType(relevantColumnLineage, relevantIndirectColumns);
            EdgeColumnData columnData =
                new EdgeColumnData(relevantColumnLineage, relevantIndirectColumns, dependencyType);
            lineageRequests.add(buildEdge(details, inputRef, outputRef, columnData));
          }
        });
    return lineageRequests;
  }

  private static AddLineage buildEdge(
      EdgeDetails details,
      EntityReference inputRef,
      EntityReference outputRef,
      EdgeColumnData columnData) {
    LineageDetails lineageDetails =
        new LineageDetails()
            .withSource(LineageDetails.Source.OPEN_LINEAGE)
            .withDescription(details.description())
            .withPipeline(details.pipeline())
            .withSqlQuery(details.sqlQuery())
            .withColumnsLineage(columnData.columns().isEmpty() ? null : columnData.columns())
            .withIndirectColumns(
                columnData.indirectColumns().isEmpty() ? null : columnData.indirectColumns())
            .withDependencyType(columnData.dependencyType())
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

  private Map<String, EntityReference> indexInputsByName(
      Map<OpenLineageInputDataset, EntityReference> inputs) {
    Map<String, EntityReference> map = new HashMap<>();
    inputs.forEach(
        (input, ref) ->
            map.put(buildOpenLineageDatasetName(input.getNamespace(), input.getName()), ref));
    return map;
  }

  private DatasetColumns readColumns(EntityReference dataset) {
    return new DatasetColumns(
        dataset.getFullyQualifiedName(),
        OpenLineageColumnMapper.fqnsByFieldPath(entityResolver.storedColumns(dataset)));
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

  private ExtractedColumnLineage extractColumnLineage(
      OpenLineageOutputDataset output,
      Map<String, EntityReference> inputsByName,
      Map<String, DatasetColumns> inputColumns,
      EntityReference outputRef) {
    ColumnLineageFacet columnLineageFacet = resolveColumnLineageFacet(output);
    List<ColumnLineage> columnLineages = new ArrayList<>();
    List<IndirectColumn> indirectColumns = new ArrayList<>();
    if (columnLineageFacet != null) {
      if (columnLineageFacet.getFields() != null) {
        columnLineages =
            extractFieldLineages(
                columnLineageFacet.getFields(), inputsByName, inputColumns, outputRef);
      }
      if (!nullOrEmpty(columnLineageFacet.getDataset())) {
        indirectColumns =
            extractDatasetIndirectColumns(
                columnLineageFacet.getDataset(), inputsByName, inputColumns);
      }
    }
    return new ExtractedColumnLineage(columnLineages, indirectColumns);
  }

  private static ColumnLineageFacet resolveColumnLineageFacet(OpenLineageOutputDataset output) {
    OutputDatasetFacets outputFacets = output.getOutputFacets();
    ColumnLineageFacet facet = outputFacets != null ? outputFacets.getColumnLineage() : null;
    if (facet == null && output.getFacets() != null) {
      facet = output.getFacets().getColumnLineage();
    }
    return facet;
  }

  private List<ColumnLineage> extractFieldLineages(
      Fields fieldsWrapper,
      Map<String, EntityReference> inputsByName,
      Map<String, DatasetColumns> inputColumns,
      EntityReference outputRef) {
    List<ColumnLineage> columnLineages = new ArrayList<>();
    DatasetColumns outputColumns = readColumns(outputRef);
    Map<String, ColumnLineageField> fields = fieldsWrapper.getAdditionalProperties();
    for (Map.Entry<String, ColumnLineageField> entry : fields.entrySet()) {
      ColumnLineageField fieldInfo = entry.getValue();
      if (fieldInfo != null && !nullOrEmpty(fieldInfo.getInputFields())) {
        appendFieldLineages(
            columnLineages,
            outputColumns.columnFqn(entry.getKey()),
            fieldInfo,
            inputsByName,
            inputColumns);
      }
    }
    return columnLineages;
  }

  private void appendFieldLineages(
      List<ColumnLineage> columnLineages,
      String toColumn,
      ColumnLineageField fieldInfo,
      Map<String, EntityReference> inputsByName,
      Map<String, DatasetColumns> inputColumns) {
    Map<ColumnTransformation, List<String>> columnsByTransform = new LinkedHashMap<>();
    for (InputField inputField : fieldInfo.getInputFields()) {
      String inputOlName =
          buildOpenLineageDatasetName(inputField.getNamespace(), inputField.getName());
      EntityReference inputRef = inputsByName.get(inputOlName);
      if (inputRef != null) {
        DatasetColumns input =
            inputColumns.computeIfAbsent(inputOlName, name -> readColumns(inputRef));
        columnsByTransform
            .computeIfAbsent(
                extractColumnTransformation(inputField, fieldInfo), ignored -> new ArrayList<>())
            .add(input.columnFqn(inputField.getField()));
      }
    }
    columnsByTransform.forEach(
        (transformation, columns) ->
            columnLineages.add(
                new ColumnLineage()
                    .withToColumn(toColumn)
                    .withFromColumns(columns)
                    .withFunction(transformation.function())
                    .withTransformationType(transformation.transformationType())
                    .withTransformationSubtype(transformation.transformationSubtype())));
  }

  private List<IndirectColumn> extractDatasetIndirectColumns(
      List<InputField> datasetFields,
      Map<String, EntityReference> inputsByName,
      Map<String, DatasetColumns> inputColumns) {
    Set<IndirectColumn> indirectColumns = new LinkedHashSet<>();
    for (InputField inputField : datasetFields) {
      if (inputField != null && StringUtils.isNotBlank(inputField.getField())) {
        String inputOlName =
            buildOpenLineageDatasetName(inputField.getNamespace(), inputField.getName());
        EntityReference inputRef = inputsByName.get(inputOlName);
        if (inputRef != null) {
          DatasetColumns input =
              inputColumns.computeIfAbsent(inputOlName, name -> readColumns(inputRef));
          appendDatasetIndirectColumns(
              indirectColumns,
              input.columnFqn(inputField.getField()),
              inputField.getTransformations());
        }
      }
    }
    return new ArrayList<>(indirectColumns);
  }

  private static void appendDatasetIndirectColumns(
      Set<IndirectColumn> indirectColumns,
      String fromColumn,
      List<InputFieldTransformation> transformations) {
    List<InputFieldTransformation> usable =
        nullOrEmpty(transformations)
            ? List.of()
            : transformations.stream()
                .filter(Objects::nonNull)
                .filter(OpenLineageMapper::hasTransformationDetail)
                .toList();
    if (usable.isEmpty()) {
      indirectColumns.add(
          new IndirectColumn()
              .withFromColumn(fromColumn)
              .withTransformationType(DependencyType.INDIRECT.value()));
    } else {
      for (InputFieldTransformation transformation : usable) {
        indirectColumns.add(toIndirectColumn(fromColumn, transformation));
      }
    }
  }

  private static boolean hasTransformationDetail(InputFieldTransformation transformation) {
    return StringUtils.isNotBlank(transformation.getType())
        || StringUtils.isNotBlank(transformation.getSubtype())
        || StringUtils.isNotBlank(transformation.getDescription());
  }

  private static IndirectColumn toIndirectColumn(
      String fromColumn, InputFieldTransformation transformation) {
    String type =
        StringUtils.isNotBlank(transformation.getType())
            ? transformation.getType().strip()
            : DependencyType.INDIRECT.value();
    String subtype =
        StringUtils.isNotBlank(transformation.getSubtype())
            ? transformation.getSubtype().strip()
            : null;
    String description =
        StringUtils.isNotBlank(transformation.getDescription())
            ? transformation.getDescription().strip()
            : null;
    return new IndirectColumn()
        .withFromColumn(fromColumn)
        .withTransformationType(type)
        .withTransformationSubtype(subtype)
        .withDescription(description);
  }

  private static ColumnTransformation extractColumnTransformation(
      InputField inputField, ColumnLineageField fieldInfo) {
    List<InputFieldTransformation> usable = usableTransformations(inputField);
    String function = formatColumnFunction(usable, fieldInfo);
    String transformationType = null;
    String transformationSubtype = null;
    if (!usable.isEmpty()) {
      InputFieldTransformation primary = primaryTransformation(usable);
      transformationType = primary.getType().strip();
      transformationSubtype =
          StringUtils.isNotBlank(primary.getSubtype()) ? primary.getSubtype().strip() : null;
    } else if (isDependencyTypeValue(fieldInfo.getTransformationType())) {
      transformationType = fieldInfo.getTransformationType().strip().toUpperCase(Locale.ROOT);
    }
    return new ColumnTransformation(function, transformationType, transformationSubtype);
  }

  private static List<InputFieldTransformation> usableTransformations(InputField inputField) {
    List<InputFieldTransformation> result = List.of();
    if (!nullOrEmpty(inputField.getTransformations())) {
      result =
          inputField.getTransformations().stream()
              .filter(Objects::nonNull)
              .filter(transformation -> StringUtils.isNotBlank(transformation.getType()))
              .toList();
    }
    return result;
  }

  private static InputFieldTransformation primaryTransformation(
      List<InputFieldTransformation> usable) {
    return usable.stream()
        .filter(
            transformation ->
                DependencyType.DIRECT.value().equalsIgnoreCase(transformation.getType().strip()))
        .findFirst()
        .orElse(usable.getFirst());
  }

  private static boolean isDependencyTypeValue(String value) {
    return StringUtils.isNotBlank(value)
        && (DependencyType.DIRECT.value().equalsIgnoreCase(value.strip())
            || DependencyType.INDIRECT.value().equalsIgnoreCase(value.strip()));
  }

  private static String formatColumnFunction(
      List<InputFieldTransformation> usable, ColumnLineageField fieldInfo) {
    String function;
    if (!usable.isEmpty()) {
      function =
          usable.stream()
              .map(OpenLineageMapper::describeTransformation)
              .collect(Collectors.joining(", "));
    } else {
      function =
          StringUtils.isNotBlank(fieldInfo.getTransformationDescription())
              ? fieldInfo.getTransformationDescription()
              : StringUtils.defaultIfBlank(fieldInfo.getTransformationType(), null);
    }
    return function;
  }

  private static String describeTransformation(InputFieldTransformation transformation) {
    StringBuilder function = new StringBuilder(transformation.getType().strip());
    if (StringUtils.isNotBlank(transformation.getSubtype())) {
      function.append('/').append(transformation.getSubtype().strip());
    }
    if (StringUtils.isNotBlank(transformation.getDescription())) {
      function.append(" (").append(transformation.getDescription().strip()).append(')');
    }
    if (Boolean.TRUE.equals(transformation.getMasking())) {
      function.append(" [masked]");
    }
    return function.toString();
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
                .withFunction(cl.getFunction())
                .withTransformationType(cl.getTransformationType())
                .withTransformationSubtype(cl.getTransformationSubtype());
        filtered.add(filteredCl);
      }
    }
    return filtered;
  }

  private static List<IndirectColumn> filterIndirectColumnsForInput(
      List<IndirectColumn> allIndirectColumns, String inputFqn) {
    List<IndirectColumn> filtered = new ArrayList<>();
    String prefix = inputFqn + ".";
    for (IndirectColumn indirectColumn : allIndirectColumns) {
      if (indirectColumn.getFromColumn() != null
          && indirectColumn.getFromColumn().startsWith(prefix)) {
        filtered.add(indirectColumn);
      }
    }
    return filtered;
  }

  static DependencyType computeDependencyType(
      List<ColumnLineage> columns, List<IndirectColumn> indirectColumns) {
    DependencyType resolved;
    if (nullOrEmpty(columns) && nullOrEmpty(indirectColumns)) {
      resolved = null;
    } else if (hasDirectSignal(columns, indirectColumns)) {
      resolved = DependencyType.DIRECT;
    } else {
      resolved = DependencyType.INDIRECT;
    }
    return resolved;
  }

  private static boolean hasDirectSignal(
      List<ColumnLineage> columns, List<IndirectColumn> indirectColumns) {
    boolean directColumn =
        !nullOrEmpty(columns)
            && columns.stream()
                .anyMatch(
                    column ->
                        !DependencyType.INDIRECT
                            .value()
                            .equalsIgnoreCase(column.getTransformationType()));
    boolean directDataset =
        !nullOrEmpty(indirectColumns)
            && indirectColumns.stream()
                .anyMatch(
                    indirect ->
                        StringUtils.isNotBlank(indirect.getTransformationType())
                            && !DependencyType.INDIRECT
                                .value()
                                .equalsIgnoreCase(indirect.getTransformationType()));
    return directColumn || directDataset;
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
