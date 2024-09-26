package org.openmetadata.service.governance.workflows;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.converter.BpmnXMLConverter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.FlowElement;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SignalEventDefinition;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.impl.cfg.StandaloneProcessEngineConfiguration;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.Execution;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.eventsubscription.api.EventSubscription;
import org.flowable.task.api.Task;
import org.openmetadata.schema.governanceWorkflows.WorkflowInstanceState;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class WorkflowHandler {
  private final RepositoryService repositoryService;
  private final RuntimeService runtimeService;
  private final TaskService taskService;
  private static WorkflowHandler instance;
  private static volatile boolean initialized = false;

  private WorkflowHandler(OpenMetadataApplicationConfig config) {
    ProcessEngineConfiguration processEngineConfiguration =
        new StandaloneProcessEngineConfiguration()
            .setJdbcUrl(config.getDataSourceFactory().getUrl())
            .setJdbcUsername(config.getDataSourceFactory().getUser())
            .setJdbcPassword(config.getDataSourceFactory().getPassword())
            .setJdbcDriver(config.getDataSourceFactory().getDriverClass())
            .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_FALSE);

    if (ConnectionType.MYSQL.label.equals(config.getDataSourceFactory().getDriverClass())) {
      processEngineConfiguration.setDatabaseType(ProcessEngineConfiguration.DATABASE_TYPE_MYSQL);
    } else {
      processEngineConfiguration.setDatabaseType(ProcessEngineConfiguration.DATABASE_TYPE_POSTGRES);
    }

    ProcessEngine processEngine = processEngineConfiguration.buildProcessEngine();

    this.repositoryService = processEngine.getRepositoryService();
    this.runtimeService = processEngine.getRuntimeService();
    this.taskService = processEngine.getTaskService();
  }

  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!initialized) {
      instance = new WorkflowHandler(config);
      initialized = true;
    } else {
      LOG.info("WorkflowHandler already initialized.");
    }
  }

  public static WorkflowHandler getInstance() {
    if (initialized) return instance;
    throw new UnhandledServerException("WorkflowHandler is not initialized.");
  }

  public void deploy(Workflow workflow) {
    BpmnXMLConverter bpmnXMLConverter = new BpmnXMLConverter();
    byte[] bpmnBytes = bpmnXMLConverter.convertToXML(workflow.getModel());
    repositoryService
        .createDeployment()
        .addBytes(String.format("%s-workflow.bpmn20.xml", workflow.getModelId()), bpmnBytes)
        .name(workflow.getModelId())
        .deploy();
  }

  public void triggerByKey(String processKey, Map<String, Object> variables) {
    ProcessInstance processInstance = runtimeService.startProcessInstanceByKey(processKey, variables);
    String processInstanceId = processInstance.getProcessInstanceId();
    String processDefinitionKey = processInstance.getProcessDefinitionKey();

    WorkflowDefinitionRepository workflowDefinitionRepository = (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    EntityReference workflowDefinitionReference = workflowDefinitionRepository.getByName(null, processDefinitionKey, new EntityUtil.Fields(Set.of("*"))).getEntityReference();

    WorkflowInstanceStateRepository workflowInstanceStateRepository = (WorkflowInstanceStateRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);
    workflowInstanceStateRepository.createNewRecord(
            new WorkflowInstanceState()
                    .withState(WorkflowInstanceState.State.CREATED)
                    .withWorkflowInstanceId(processInstanceId)
                    .withTimestamp(System.currentTimeMillis())
                    .withWorkflowDefinitionReference(workflowDefinitionReference), String.format("%s.%s", processDefinitionKey, processInstanceId));

    // NOTE: Get the correct execution ID for the waiting task.
    List<Execution> executions = runtimeService.createExecutionQuery()
            .processInstanceId(processInstanceId)
            .messageEventSubscriptionName("WorkflowInstanceStateReady")
            .list();

    for (Execution execution : executions) {
      runtimeService.messageEventReceived("WorkflowInstanceStateReady", execution.getId());
    }

  }

  public void triggerWithSignal(String signal, Map<String, Object> variables) {
    List<String> processKeys = listProcessKeysForSignal(signal);

    for (String processKey : processKeys) {
      triggerByKey(processKey, variables);
    }
  }

  public void resolveTask(UUID taskId) {
    resolveTask(taskId, null);
  }

  public void resolveTask(UUID taskId, Map<String, Object> variables) {
    String flowableTaskId = ((WorkflowInstanceStateRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE)).getFlowableTaskIdFromTaskId(taskId);

    Optional.ofNullable(variables).ifPresentOrElse(
            variablesValue -> taskService.complete(flowableTaskId, variablesValue),
            () ->taskService.complete(flowableTaskId));
  }

  private List<String> listProcessKeysForSignal(String signal) {
    List<String> processKeys = new ArrayList<>();

    List<ProcessDefinition> processDefinitions = repositoryService.createProcessDefinitionQuery()
            .latestVersion()
            .list();

    for (ProcessDefinition processDefinition : processDefinitions) {
      BpmnModel model = repositoryService.getBpmnModel(processDefinition.getId());
      List<FlowElement> flowElements = model.getProcesses().get(0).getFlowElements().stream().toList();

      for (FlowElement element : flowElements) {
        if (element instanceof StartEvent startEvent) {
            if (startEvent.getEventDefinitions().stream().anyMatch(event -> event instanceof SignalEventDefinition && (((SignalEventDefinition) event).getSignalRef().equals(signal)))) {
            processKeys.add(processDefinition.getKey());
          }
        }
      }
    }

    return processKeys;
  }
}
