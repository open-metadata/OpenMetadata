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

package org.openmetadata.service.util;

import static org.openmetadata.service.util.OpenMetadataOperations.printToAsciiTable;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.repository.ProcessDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

@Slf4j
public class FlowableCleanup {

  private final WorkflowHandler workflowHandler;
  private final boolean dryRun;

  public FlowableCleanup(WorkflowHandler workflowHandler, boolean dryRun) {
    this.workflowHandler = workflowHandler;
    this.dryRun = dryRun;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class WorkflowCleanupInfo {
    private String workflowKey;
    private String workflowName;
    private String triggerType;
    private String processDefinitionId;
    private long deploymentCount;
    private long runtimeInstanceCount;
    private long historicInstanceCount;
    private boolean cleanupRuntimeInstances;
    private boolean cleanupDeployments;
    private String cleanupReason;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class FlowableCleanupResult {
    private int totalDeploymentsScanned;
    private int periodicBatchWorkflowsFound;
    private int eventBasedWorkflowsFound;
    private int runtimeInstancesDeleted;
    private int historicInstancesDeleted;
    private int deploymentsDeleted;
    private List<WorkflowCleanupInfo> cleanedWorkflows;
    private Map<String, Integer> cleanupByTriggerType;
  }

  public FlowableCleanupResult performCleanup(int historyBatchSize, int runtimeBatchSize) {
    LOG.info(
        "Starting Flowable cleanup. Dry run: {}, History batch: {}, Runtime batch: {}",
        dryRun,
        historyBatchSize,
        runtimeBatchSize);

    FlowableCleanupResult result =
        FlowableCleanupResult.builder()
            .cleanedWorkflows(new ArrayList<>())
            .cleanupByTriggerType(new HashMap<>())
            .build();

    try {
      // Get all workflow definitions to understand trigger types
      WorkflowDefinitionRepository workflowDefRepo =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

      List<WorkflowDefinition> allWorkflowDefinitions =
          workflowDefRepo.listAll(
              EntityUtil.Fields.EMPTY_FIELDS, new org.openmetadata.service.jdbi3.ListFilter());

      // Get all process definitions from Flowable
      var repositoryService =
          workflowHandler.getProcessEngineConfiguration().getRepositoryService();
      var historyService = workflowHandler.getProcessEngineConfiguration().getHistoryService();
      var allProcessDefinitions = repositoryService.createProcessDefinitionQuery().list();

      result.setTotalDeploymentsScanned(allProcessDefinitions.size());
      LOG.info(
          "Found {} total process definitions and {} workflow definitions",
          allProcessDefinitions.size(),
          allWorkflowDefinitions.size());

      // Create mapping of workflow names to trigger types
      Map<String, String> workflowTriggerTypes = createWorkflowTriggerMap(allWorkflowDefinitions);

      // Group process definitions by key and find old versions + latest versions
      Map<String, List<org.flowable.engine.repository.ProcessDefinition>> byKey =
          allProcessDefinitions.stream()
              .collect(
                  java.util.stream.Collectors.groupingBy(
                      org.flowable.engine.repository.ProcessDefinition::getKey));

      LOG.debug("Grouping {} process definitions by key:", allProcessDefinitions.size());
      for (Map.Entry<String, List<org.flowable.engine.repository.ProcessDefinition>> entry :
          byKey.entrySet()) {
        LOG.debug("  - Key '{}': {} versions", entry.getKey(), entry.getValue().size());
        for (org.flowable.engine.repository.ProcessDefinition pd : entry.getValue()) {
          LOG.debug("    - Version {}: id={}", pd.getVersion(), pd.getId());
        }
      }

      List<org.flowable.engine.repository.ProcessDefinition> definitionsToCleanup =
          new ArrayList<>();
      List<org.flowable.engine.repository.ProcessDefinition> latestDefinitionsForHistoryCleanup =
          new ArrayList<>();

      for (Map.Entry<String, List<org.flowable.engine.repository.ProcessDefinition>> entry :
          byKey.entrySet()) {
        String key = entry.getKey();
        List<org.flowable.engine.repository.ProcessDefinition> defsForKey = entry.getValue();

        // Find highest version for this key
        org.flowable.engine.repository.ProcessDefinition latest =
            defsForKey.stream()
                .max(
                    java.util.Comparator.comparingInt(
                        org.flowable.engine.repository.ProcessDefinition::getVersion))
                .orElse(null);

        if (latest != null) {
          LOG.info("Key '{}': Latest version {} (id={})", key, latest.getVersion(), latest.getId());
        }

        // Mark all non-latest as "old" for full cleanup
        for (org.flowable.engine.repository.ProcessDefinition pd : defsForKey) {
          if (latest == null || !pd.getId().equals(latest.getId())) {
            definitionsToCleanup.add(pd);
            LOG.debug(
                "  - Adding to OLD cleanup: {} v{} (id={})",
                pd.getKey(),
                pd.getVersion(),
                pd.getId());
          } else {
            LOG.debug(
                "  - LATEST version: {} v{} (id={})", pd.getKey(), pd.getVersion(), pd.getId());
          }
        }

        // Add latest version for history-only cleanup
        if (latest != null) {
          latestDefinitionsForHistoryCleanup.add(latest);
        }
      }

      // Process old deployments (non-latest versions) for full cleanup
      for (org.flowable.engine.repository.ProcessDefinition pd : definitionsToCleanup) {
        WorkflowCleanupInfo cleanupInfo = analyzeWorkflowForCleanup(pd, workflowTriggerTypes);

        if (cleanupInfo != null) {
          result.getCleanedWorkflows().add(cleanupInfo);
          result.getCleanupByTriggerType().merge(cleanupInfo.getTriggerType(), 1, Integer::sum);

          if (cleanupInfo.getTriggerType().equals("periodicBatchEntity")) {
            result.setPeriodicBatchWorkflowsFound(result.getPeriodicBatchWorkflowsFound() + 1);
          } else if (cleanupInfo.getTriggerType().equals("eventBasedEntity")) {
            result.setEventBasedWorkflowsFound(result.getEventBasedWorkflowsFound() + 1);
          }
        }
      }

      // Process latest deployments for history-only cleanup
      for (org.flowable.engine.repository.ProcessDefinition pd :
          latestDefinitionsForHistoryCleanup) {
        WorkflowCleanupInfo cleanupInfo = analyzeWorkflowForCleanup(pd, workflowTriggerTypes);

        if (cleanupInfo != null) {
          // Override settings for latest deployments - never cleanup runtime instances or
          // deployments
          cleanupInfo.setCleanupRuntimeInstances(false);
          cleanupInfo.setCleanupDeployments(false);
          cleanupInfo.setCleanupReason("Latest deployment - history cleanup only");

          result.getCleanedWorkflows().add(cleanupInfo);
          result
              .getCleanupByTriggerType()
              .merge(cleanupInfo.getTriggerType() + " (latest)", 1, Integer::sum);

          if (cleanupInfo.getTriggerType().equals("periodicBatchEntity")) {
            result.setPeriodicBatchWorkflowsFound(result.getPeriodicBatchWorkflowsFound() + 1);
          } else if (cleanupInfo.getTriggerType().equals("eventBasedEntity")) {
            result.setEventBasedWorkflowsFound(result.getEventBasedWorkflowsFound() + 1);
          }
        }
      }

      if (result.getCleanedWorkflows().isEmpty()) {
        LOG.info("No deployments found that require cleanup");
        return result;
      }

      // Display analysis results
      displayCleanupPlan(result);

      // Perform actual cleanup if not dry run
      if (!dryRun) {
        performActualCleanup(result, definitionsToCleanup, historyBatchSize, runtimeBatchSize);
      }

      LOG.info(
          "Flowable cleanup completed. Scanned: {}, Periodic Batch: {}, Event Based: {}, "
              + "Runtime deleted: {}, Historic deleted: {}, Deployments deleted: {}",
          result.getTotalDeploymentsScanned(),
          result.getPeriodicBatchWorkflowsFound(),
          result.getEventBasedWorkflowsFound(),
          result.getRuntimeInstancesDeleted(),
          result.getHistoricInstancesDeleted(),
          result.getDeploymentsDeleted());

    } catch (Exception e) {
      LOG.error("Error during Flowable cleanup", e);
      throw new RuntimeException("Flowable cleanup failed", e);
    }

    return result;
  }

  private Map<String, String> createWorkflowTriggerMap(List<WorkflowDefinition> workflowDefs) {
    Map<String, String> triggerMap = new HashMap<>();

    LOG.info("Processing {} workflow definitions for trigger mapping:", workflowDefs.size());
    for (WorkflowDefinition wf : workflowDefs) {
      if (wf.getTrigger() != null) {
        String triggerType = wf.getTrigger().getType();
        triggerMap.put(wf.getName(), triggerType);
        LOG.info("  - Workflow '{}' has trigger type '{}'", wf.getName(), triggerType);
      } else {
        LOG.warn("  - Workflow '{}' has NO trigger defined", wf.getName());
      }
    }

    LOG.info("Created workflow trigger map with {} entries: {}", triggerMap.size(), triggerMap);
    return triggerMap;
  }

  private WorkflowCleanupInfo analyzeWorkflowForCleanup(
      org.flowable.engine.repository.ProcessDefinition pd,
      Map<String, String> workflowTriggerTypes) {

    String processKey = pd.getKey();
    String baseWorkflowName = extractBaseWorkflowName(processKey);

    String triggerType = workflowTriggerTypes.getOrDefault(baseWorkflowName, "unknown");

    LOG.debug(
        "Analyzing process '{}' -> base name '{}' -> trigger type '{}'",
        processKey,
        baseWorkflowName,
        triggerType);

    var runtimeService = workflowHandler.getProcessEngineConfiguration().getRuntimeService();
    var historyService = workflowHandler.getProcessEngineConfiguration().getHistoryService();

    long runtimeCount =
        runtimeService.createProcessInstanceQuery().processDefinitionId(pd.getId()).count();
    long historicCount =
        historyService
            .createHistoricProcessInstanceQuery()
            .processDefinitionId(pd.getId())
            .finished()
            .count();

    boolean cleanupRuntime;
    boolean cleanupDeployments;
    String cleanupReason;

    switch (triggerType) {
      case "eventBasedEntity" -> {
        // Event-based triggers: ONLY cleanup histories, NEVER deployments
        cleanupRuntime = false;
        cleanupDeployments = false;
        cleanupReason = "Event Based Entity workflow - history only";
      }
      case "periodicBatchEntity" -> {
        cleanupRuntime = true;
        cleanupDeployments = true;
        cleanupReason = "Periodic Batch workflow - full cleanup";
      }
      case "noOp" -> {
        cleanupRuntime = false;
        cleanupDeployments = false;
        cleanupReason = "NoOp workflow - history only";
      }
      default -> {
        cleanupRuntime = false;
        cleanupDeployments = false;
        cleanupReason = "Unknown trigger type - history only";
      }
    }

    return WorkflowCleanupInfo.builder()
        .workflowKey(processKey)
        .workflowName(baseWorkflowName)
        .triggerType(triggerType)
        .processDefinitionId(pd.getId()) // crucial: per-definition
        .deploymentCount(1L)
        .runtimeInstanceCount(runtimeCount)
        .historicInstanceCount(historicCount)
        .cleanupRuntimeInstances(cleanupRuntime)
        .cleanupDeployments(cleanupDeployments)
        .cleanupReason(cleanupReason)
        .build();
  }

  /**
   * Extract the base workflow name from a process key, handling both simple and entity-specific triggers.
   *
   * @param processKey The Flowable process definition key
   * @return The base workflow name for looking up trigger types
   */
  private String extractBaseWorkflowName(String processKey) {
    // Handle entity-specific triggers: WorkflowTrigger-entity → Workflow
    if (processKey.contains("Trigger-")) {
      int triggerIndex = processKey.indexOf("Trigger-");
      return processKey.substring(0, triggerIndex);
    }

    // Handle simple triggers: WorkflowTrigger → Workflow
    if (processKey.endsWith("Trigger")) {
      return TriggerFactory.getMainWorkflowDefinitionNameFromTrigger(processKey);
    }

    // Main workflow
    return processKey;
  }

  private void displayCleanupPlan(FlowableCleanupResult result) {
    if (result.getCleanedWorkflows().isEmpty()) {
      LOG.info("No workflow deployments require cleanup");
      return;
    }

    LOG.info("Found {} old workflow deployments for cleanup", result.getCleanedWorkflows().size());

    List<String> columns =
        Arrays.asList(
            "Workflow Key",
            "Trigger Type",
            "Runtime Instances",
            "Historic Instances",
            "Cleanup Runtime",
            "Cleanup Deployments",
            "Reason");

    List<List<String>> rows = new ArrayList<>();
    for (WorkflowCleanupInfo info : result.getCleanedWorkflows()) {
      rows.add(
          Arrays.asList(
              info.getWorkflowKey(),
              info.getTriggerType(),
              String.valueOf(info.getRuntimeInstanceCount()),
              String.valueOf(info.getHistoricInstanceCount()),
              String.valueOf(info.isCleanupRuntimeInstances()),
              String.valueOf(info.isCleanupDeployments()),
              info.getCleanupReason()));
    }

    printToAsciiTable(columns, rows, "No workflows found for cleanup");
    displayCleanupSummary(result);
  }

  private void displayCleanupSummary(FlowableCleanupResult result) {
    if (!result.getCleanupByTriggerType().isEmpty()) {
      LOG.info("Cleanup summary by trigger type:");
      List<String> summaryColumns = Arrays.asList("Trigger Type", "Count");
      List<List<String>> summaryRows = new ArrayList<>();

      result.getCleanupByTriggerType().entrySet().stream()
          .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
          .forEach(
              entry -> summaryRows.add(Arrays.asList(entry.getKey(), entry.getValue().toString())));

      printToAsciiTable(summaryColumns, summaryRows, "No trigger type statistics");
    }
  }

  private void performActualCleanup(
      FlowableCleanupResult result,
      List<ProcessDefinition> definitionsToCleanup,
      int historyBatchSize,
      int runtimeBatchSize) {

    LOG.info(
        "Performing actual cleanup of {} workflow entries", result.getCleanedWorkflows().size());

    var runtimeService = workflowHandler.getProcessEngineConfiguration().getRuntimeService();
    var historyService = workflowHandler.getProcessEngineConfiguration().getHistoryService();
    var repositoryService = workflowHandler.getProcessEngineConfiguration().getRepositoryService();

    int totalRuntimeDeleted = 0;
    int totalHistoricDeleted = 0;
    int totalDeploymentsDeleted = 0;

    // Get all process definitions for lookup - not just the ones to cleanup
    var allProcessDefinitions = repositoryService.createProcessDefinitionQuery().list();
    Map<String, ProcessDefinition> defsById =
        allProcessDefinitions.stream().collect(Collectors.toMap(ProcessDefinition::getId, d -> d));

    for (WorkflowCleanupInfo info : result.getCleanedWorkflows()) {
      try {
        ProcessDefinition pd = defsById.get(info.getProcessDefinitionId());

        if (pd == null) {
          LOG.warn(
              "Could not find process definition for id {} (workflow key: {})",
              info.getProcessDefinitionId(),
              info.getWorkflowKey());
          continue;
        }

        String processDefinitionId = pd.getId();

        if (info.isCleanupRuntimeInstances()) {
          int runtimeDeleted =
              deleteRuntimeInstances(runtimeService, processDefinitionId, runtimeBatchSize);
          totalRuntimeDeleted += runtimeDeleted;
          LOG.info(
              "Deleted {} runtime instances for workflow {} (definition id={})",
              runtimeDeleted,
              info.getWorkflowKey(),
              processDefinitionId);
        }

        int historicDeleted =
            deleteHistoricInstances(historyService, processDefinitionId, historyBatchSize);
        totalHistoricDeleted += historicDeleted;
        LOG.info(
            "Deleted {} historic instances for workflow {} (definition id={})",
            historicDeleted,
            info.getWorkflowKey(),
            processDefinitionId);

        if (info.isCleanupDeployments()) {
          repositoryService.deleteDeployment(pd.getDeploymentId(), false);
          totalDeploymentsDeleted++;
          LOG.info(
              "Deleted deployment {} for workflow {} (definition id={})",
              pd.getDeploymentId(),
              info.getWorkflowKey(),
              processDefinitionId);
        }

      } catch (Exception e) {
        LOG.error(
            "Failed to cleanup workflow {} (definition id={}): {}",
            info.getWorkflowKey(),
            info.getProcessDefinitionId(),
            e.getMessage(),
            e);
      }
    }

    result.setRuntimeInstancesDeleted(totalRuntimeDeleted);
    result.setHistoricInstancesDeleted(totalHistoricDeleted);
    result.setDeploymentsDeleted(totalDeploymentsDeleted);
  }

  private int deleteRuntimeInstances(
      org.flowable.engine.RuntimeService runtimeService,
      String processDefinitionId,
      int batchSize) {

    int totalDeleted = 0;

    while (true) {
      List<org.flowable.engine.runtime.ProcessInstance> batch =
          runtimeService
              .createProcessInstanceQuery()
              .processDefinitionId(processDefinitionId)
              .listPage(0, batchSize);

      if (batch.isEmpty()) {
        break;
      }

      for (org.flowable.engine.runtime.ProcessInstance pi : batch) {
        runtimeService.deleteProcessInstance(pi.getId(), "Cleanup old workflow version");
        totalDeleted++;
      }
    }

    return totalDeleted;
  }

  private int deleteHistoricInstances(
      org.flowable.engine.HistoryService historyService,
      String processDefinitionId,
      int batchSize) {

    int totalDeleted = 0;

    while (true) {
      var query =
          historyService
              .createHistoricProcessInstanceQuery()
              .processDefinitionId(processDefinitionId)
              .finished();

      List<org.flowable.engine.history.HistoricProcessInstance> batch =
          query.listPage(0, batchSize);

      if (batch.isEmpty()) {
        break;
      }

      List<String> ids =
          batch.stream()
              .map(org.flowable.engine.history.HistoricProcessInstance::getId)
              .collect(java.util.stream.Collectors.toList());

      historyService.bulkDeleteHistoricProcessInstances(ids);
      totalDeleted += ids.size();
    }

    return totalDeleted;
  }
}
