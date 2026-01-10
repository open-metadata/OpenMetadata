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

import java.util.List;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.FlowElement;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SubProcess;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.Config__6;
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

  private SinkTaskDefinition createSinkTaskDefinition(String name, String sinkType) {
    SinkTaskDefinition definition = new SinkTaskDefinition();
    definition.setName(name);

    Config__6 taskConfig = new Config__6();
    taskConfig.setSinkType(Config__6.SinkType.fromValue(sinkType));
    taskConfig.setSyncMode(Config__6.SyncMode.OVERWRITE);
    taskConfig.setOutputFormat(Config__6.OutputFormat.YAML);
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

    Config__6 taskConfig = new Config__6();
    taskConfig.setSinkType(Config__6.SinkType.GIT);
    taskConfig.setSyncMode(Config__6.SyncMode.OVERWRITE);
    taskConfig.setOutputFormat(Config__6.OutputFormat.YAML);
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
