package org.openmetadata.service.apps.bundles.autoPilot;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
import static org.openmetadata.service.governance.workflows.elements.TriggerFactory.getTriggerWorkflowId;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.internal.AutoPilotAppConfig;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class AutoPilotApp extends AbstractNativeApplication {
  private static final String WORKFLOW_NAME = "AutoPilotWorkflow";
  protected AutoPilotAppConfig config;

  public AutoPilotApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void install(String installedBy) {
    createWorkflow(installedBy);
    configure();
  }

  @Override
  public void uninstall() {
    super.uninstall();
    deleteWorkflow();
  }

  @Override
  public void init(App app) {
    super.init(app);
    this.config =
        JsonUtils.convertValue(this.getApp().getAppConfiguration(), AutoPilotAppConfig.class);
  }

  @Override
  public void configure() {
    if (this.config.getActive()) {
      resumeWorkflow();
    } else {
      suspendWorkflow();
    }
  }

  @Override
  public void triggerOnDemand(Map<String, Object> config) {
    // Trigger the application with the provided configuration payload
    Map<String, Object> appConfig = JsonUtils.getMap(getApp().getAppConfiguration());
    if (config != null) {
      appConfig.putAll(config);
    }
    validateConfig(appConfig);

    AutoPilotAppConfig runtimeConfig =
        JsonUtils.readOrConvertValue(appConfig, AutoPilotAppConfig.class);

    if (runtimeConfig.getActive()) {
      Map<String, Object> variables = new HashMap<>();
      variables.put(
          getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
          runtimeConfig.getEntityLink());

      WorkflowHandler.getInstance()
          .triggerByKey(
              getTriggerWorkflowId(WORKFLOW_NAME), UUID.randomUUID().toString(), variables);
    } else {
      LOG.info(
          String.format(
              "%s is not active. Won't be triggered for %s",
              WORKFLOW_NAME, runtimeConfig.getEntityLink()));
    }
  }

  private String readResource(String resourceFile) {
    try (InputStream in = getClass().getResourceAsStream(resourceFile)) {
      assert in != null;
      return new String(in.readAllBytes());
    } catch (Exception e) {
      throw new UnhandledServerException("Failed to load AutoPilot Workflow.");
    }
  }

  private boolean resourceExists(String resourceFile) {
    return getClass().getResource(resourceFile) != null;
  }

  private String getAppBot() {
    return getApp().getBot().getName();
  }

  private WorkflowDefinition loadWorkflow() {
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    EntityReference adminReference =
        userRepository.findByName(getAppBot(), Include.NON_DELETED).getEntityReference();

    String resourceFile = "/applications/AutoPilotApplication/collate/AutoPilotWorkflow.json";
    resourceFile =
        resourceExists(resourceFile)
            ? resourceFile
            : resourceFile.replace("collate", "openmetadata");

    return JsonUtils.readOrConvertValue(readResource(resourceFile), WorkflowDefinition.class)
        .withOwners(List.of(adminReference))
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy(getAppBot());
  }

  private void createWorkflow(String createdBy) {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    repository.createOrUpdate(null, loadWorkflow(), createdBy);
  }

  private void deleteWorkflow() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    repository.deleteByName(getAppBot(), WORKFLOW_NAME, true, true);
  }

  private void suspendWorkflow() {
    WorkflowHandler.getInstance().suspendWorkflow(WORKFLOW_NAME);
  }

  private void resumeWorkflow() {
    WorkflowHandler.getInstance().resumeWorkflow(WORKFLOW_NAME);
  }
}
