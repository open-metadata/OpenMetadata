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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.net.URI;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.openlineage.ColumnLineageFacet;
import org.openmetadata.schema.api.lineage.openlineage.ColumnLineageField;
import org.openmetadata.schema.api.lineage.openlineage.EventType;
import org.openmetadata.schema.api.lineage.openlineage.Fields;
import org.openmetadata.schema.api.lineage.openlineage.InputField;
import org.openmetadata.schema.api.lineage.openlineage.JobFacets;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageInputDataset;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageJob;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageOutputDataset;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRun;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRunEvent;
import org.openmetadata.schema.api.lineage.openlineage.OutputDatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.ParentJobFacet;
import org.openmetadata.schema.api.lineage.openlineage.ParentRunFacet;
import org.openmetadata.schema.api.lineage.openlineage.RunFacets;
import org.openmetadata.schema.api.lineage.openlineage.SqlJobFacet;
import org.openmetadata.schema.configuration.OpenLineageEventType;
import org.openmetadata.schema.configuration.OpenLineageSettings;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;

@ExtendWith(MockitoExtension.class)
class OpenLineageMapperTest {

  @Mock private OpenLineageEntityResolver entityResolver;

  private OpenLineageMapper mapper;
  private static final String UPDATED_BY = "test_user";

  @BeforeEach
  void setUp() {
    mapper = new OpenLineageMapper(entityResolver);
  }

  @Test
  void mapRunEvent_nullEvent_returnsEmptyList() {
    List<AddLineage> result = mapper.mapRunEvent(null, UPDATED_BY);

    assertTrue(result.isEmpty());
    verifyNoInteractions(entityResolver);
  }

  @Test
  void mapRunEvent_emptyInputs_returnsEmptyList() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    event.setInputs(new ArrayList<>());
    event.setOutputs(List.of(createOutputDataset("ns", "output_table")));

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertTrue(result.isEmpty());
  }

  @Test
  void mapRunEvent_emptyOutputs_returnsEmptyList() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    event.setInputs(List.of(createInputDataset("ns", "input_table")));
    event.setOutputs(new ArrayList<>());

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertTrue(result.isEmpty());
  }

  @Test
  void mapRunEvent_nullInputs_returnsEmptyList() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    event.setInputs(null);
    event.setOutputs(List.of(createOutputDataset("ns", "output_table")));

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertTrue(result.isEmpty());
  }

  @Test
  void mapRunEvent_startEvent_skippedByDefault() {
    OpenLineageRunEvent event = createBaseEvent(EventType.START);
    event.setInputs(List.of(createInputDataset("ns", "input_table")));
    event.setOutputs(List.of(createOutputDataset("ns", "output_table")));

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertTrue(result.isEmpty());
  }

  @Test
  void mapRunEvent_runningEvent_skippedByDefault() {
    OpenLineageRunEvent event = createBaseEvent(EventType.RUNNING);
    event.setInputs(List.of(createInputDataset("ns", "input_table")));
    event.setOutputs(List.of(createOutputDataset("ns", "output_table")));

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertTrue(result.isEmpty());
  }

  @Test
  void mapRunEvent_failEvent_skippedByDefault() {
    OpenLineageRunEvent event = createBaseEvent(EventType.FAIL);
    event.setInputs(List.of(createInputDataset("ns", "input_table")));
    event.setOutputs(List.of(createOutputDataset("ns", "output_table")));

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertTrue(result.isEmpty());
  }

  @Test
  void mapRunEvent_completeEvent_createsLineage() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    OpenLineageInputDataset input = createInputDataset("input-ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("output-ns", "output_table");
    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    EntityReference inputRef =
        createEntityReference("input-table-id", "service.db.schema.input_table");
    EntityReference outputRef =
        createEntityReference("output-table-id", "service.db.schema.output_table");
    EntityReference pipelineRef = createPipelineReference("pipeline-id", "service.pipeline");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(pipelineRef);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertEquals(1, result.size());
    AddLineage lineage = result.get(0);
    assertEquals(inputRef, lineage.getEdge().getFromEntity());
    assertEquals(outputRef, lineage.getEdge().getToEntity());
    assertEquals(
        LineageDetails.Source.OPEN_LINEAGE, lineage.getEdge().getLineageDetails().getSource());
    assertEquals(pipelineRef, lineage.getEdge().getLineageDetails().getPipeline());
  }

  @Test
  void mapRunEvent_nullEventType_processedAsComplete() {
    OpenLineageRunEvent event = createBaseEvent(null);
    OpenLineageInputDataset input = createInputDataset("input-ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("output-ns", "output_table");
    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    EntityReference inputRef =
        createEntityReference("input-table-id", "service.db.schema.input_table");
    EntityReference outputRef =
        createEntityReference("output-table-id", "service.db.schema.output_table");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertEquals(1, result.size());
  }

  @Test
  void mapRunEvent_multipleInputsAndOutputs_createsMultipleLineages() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    OpenLineageInputDataset input1 = createInputDataset("ns", "input1");
    OpenLineageInputDataset input2 = createInputDataset("ns", "input2");
    OpenLineageOutputDataset output1 = createOutputDataset("ns", "output1");
    OpenLineageOutputDataset output2 = createOutputDataset("ns", "output2");
    event.setInputs(List.of(input1, input2));
    event.setOutputs(List.of(output1, output2));

    EntityReference inputRef1 = createEntityReference("i1", "service.db.schema.input1");
    EntityReference inputRef2 = createEntityReference("i2", "service.db.schema.input2");
    EntityReference outputRef1 = createEntityReference("o1", "service.db.schema.output1");
    EntityReference outputRef2 = createEntityReference("o2", "service.db.schema.output2");

    when(entityResolver.resolveTable(input1)).thenReturn(inputRef1);
    when(entityResolver.resolveTable(input2)).thenReturn(inputRef2);
    when(entityResolver.resolveOrCreateTable(eq(output1), eq(UPDATED_BY))).thenReturn(outputRef1);
    when(entityResolver.resolveOrCreateTable(eq(output2), eq(UPDATED_BY))).thenReturn(outputRef2);
    when(entityResolver.resolveOrCreateTable(eq(input1), eq(UPDATED_BY))).thenReturn(inputRef1);
    when(entityResolver.resolveOrCreateTable(eq(input2), eq(UPDATED_BY))).thenReturn(inputRef2);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    // 2 outputs * 2 inputs = 4 lineage edges
    assertEquals(4, result.size());
  }

  @Test
  void mapRunEvent_unresolvedOutput_skipsOutput() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    OpenLineageInputDataset input = createInputDataset("ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("ns", "output_table");
    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertTrue(result.isEmpty());
  }

  @Test
  void mapRunEvent_unresolvedInput_skipsInput() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    OpenLineageInputDataset input = createInputDataset("ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("ns", "output_table");
    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    EntityReference outputRef = createEntityReference("o1", "service.db.schema.output_table");
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(null);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);
    when(entityResolver.resolveTable(input)).thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertTrue(result.isEmpty());
  }

  @Test
  void mapRunEvent_withSqlQuery_extractsSqlIntoLineageDetails() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    String sqlQuery = "SELECT a, b FROM input_table";
    event.getJob().setFacets(new JobFacets().withSql(new SqlJobFacet().withQuery(sqlQuery)));

    OpenLineageInputDataset input = createInputDataset("ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("ns", "output_table");
    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    EntityReference inputRef = createEntityReference("i1", "service.db.schema.input_table");
    EntityReference outputRef = createEntityReference("o1", "service.db.schema.output_table");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertEquals(1, result.size());
    assertEquals(sqlQuery, result.get(0).getEdge().getLineageDetails().getSqlQuery());
  }

  @Test
  void mapRunEvent_withParentRunFacet_usesPipelineFromParent() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    ParentJobFacet parentJobFacet =
        new ParentJobFacet().withNamespace("parent-namespace").withName("parent-job");
    ParentRunFacet parentFacet = new ParentRunFacet().withJob(parentJobFacet);
    event.getRun().setFacets(new RunFacets().withParent(parentFacet));

    OpenLineageInputDataset input = createInputDataset("ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("ns", "output_table");
    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    EntityReference inputRef = createEntityReference("i1", "service.db.schema.input_table");
    EntityReference outputRef = createEntityReference("o1", "service.db.schema.output_table");
    EntityReference parentPipelineRef =
        createPipelineReference("parent-pipe-id", "service.parent-namespace_parent-job");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline("parent-namespace", "parent-job", UPDATED_BY))
        .thenReturn(parentPipelineRef);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertEquals(1, result.size());
    assertEquals(parentPipelineRef, result.get(0).getEdge().getLineageDetails().getPipeline());
    verify(entityResolver).resolveOrCreatePipeline("parent-namespace", "parent-job", UPDATED_BY);
    verify(entityResolver, never())
        .resolveOrCreatePipeline(eq("test-namespace"), eq("test-job"), eq(UPDATED_BY));
  }

  @Test
  void mapRunEvent_withColumnLineage_extractsColumnLineage() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);

    String inputNamespace = "input-ns";
    String inputName = "schema.input_table";
    OpenLineageInputDataset input = createInputDataset(inputNamespace, inputName);

    String outputNamespace = "output-ns";
    String outputName = "schema.output_table";
    OpenLineageOutputDataset output = createOutputDataset(outputNamespace, outputName);

    // Set up column lineage facet
    InputField inputField =
        new InputField().withNamespace(inputNamespace).withName(inputName).withField("source_col");

    ColumnLineageField columnLineageField =
        new ColumnLineageField()
            .withInputFields(List.of(inputField))
            .withTransformationDescription("IDENTITY");

    Fields fields = new Fields();
    fields.setAdditionalProperty("target_col", columnLineageField);

    ColumnLineageFacet columnLineageFacet = new ColumnLineageFacet().withFields(fields);
    output.setOutputFacets(new OutputDatasetFacets().withColumnLineage(columnLineageFacet));

    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    EntityReference inputRef = createEntityReference("i1", "service.db.schema.input_table");
    EntityReference outputRef = createEntityReference("o1", "service.db.schema.output_table");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertEquals(1, result.size());
    List<ColumnLineage> columnLineages =
        result.get(0).getEdge().getLineageDetails().getColumnsLineage();
    assertNotNull(columnLineages);
    assertEquals(1, columnLineages.size());

    ColumnLineage cl = columnLineages.get(0);
    assertEquals("service.db.schema.output_table.target_col", cl.getToColumn());
    assertTrue(cl.getFromColumns().contains("service.db.schema.input_table.source_col"));
    assertEquals("IDENTITY", cl.getFunction());
  }

  @Test
  void mapRunEvent_withMultipleColumnLineageEntries_extractsAll() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);

    String inputNamespace = "input-ns";
    String inputName = "schema.input_table";
    OpenLineageInputDataset input = createInputDataset(inputNamespace, inputName);

    String outputNamespace = "output-ns";
    String outputName = "schema.output_table";
    OpenLineageOutputDataset output = createOutputDataset(outputNamespace, outputName);

    InputField inputField1 =
        new InputField().withNamespace(inputNamespace).withName(inputName).withField("col_a");
    InputField inputField2 =
        new InputField().withNamespace(inputNamespace).withName(inputName).withField("col_b");

    ColumnLineageField columnLineageField1 =
        new ColumnLineageField()
            .withInputFields(List.of(inputField1))
            .withTransformationDescription("COPY");
    ColumnLineageField columnLineageField2 =
        new ColumnLineageField()
            .withInputFields(List.of(inputField2))
            .withTransformationDescription("TRANSFORM");

    Fields fields = new Fields();
    fields.setAdditionalProperty("out_a", columnLineageField1);
    fields.setAdditionalProperty("out_b", columnLineageField2);

    ColumnLineageFacet columnLineageFacet = new ColumnLineageFacet().withFields(fields);
    output.setOutputFacets(new OutputDatasetFacets().withColumnLineage(columnLineageFacet));

    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    EntityReference inputRef = createEntityReference("i1", "service.db.schema.input_table");
    EntityReference outputRef = createEntityReference("o1", "service.db.schema.output_table");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertEquals(1, result.size());
    List<ColumnLineage> columnLineages =
        result.get(0).getEdge().getLineageDetails().getColumnsLineage();
    assertNotNull(columnLineages);
    assertEquals(2, columnLineages.size());
  }

  @Test
  void mapRunEvent_withColumnLineageFromDifferentInputs_filtersCorrectly() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);

    String inputNamespace1 = "ns1";
    String inputName1 = "schema.table1";
    String inputNamespace2 = "ns2";
    String inputName2 = "schema.table2";
    OpenLineageInputDataset input1 = createInputDataset(inputNamespace1, inputName1);
    OpenLineageInputDataset input2 = createInputDataset(inputNamespace2, inputName2);

    String outputNamespace = "out-ns";
    String outputName = "schema.output_table";
    OpenLineageOutputDataset output = createOutputDataset(outputNamespace, outputName);

    InputField inputFieldFromTable1 =
        new InputField()
            .withNamespace(inputNamespace1)
            .withName(inputName1)
            .withField("col_from_t1");
    InputField inputFieldFromTable2 =
        new InputField()
            .withNamespace(inputNamespace2)
            .withName(inputName2)
            .withField("col_from_t2");

    ColumnLineageField columnLineageField =
        new ColumnLineageField()
            .withInputFields(List.of(inputFieldFromTable1, inputFieldFromTable2))
            .withTransformationDescription("MERGE");

    Fields fields = new Fields();
    fields.setAdditionalProperty("merged_col", columnLineageField);

    ColumnLineageFacet columnLineageFacet = new ColumnLineageFacet().withFields(fields);
    output.setOutputFacets(new OutputDatasetFacets().withColumnLineage(columnLineageFacet));

    event.setInputs(List.of(input1, input2));
    event.setOutputs(List.of(output));

    EntityReference inputRef1 = createEntityReference("i1", "svc.db.schema.table1");
    EntityReference inputRef2 = createEntityReference("i2", "svc.db.schema.table2");
    EntityReference outputRef = createEntityReference("o1", "svc.db.schema.output_table");

    when(entityResolver.resolveTable(input1)).thenReturn(inputRef1);
    when(entityResolver.resolveTable(input2)).thenReturn(inputRef2);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input1), eq(UPDATED_BY))).thenReturn(inputRef1);
    when(entityResolver.resolveOrCreateTable(eq(input2), eq(UPDATED_BY))).thenReturn(inputRef2);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    // 2 lineage edges (output <- input1, output <- input2)
    assertEquals(2, result.size());

    // Each edge should have column lineage filtered to the specific input
    for (AddLineage addLineage : result) {
      List<ColumnLineage> columnLineages =
          addLineage.getEdge().getLineageDetails().getColumnsLineage();
      assertNotNull(columnLineages);
      assertEquals(1, columnLineages.size());

      ColumnLineage cl = columnLineages.get(0);
      assertEquals(1, cl.getFromColumns().size());
    }
  }

  @Test
  void mapRunEvent_configuredEventFilter_processesMultipleEventTypes() {
    OpenLineageSettings settings =
        new OpenLineageSettings()
            .withEventTypeFilter(
                List.of(
                    OpenLineageEventType.COMPLETE,
                    OpenLineageEventType.START,
                    OpenLineageEventType.FAIL));

    mapper = new OpenLineageMapper(entityResolver, settings);

    OpenLineageInputDataset input = createInputDataset("ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("ns", "output_table");

    EntityReference inputRef = createEntityReference("i1", "svc.db.schema.input_table");
    EntityReference outputRef = createEntityReference("o1", "svc.db.schema.output_table");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    // Test START event
    OpenLineageRunEvent startEvent = createBaseEvent(EventType.START);
    startEvent.setInputs(List.of(input));
    startEvent.setOutputs(List.of(output));
    List<AddLineage> startResult = mapper.mapRunEvent(startEvent, UPDATED_BY);
    assertEquals(1, startResult.size());

    // Test FAIL event
    OpenLineageRunEvent failEvent = createBaseEvent(EventType.FAIL);
    failEvent.setInputs(List.of(input));
    failEvent.setOutputs(List.of(output));
    List<AddLineage> failResult = mapper.mapRunEvent(failEvent, UPDATED_BY);
    assertEquals(1, failResult.size());

    // Test RUNNING event (should be skipped as it's not in the filter)
    OpenLineageRunEvent runningEvent = createBaseEvent(EventType.RUNNING);
    runningEvent.setInputs(List.of(input));
    runningEvent.setOutputs(List.of(output));
    List<AddLineage> runningResult = mapper.mapRunEvent(runningEvent, UPDATED_BY);
    assertTrue(runningResult.isEmpty());
  }

  @Test
  void mapRunEvent_nullConfig_defaultsToCompleteOnly() {
    mapper = new OpenLineageMapper(entityResolver, null);

    OpenLineageInputDataset input = createInputDataset("ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("ns", "output_table");

    EntityReference inputRef = createEntityReference("i1", "svc.db.schema.input_table");
    EntityReference outputRef = createEntityReference("o1", "svc.db.schema.output_table");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    OpenLineageRunEvent completeEvent = createBaseEvent(EventType.COMPLETE);
    completeEvent.setInputs(List.of(input));
    completeEvent.setOutputs(List.of(output));
    List<AddLineage> completeResult = mapper.mapRunEvent(completeEvent, UPDATED_BY);
    assertEquals(1, completeResult.size());

    OpenLineageRunEvent startEvent = createBaseEvent(EventType.START);
    startEvent.setInputs(List.of(input));
    startEvent.setOutputs(List.of(output));
    List<AddLineage> startResult = mapper.mapRunEvent(startEvent, UPDATED_BY);
    assertTrue(startResult.isEmpty());
  }

  @Test
  void mapRunEvent_descriptionIncludesJobAndRunInfo() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    event.getJob().setNamespace("my-namespace");
    event.getJob().setName("my-job");

    OpenLineageInputDataset input = createInputDataset("ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("ns", "output_table");
    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    EntityReference inputRef = createEntityReference("i1", "svc.db.schema.input_table");
    EntityReference outputRef = createEntityReference("o1", "svc.db.schema.output_table");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertEquals(1, result.size());
    String description = result.get(0).getEdge().getLineageDetails().getDescription();
    assertNotNull(description);
    assertTrue(description.contains("OpenLineage"));
    assertTrue(description.contains("my-namespace"));
    assertTrue(description.contains("my-job"));
  }

  @Test
  void mapRunEvent_noColumnLineageFacet_noColumnLineageInResult() {
    OpenLineageRunEvent event = createBaseEvent(EventType.COMPLETE);
    OpenLineageInputDataset input = createInputDataset("ns", "input_table");
    OpenLineageOutputDataset output = createOutputDataset("ns", "output_table");
    event.setInputs(List.of(input));
    event.setOutputs(List.of(output));

    EntityReference inputRef = createEntityReference("i1", "svc.db.schema.input_table");
    EntityReference outputRef = createEntityReference("o1", "svc.db.schema.output_table");

    when(entityResolver.resolveTable(input)).thenReturn(inputRef);
    when(entityResolver.resolveOrCreateTable(eq(output), eq(UPDATED_BY))).thenReturn(outputRef);
    when(entityResolver.resolveOrCreateTable(eq(input), eq(UPDATED_BY))).thenReturn(inputRef);
    when(entityResolver.resolveOrCreatePipeline(anyString(), anyString(), eq(UPDATED_BY)))
        .thenReturn(null);

    List<AddLineage> result = mapper.mapRunEvent(event, UPDATED_BY);

    assertEquals(1, result.size());
    assertNull(result.get(0).getEdge().getLineageDetails().getColumnsLineage());
  }

  // Helper methods

  private OpenLineageRunEvent createBaseEvent(EventType eventType) {
    return new OpenLineageRunEvent()
        .withEventTime(new Date())
        .withProducer(URI.create("https://test.openlineage.io/producer"))
        .withSchemaURL(URI.create("https://openlineage.io/spec/1-0-5/OpenLineage.json"))
        .withEventType(eventType)
        .withRun(new OpenLineageRun().withRunId(UUID.randomUUID()))
        .withJob(new OpenLineageJob().withNamespace("test-namespace").withName("test-job"));
  }

  private OpenLineageInputDataset createInputDataset(String namespace, String name) {
    return new OpenLineageInputDataset().withNamespace(namespace).withName(name);
  }

  private OpenLineageOutputDataset createOutputDataset(String namespace, String name) {
    return new OpenLineageOutputDataset().withNamespace(namespace).withName(name);
  }

  private EntityReference createEntityReference(String id, String fqn) {
    return new EntityReference()
        .withId(
            UUID.fromString(
                "00000000-0000-0000-0000-" + String.format("%012d", id.hashCode() & 0xFFFFFFFFL)))
        .withType("table")
        .withFullyQualifiedName(fqn);
  }

  private EntityReference createPipelineReference(String id, String fqn) {
    return new EntityReference()
        .withId(
            UUID.fromString(
                "00000000-0000-0000-0000-" + String.format("%012d", id.hashCode() & 0xFFFFFFFFL)))
        .withType("pipeline")
        .withFullyQualifiedName(fqn);
  }
}
