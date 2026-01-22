/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;

import java.util.List;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowElement;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.SubProcess;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.Config__8;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.EntityFilter;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.HierarchyConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.InputNamespaceMap__8;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.SinkTask;

class SinkTaskTest {

  @Test
  void testSinkTaskCreation() {
    SinkTaskDefinition definition = createSinkTaskDefinition("testSink", "webhook");
    WorkflowConfiguration config = createWorkflowConfiguration(false);

    SinkTask sinkTask = new SinkTask(definition, config);

    assertNotNull(sinkTask);
    assertNotNull(sinkTask.getRuntimeExceptionBoundaryEvent());
  }

  @Test
  void testSinkTaskAddToWorkflow() {
    SinkTaskDefinition definition = createSinkTaskDefinition("testSink", "webhook");
    WorkflowConfiguration config = createWorkflowConfiguration(false);

    SinkTask sinkTask = new SinkTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    sinkTask.addToWorkflow(model, process);

    // Verify the subprocess was added - check by iterating flow elements
    boolean found = false;
    for (FlowElement element : process.getFlowElements()) {
      if ("testSink".equals(element.getId()) && element instanceof SubProcess) {
        found = true;
        SubProcess subProcess = (SubProcess) element;
        // Verify subprocess contains expected elements
        assertNotNull(subProcess.getFlowElement("testSink.startEvent"), "Should have start event");
        assertNotNull(
            subProcess.getFlowElement("testSink.executeSink"), "Should have execute sink task");
        assertNotNull(subProcess.getFlowElement("testSink.endEvent"), "Should have end event");
        break;
      }
    }
    assertTrue(found, "Subprocess should be added to the process");
  }

  @Test
  void testSinkTaskWithStageStatusTracking() {
    SinkTaskDefinition definition = createSinkTaskDefinition("trackedSink", "git");
    WorkflowConfiguration config = createWorkflowConfiguration(true);

    SinkTask sinkTask = new SinkTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    sinkTask.addToWorkflow(model, process);

    // Verify subprocess was added (stage status tracking adds listeners)
    boolean found = false;
    for (FlowElement element : process.getFlowElements()) {
      if ("trackedSink".equals(element.getId())) {
        found = true;
        break;
      }
    }
    assertTrue(found, "Subprocess should be added");

    // Verify boundary event was added
    assertNotNull(sinkTask.getRuntimeExceptionBoundaryEvent());
  }

  @Test
  void testSinkTaskWithDifferentSinkTypes() {
    String[] sinkTypes = {"git", "webhook", "httpEndpoint"};

    for (String sinkType : sinkTypes) {
      SinkTaskDefinition definition = createSinkTaskDefinition("sink_" + sinkType, sinkType);
      WorkflowConfiguration config = createWorkflowConfiguration(false);

      SinkTask sinkTask = new SinkTask(definition, config);

      BpmnModel model = new BpmnModel();
      Process process = new Process();
      process.setId("testProcess_" + sinkType);
      model.addProcess(process);

      sinkTask.addToWorkflow(model, process);

      boolean found = false;
      for (FlowElement element : process.getFlowElements()) {
        if (("sink_" + sinkType).equals(element.getId())) {
          found = true;
          break;
        }
      }
      assertTrue(found, "Subprocess for " + sinkType + " should be created");
    }
  }

  @Test
  void testSinkTaskWithAllConfigOptions() {
    SinkTaskDefinition definition = createFullSinkTaskDefinition();
    WorkflowConfiguration config = createWorkflowConfiguration(true);

    SinkTask sinkTask = new SinkTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("fullConfigProcess");
    model.addProcess(process);

    sinkTask.addToWorkflow(model, process);

    boolean found = false;
    SubProcess subProcess = null;
    for (FlowElement element : process.getFlowElements()) {
      if ("fullConfigSink".equals(element.getId()) && element instanceof SubProcess) {
        found = true;
        subProcess = (SubProcess) element;
        break;
      }
    }
    assertTrue(found, "Subprocess should be found");
    assertNotNull(subProcess);

    // Verify the service task exists
    FlowElement serviceTask = subProcess.getFlowElement("fullConfigSink.executeSink");
    assertNotNull(serviceTask, "Service task should exist in subprocess");
  }

  @Test
  void testBoundaryEventAttachment() {
    SinkTaskDefinition definition = createSinkTaskDefinition("boundaryTestSink", "webhook");
    WorkflowConfiguration config = createWorkflowConfiguration(true);

    SinkTask sinkTask = new SinkTask(definition, config);

    assertNotNull(sinkTask.getRuntimeExceptionBoundaryEvent());
    // Verify boundary event has the expected ID pattern
    assertTrue(
        sinkTask
            .getRuntimeExceptionBoundaryEvent()
            .getId()
            .contains("runtimeExceptionBoundaryEvent"),
        "Boundary event should have correct ID pattern");
    // Verify attached reference is set (the Activity object)
    assertNotNull(
        sinkTask.getRuntimeExceptionBoundaryEvent().getAttachedToRef(),
        "Boundary event should have attached reference");
    assertEquals(
        "boundaryTestSink",
        sinkTask.getRuntimeExceptionBoundaryEvent().getAttachedToRef().getId(),
        "Attached subprocess should have correct ID");
  }

  @Test
  void testEntityListVariableInInputNamespaceMap() {
    SinkTaskDefinition definition = createSinkTaskDefinition("batchSink", "git");
    WorkflowConfiguration config = createWorkflowConfiguration(false);

    SinkTask sinkTask = new SinkTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    sinkTask.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "batchSink");
    assertNotNull(subProcess, "Subprocess should exist");

    ServiceTask serviceTask = (ServiceTask) subProcess.getFlowElement("batchSink.executeSink");
    assertNotNull(serviceTask, "Service task should exist");

    // Find the inputNamespaceMapExpr field extension
    FieldExtension namespaceMapExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "inputNamespaceMapExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(namespaceMapExt, "inputNamespaceMapExpr field should exist");

    String namespaceMapJson = namespaceMapExt.getStringValue();
    assertNotNull(namespaceMapJson, "Namespace map should not be null");
    assertTrue(
        namespaceMapJson.contains(ENTITY_LIST_VARIABLE),
        "Namespace map should contain entityList variable");
    assertTrue(
        namespaceMapJson.contains(GLOBAL_NAMESPACE),
        "entityList should be mapped to global namespace");
  }

  @Test
  void testBatchModeFieldExtension() {
    SinkTaskDefinition definition = createSinkTaskDefinition("batchModeSink", "git");
    WorkflowConfiguration config = createWorkflowConfiguration(false);

    SinkTask sinkTask = new SinkTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    sinkTask.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "batchModeSink");
    assertNotNull(subProcess, "Subprocess should exist");

    ServiceTask serviceTask = (ServiceTask) subProcess.getFlowElement("batchModeSink.executeSink");
    assertNotNull(serviceTask, "Service task should exist");

    // Find the batchModeExpr field extension
    FieldExtension batchModeExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "batchModeExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(batchModeExt, "batchModeExpr field should exist");
    assertEquals("true", batchModeExt.getStringValue(), "batchMode should be true");
  }

  @Test
  void testBatchModeFalse() {
    SinkTaskDefinition definition = createSinkTaskDefinition("singleModeSink", "webhook");
    // Set batch mode to false
    definition.getConfig().setBatchMode(false);
    WorkflowConfiguration config = createWorkflowConfiguration(false);

    SinkTask sinkTask = new SinkTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    sinkTask.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "singleModeSink");
    assertNotNull(subProcess, "Subprocess should exist");

    ServiceTask serviceTask = (ServiceTask) subProcess.getFlowElement("singleModeSink.executeSink");
    assertNotNull(serviceTask, "Service task should exist");

    FieldExtension batchModeExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "batchModeExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(batchModeExt, "batchModeExpr field should exist");
    assertEquals("false", batchModeExt.getStringValue(), "batchMode should be false");
  }

  @Test
  void testEntityListDefaultsToGlobalNamespace() {
    SinkTaskDefinition definition = new SinkTaskDefinition();
    definition.setName("noNamespaceMapSink");

    Config__8 taskConfig = new Config__8();
    taskConfig.setSinkType(Config__8.SinkType.GIT);
    taskConfig.setSyncMode(Config__8.SyncMode.OVERWRITE);
    taskConfig.setOutputFormat(Config__8.OutputFormat.YAML);
    taskConfig.setBatchMode(true);
    taskConfig.setTimeoutSeconds(300);

    SinkConfig sinkConfig = new SinkConfig();
    sinkConfig.setAdditionalProperty("repositoryUrl", "https://github.com/org/repo.git");
    taskConfig.setSinkConfig(sinkConfig);

    definition.setConfig(taskConfig);
    // Note: No inputNamespaceMap set

    WorkflowConfiguration config = createWorkflowConfiguration(false);
    SinkTask sinkTask = new SinkTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    sinkTask.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "noNamespaceMapSink");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("noNamespaceMapSink.executeSink");

    FieldExtension namespaceMapExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "inputNamespaceMapExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(
        namespaceMapExt, "inputNamespaceMapExpr field should exist even without explicit map");
    assertTrue(
        namespaceMapExt.getStringValue().contains(ENTITY_LIST_VARIABLE),
        "entityList should be auto-added to namespace map");
  }

  private SubProcess findSubProcess(Process process, String id) {
    for (FlowElement element : process.getFlowElements()) {
      if (id.equals(element.getId()) && element instanceof SubProcess) {
        return (SubProcess) element;
      }
    }
    return null;
  }

  private SinkTaskDefinition createSinkTaskDefinition(String name, String sinkType) {
    SinkTaskDefinition definition = new SinkTaskDefinition();
    definition.setName(name);

    Config__8 taskConfig = new Config__8();
    taskConfig.setSinkType(Config__8.SinkType.fromValue(sinkType));
    taskConfig.setSyncMode(Config__8.SyncMode.OVERWRITE);
    taskConfig.setOutputFormat(Config__8.OutputFormat.YAML);
    taskConfig.setBatchMode(true);
    taskConfig.setTimeoutSeconds(300);

    SinkConfig sinkConfig = new SinkConfig();
    sinkConfig.setAdditionalProperty("endpoint", "https://example.com/webhook");
    taskConfig.setSinkConfig(sinkConfig);

    definition.setConfig(taskConfig);

    InputNamespaceMap__8 namespaceMap = new InputNamespaceMap__8();
    namespaceMap.setRelatedEntity("global");
    definition.setInputNamespaceMap(namespaceMap);

    return definition;
  }

  private SinkTaskDefinition createFullSinkTaskDefinition() {
    SinkTaskDefinition definition = new SinkTaskDefinition();
    definition.setName("fullConfigSink");
    definition.setDisplayName("Full Config Sink Task");
    definition.setDescription("A sink task with all configuration options");

    Config__8 taskConfig = new Config__8();
    taskConfig.setSinkType(Config__8.SinkType.GIT);
    taskConfig.setSyncMode(Config__8.SyncMode.OVERWRITE);
    taskConfig.setOutputFormat(Config__8.OutputFormat.YAML);
    taskConfig.setBatchMode(true);
    taskConfig.setTimeoutSeconds(600);

    // Git sink config using additionalProperties
    SinkConfig sinkConfig = new SinkConfig();
    sinkConfig.setAdditionalProperty("repositoryUrl", "https://github.com/org/repo.git");
    sinkConfig.setAdditionalProperty("branch", "main");
    sinkConfig.setAdditionalProperty("basePath", "metadata");
    taskConfig.setSinkConfig(sinkConfig);

    // Entity filter
    EntityFilter entityFilter = new EntityFilter();
    entityFilter.setEntityTypes(List.of("table", "dashboard"));
    entityFilter.setDomains(List.of("marketing"));
    taskConfig.setEntityFilter(entityFilter);

    // Hierarchy config
    HierarchyConfig hierarchyConfig = new HierarchyConfig();
    hierarchyConfig.setPreserveHierarchy(true);
    hierarchyConfig.setRootPath("metadata");
    taskConfig.setHierarchyConfig(hierarchyConfig);

    definition.setConfig(taskConfig);

    InputNamespaceMap__8 namespaceMap = new InputNamespaceMap__8();
    namespaceMap.setRelatedEntity("global");
    definition.setInputNamespaceMap(namespaceMap);

    return definition;
  }

  private WorkflowConfiguration createWorkflowConfiguration(boolean storeStageStatus) {
    WorkflowConfiguration config = new WorkflowConfiguration();
    config.setStoreStageStatus(storeStageStatus);
    return config;
  }
}
