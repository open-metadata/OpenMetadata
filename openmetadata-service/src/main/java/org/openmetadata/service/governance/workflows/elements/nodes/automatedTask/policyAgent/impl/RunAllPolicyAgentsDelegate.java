package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.policyAgent.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline.RunIngestionPipelineImpl;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

@Slf4j
public class RunAllPolicyAgentsDelegate implements JavaDelegate {

  private static final String POLICY_GRANT_SUMMARY_VAR = "policyGrantSummary";

  private Expression inputNamespaceMapExpr;
  private Expression pipelineServiceClientExpr;
  private Expression waitForCompletionExpr;
  private Expression timeoutSecondsExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      PipelineServiceClientInterface pipelineServiceClient =
          (PipelineServiceClientInterface) pipelineServiceClientExpr.getValue(execution);
      boolean waitForCompletion =
          Boolean.parseBoolean((String) waitForCompletionExpr.getValue(execution));
      long timeoutSeconds = Long.parseLong((String) timeoutSecondsExpr.getValue(execution));

      EntityReference createdBy = resolveEntityReference(execution.getVariable("taskCreatedBy"));
      Object taskPayload = execution.getVariable("taskPayload");

      String entityLinkStr =
          (String)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE);
      EntityLink entityLink = EntityLink.parse(entityLinkStr);

      IngestionPipelineRepository repository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

      AssetClassification classified =
          classifyAssets(entityLink, repository, createdBy, taskPayload);
      List<PolicyAgentRunResult> results =
          runAutomatedInParallel(
              classified.automatedRuns(), pipelineServiceClient, waitForCompletion, timeoutSeconds);

      String summary = buildSummary(results, classified.manualItems());
      execution.setVariable(POLICY_GRANT_SUMMARY_VAR, summary);
      LOG.info("[PolicyAgent] Summary: {}", summary);

      setResult(varHandler, results, classified.manualItems());
    } catch (BpmnError bpmnError) {
      throw bpmnError;
    } catch (Exception exc) {
      LOG.error(
          "[PolicyAgent] RunAllPolicyAgentsDelegate failed in '{}': {}",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          exc.getMessage(),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private AssetClassification classifyAssets(
      EntityLink entityLink,
      IngestionPipelineRepository repository,
      EntityReference createdBy,
      Object taskPayload) {
    List<PolicyAgentRun> automatedRuns = new ArrayList<>();
    List<String> manualItems = new ArrayList<>();

    Map<String, ServiceTableAccumulator> serviceMap = buildServiceTableMap(entityLink, manualItems);

    for (ServiceTableAccumulator acc : serviceMap.values()) {
      Optional<IngestionPipeline> pipeline =
          PolicyAgentPipelineFinder.find(repository, acc.service());
      if (pipeline.isPresent()) {
        List<Map<String, Object>> policies =
            PolicyAgentPayloadBuilder.buildPolicies(acc.tables(), createdBy, taskPayload);
        automatedRuns.add(new PolicyAgentRun(acc.service().getName(), pipeline.get(), policies));
      } else {
        acc.tables().forEach(t -> manualItems.add(acc.service().getName() + "/" + t.getName()));
      }
    }

    return new AssetClassification(automatedRuns, manualItems);
  }

  private Map<String, ServiceTableAccumulator> buildServiceTableMap(
      EntityLink entityLink, List<String> manualItems) {
    Map<String, ServiceTableAccumulator> serviceMap = new LinkedHashMap<>();

    String entityType = entityLink.getEntityType();
    if (Entity.TABLE.equals(entityType)) {
      Table table = (Table) Entity.getEntity(entityLink, "*", Include.NON_DELETED);
      DatabaseService service =
          (DatabaseService)
              Entity.getEntity(table.getService(), "owners,ingestionRunner", Include.NON_DELETED);
      serviceMap.put(service.getFullyQualifiedName(), new ServiceTableAccumulator(service, table));
    } else if (Entity.DATA_PRODUCT.equals(entityType)) {
      DataProduct dp = (DataProduct) Entity.getEntity(entityLink, "", Include.NON_DELETED);
      DataProductRepository dpRepository =
          (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
      List<EntityReference> assets =
          dpRepository.getDataProductAssets(dp.getId(), 1000, 0).getData();

      for (EntityReference assetRef : assets) {
        if (Entity.TABLE.equals(assetRef.getType())) {
          Table table = (Table) Entity.getEntity(assetRef, "*", Include.NON_DELETED);
          DatabaseService service =
              (DatabaseService)
                  Entity.getEntity(
                      table.getService(), "owners,ingestionRunner", Include.NON_DELETED);
          serviceMap
              .computeIfAbsent(
                  service.getFullyQualifiedName(), k -> new ServiceTableAccumulator(service))
              .addTable(table);
        } else {
          manualItems.add(assetRef.getType() + "/" + assetRef.getName());
        }
      }
    } else {
      throw new IllegalArgumentException(
          "PolicyAgent does not support entity type '" + entityType + "'");
    }

    return serviceMap;
  }

  private List<PolicyAgentRunResult> runAutomatedInParallel(
      List<PolicyAgentRun> runs,
      PipelineServiceClientInterface pipelineServiceClient,
      boolean waitForCompletion,
      long timeoutSeconds) {
    if (runs.isEmpty()) {
      return Collections.emptyList();
    }

    try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
      List<CompletableFuture<PolicyAgentRunResult>> futures =
          runs.stream()
              .map(
                  run ->
                      CompletableFuture.supplyAsync(
                          () ->
                              executeSingleRun(
                                  run, pipelineServiceClient, waitForCompletion, timeoutSeconds),
                          executor))
              .toList();

      CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
      return futures.stream().map(CompletableFuture::join).toList();
    }
  }

  private PolicyAgentRunResult executeSingleRun(
      PolicyAgentRun run,
      PipelineServiceClientInterface pipelineServiceClient,
      boolean waitForCompletion,
      long timeoutSeconds) {
    try {
      IngestionPipelineRepository repository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      patchPolicies(repository, run.pipeline(), run.policies());
      boolean success =
          new RunIngestionPipelineImpl(pipelineServiceClient)
              .execute(run.pipeline().getId(), waitForCompletion, timeoutSeconds);
      return new PolicyAgentRunResult(run.serviceName(), success, null);
    } catch (Exception exc) {
      LOG.error(
          "[PolicyAgent] Run failed for service '{}': {}", run.serviceName(), exc.getMessage());
      return new PolicyAgentRunResult(run.serviceName(), false, exc.getMessage());
    }
  }

  private void patchPolicies(
      IngestionPipelineRepository repository,
      IngestionPipeline pipeline,
      List<Map<String, Object>> policies) {
    IngestionPipeline current = repository.get(null, pipeline.getId(), repository.getFields("*"));

    SourceConfig sourceConfig =
        current.getSourceConfig() != null ? current.getSourceConfig() : new SourceConfig();
    Map<String, Object> configMap = new HashMap<>();
    if (sourceConfig.getConfig() != null) {
      Map<?, ?> existing = JsonUtils.readOrConvertValue(sourceConfig.getConfig(), Map.class);
      if (existing != null) {
        existing.forEach((k, v) -> configMap.put(String.valueOf(k), v));
      }
    }
    configMap.put("policies", policies);
    sourceConfig.setConfig(configMap);
    current.setSourceConfig(sourceConfig);

    repository.createOrUpdate(null, current, "governance-bot");
    LOG.debug(
        "[PolicyAgent] Patched pipeline '{}' with {} policies",
        pipeline.getDisplayName(),
        policies.size());
  }

  private void setResult(
      WorkflowVariableHandler varHandler,
      List<PolicyAgentRunResult> results,
      List<String> manualItems) {
    long failedCount = results.stream().filter(r -> !r.success()).count();

    String result;
    if (results.stream().allMatch(PolicyAgentRunResult::success)
        && manualItems.isEmpty()
        && !results.isEmpty()) {
      result = "granted";
    } else {
      // Pipeline failures fall back to manual review so the owner can grant access
      // manually and see the error. The summary variable carries the failure details.
      result = "manual";
    }
    varHandler.setNodeVariable(RESULT_VARIABLE, result);
    if (failedCount > 0) {
      LOG.warn(
          "[PolicyAgent] {} service(s) failed policy enforcement; routing to manual review",
          failedCount);
    }
  }

  private String buildSummary(List<PolicyAgentRunResult> results, List<String> manualItems) {
    List<String> parts = new ArrayList<>();
    if (!results.isEmpty()) {
      long granted = results.stream().filter(PolicyAgentRunResult::success).count();
      if (granted > 0) {
        parts.add(granted + " service(s) auto-granted");
      }
      results.stream()
          .filter(r -> !r.success())
          .forEach(
              r ->
                  parts.add(
                      String.format(
                          "Policy enforcement failed for '%s' (manual grant required): %s",
                          r.serviceName(), r.error())));
    }
    if (!manualItems.isEmpty()) {
      parts.add(
          manualItems.size() + " asset(s) need manual grant: " + String.join(", ", manualItems));
    }
    return String.join("; ", parts);
  }

  private EntityReference resolveEntityReference(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof String stringValue) {
      return JsonUtils.readValue(stringValue, EntityReference.class);
    }
    return JsonUtils.convertValue(value, EntityReference.class);
  }

  // ---- Inner types ----

  private record PolicyAgentRun(
      String serviceName, IngestionPipeline pipeline, List<Map<String, Object>> policies) {}

  private record PolicyAgentRunResult(String serviceName, boolean success, String error) {}

  private record AssetClassification(
      List<PolicyAgentRun> automatedRuns, List<String> manualItems) {}

  private static final class ServiceTableAccumulator {
    private final DatabaseService service;
    private final List<Table> tables = new ArrayList<>();

    ServiceTableAccumulator(DatabaseService service) {
      this.service = service;
    }

    ServiceTableAccumulator(DatabaseService service, Table initialTable) {
      this.service = service;
      this.tables.add(initialTable);
    }

    void addTable(Table table) {
      tables.add(table);
    }

    DatabaseService service() {
      return service;
    }

    List<Table> tables() {
      return tables;
    }
  }
}
