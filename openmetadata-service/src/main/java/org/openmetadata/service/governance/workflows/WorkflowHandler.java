package org.openmetadata.service.governance.workflows;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.converter.BpmnXMLConverter;
import org.flowable.common.engine.api.FlowableException;
import org.flowable.common.engine.api.FlowableObjectNotFoundException;
import org.flowable.engine.HistoryService;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.impl.cfg.StandaloneProcessEngineConfiguration;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

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
  }

  public void triggerWithSignal(String signal, Map<String, Object> variables) {
    runtimeService.signalEventReceived(signal, variables);
  }

  public void setCustomTaskId(String taskId, UUID customTaskId) {
    taskService.setVariable(taskId, "customTaskId", customTaskId.toString());
  }

  public void resolveTask(UUID taskId) {
    resolveTask(taskId, null);
  }

  public void resolveTask(UUID customTaskId, Map<String, Object> variables) {
    try {
      Optional<Task> oTask = Optional.ofNullable(taskService.createTaskQuery()
              .processVariableValueEquals("customTaskId", customTaskId.toString())
              .singleResult());

      if (oTask.isPresent()) {
        Task task = oTask.get();
        Optional.ofNullable(variables).ifPresentOrElse(
                variablesValue -> taskService.complete(task.getId(), variablesValue),
                () -> taskService.complete(task.getId()));
      } else {
        LOG.debug(String.format("Flowable Task for Task ID %s not found.", customTaskId));
      }
    } catch (FlowableObjectNotFoundException ex) {
      LOG.debug(String.format("Flowable Task for Task ID %s not found.", customTaskId));
    } catch (FlowableException ex) { // TODO: Remove this once we change the Task flow. Currently closeTask() is called twice.
      LOG.debug(String.format("Flowable Exception: %s.", ex));
    }
  }

  public static String getProcessDefinitionKeyFromId(String processDefinitionId) {
    return Arrays.stream(processDefinitionId.split(":")).toList().get(0);
  }

  public void updateBusinessKey(String processInstanceId, UUID workflowInstanceBusinessKey) {
    runtimeService.updateBusinessKey(processInstanceId, workflowInstanceBusinessKey.toString());
  }
}
