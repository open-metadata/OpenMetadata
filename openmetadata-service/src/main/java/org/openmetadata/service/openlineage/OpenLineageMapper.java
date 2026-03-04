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

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import org.openmetadata.schema.api.lineage.openlineage.ParentRunFacet;
import org.openmetadata.schema.api.lineage.openlineage.RunFacets;
import org.openmetadata.schema.configuration.OpenLineageEventType;
import org.openmetadata.schema.configuration.OpenLineageSettings;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;

@Slf4j
public class OpenLineageMapper {

  private final OpenLineageEntityResolver entityResolver;
  private final Set<String> allowedEventTypes;

  public OpenLineageMapper(OpenLineageEntityResolver entityResolver) {
    this(entityResolver, (OpenLineageSettings) null);
  }

  public OpenLineageMapper(OpenLineageEntityResolver entityResolver, OpenLineageSettings settings) {
    this.entityResolver = entityResolver;

    if (settings != null && settings.getEventTypeFilter() != null) {
      this.allowedEventTypes =
          settings.getEventTypeFilter().stream()
              .map(OpenLineageEventType::value)
              .collect(Collectors.toSet());
    } else {
      this.allowedEventTypes = Set.of("COMPLETE");
    }
  }

  public List<AddLineage> mapRunEvent(OpenLineageRunEvent event, String updatedBy) {
    if (event == null) {
      return Collections.emptyList();
    }

    if (!shouldProcessEvent(event)) {
      LOG.debug(
          "Skipping OpenLineage event with type: {}",
          event.getEventType() != null ? event.getEventType().value() : "null");
      return Collections.emptyList();
    }

    List<OpenLineageInputDataset> inputs = event.getInputs();
    List<OpenLineageOutputDataset> outputs = event.getOutputs();

    if (nullOrEmpty(inputs) || nullOrEmpty(outputs)) {
      LOG.debug("Skipping OpenLineage event with no inputs or outputs");
      return Collections.emptyList();
    }

    List<AddLineage> lineageRequests = new ArrayList<>();

    Map<String, String> inputNameToFqnMap = buildInputFqnMap(inputs);

    EntityReference pipelineRef = resolvePipelineReference(event, updatedBy);

    String sqlQuery = extractSqlQuery(event);

    for (OpenLineageOutputDataset output : outputs) {
      EntityReference outputRef = entityResolver.resolveOrCreateTable(output, updatedBy);
      if (outputRef == null) {
        LOG.warn(
            "Could not resolve output dataset: {}.{}", output.getNamespace(), output.getName());
        continue;
      }

      List<ColumnLineage> columnLineages =
          extractColumnLineage(output, inputNameToFqnMap, outputRef.getFullyQualifiedName());

      for (OpenLineageInputDataset input : inputs) {
        EntityReference inputRef = entityResolver.resolveOrCreateTable(input, updatedBy);
        if (inputRef == null) {
          LOG.warn("Could not resolve input dataset: {}.{}", input.getNamespace(), input.getName());
          continue;
        }

        String inputFqn = inputRef.getFullyQualifiedName();
        List<ColumnLineage> relevantColumnLineage =
            filterColumnLineageForInput(columnLineages, inputFqn);

        LineageDetails lineageDetails =
            new LineageDetails()
                .withSource(LineageDetails.Source.OPEN_LINEAGE)
                .withDescription(buildDescription(event))
                .withPipeline(pipelineRef)
                .withSqlQuery(sqlQuery)
                .withColumnsLineage(relevantColumnLineage.isEmpty() ? null : relevantColumnLineage);

        AddLineage addLineage =
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(inputRef)
                        .withToEntity(outputRef)
                        .withLineageDetails(lineageDetails));

        lineageRequests.add(addLineage);
      }
    }

    return lineageRequests;
  }

  private boolean shouldProcessEvent(OpenLineageRunEvent event) {
    EventType eventType = event.getEventType();
    if (eventType == null) {
      return allowedEventTypes.contains("COMPLETE");
    }
    return allowedEventTypes.contains(eventType.value());
  }

  private Map<String, String> buildInputFqnMap(List<OpenLineageInputDataset> inputs) {
    Map<String, String> map = new HashMap<>();
    for (OpenLineageInputDataset input : inputs) {
      String olName = buildOpenLineageDatasetName(input.getNamespace(), input.getName());
      EntityReference ref = entityResolver.resolveTable(input);
      if (ref != null) {
        map.put(olName, ref.getFullyQualifiedName());
      }
    }
    return map;
  }

  private EntityReference resolvePipelineReference(OpenLineageRunEvent event, String updatedBy) {
    // First try to get pipeline from parent run facet (preferred, matches Python connector
    // behavior)
    OpenLineageRun run = event.getRun();
    if (run != null && run.getFacets() != null) {
      RunFacets runFacets = run.getFacets();
      ParentRunFacet parentFacet = runFacets.getParent();
      if (parentFacet != null && parentFacet.getJob() != null) {
        String namespace = parentFacet.getJob().getNamespace();
        String name = parentFacet.getJob().getName();
        if (!nullOrEmpty(namespace) && !nullOrEmpty(name)) {
          return entityResolver.resolveOrCreatePipeline(namespace, name, updatedBy);
        }
      }
    }

    // Fall back to job from the event itself
    OpenLineageJob job = event.getJob();
    if (job == null) {
      return null;
    }
    return entityResolver.resolveOrCreatePipeline(job.getNamespace(), job.getName(), updatedBy);
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

    OutputDatasetFacets outputFacets = output.getOutputFacets();
    if (outputFacets == null) {
      return columnLineages;
    }

    ColumnLineageFacet columnLineageFacet = outputFacets.getColumnLineage();
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

  private String buildOpenLineageDatasetName(String namespace, String name) {
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
