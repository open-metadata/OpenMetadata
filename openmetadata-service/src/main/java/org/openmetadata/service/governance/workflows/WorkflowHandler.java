package org.openmetadata.service.governance.workflows;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.converter.BpmnXMLConverter;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.impl.cfg.StandaloneProcessEngineConfiguration;
import org.flowable.engine.runtime.ProcessInstance;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class WorkflowHandler {
  private final RepositoryService repositoryService;
  private final RuntimeService runtimeService;
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

  public void trigger(String processId, Map<String, Object> variables) {
    // TODO: Create WorkflowInstanceStatus
    ProcessInstance processInstance = runtimeService.startProcessInstanceById(processId, variables);
  }
}
