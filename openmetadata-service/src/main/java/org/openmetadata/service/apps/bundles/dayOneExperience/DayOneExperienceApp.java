package org.openmetadata.service.apps.bundles.dayOneExperience;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.ScheduleType;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.internal.DayOneExperienceAppConfig;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;

import static org.openmetadata.service.exception.CatalogExceptionMessage.NO_MANUAL_TRIGGER_ERR;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

@Slf4j
public class DayOneExperienceApp extends AbstractNativeApplication {
  private static final String WORKFLOW_NAME = "DayOneExperienceWorkflow";
  protected DayOneExperienceAppConfig config;

  public DayOneExperienceApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void install() {
    createWorkflow();
    configure();
  }

  @Override
  public void uninstall() {
    deleteWorkflow();
  }

  @Override
  public void init(App app) {
    super.init(app);
    this.config =
        JsonUtils.convertValue(
            this.getApp().getAppConfiguration(), DayOneExperienceAppConfig.class);
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

    Map<String, Object> variables = new HashMap<>();
    variables.put(
            getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
            JsonUtils.readOrConvertValue(appConfig, DayOneExperienceAppConfig.class).getEntityLink());

    WorkflowHandler.getInstance()
            .triggerByKey(WORKFLOW_NAME, UUID.randomUUID().toString(), variables);
  }

  private String readResource(String resourceFile) {
    try (InputStream in = getClass().getResourceAsStream(resourceFile)) {
      assert in != null;
      return new String(in.readAllBytes());
    } catch (Exception e) {
      throw new UnhandledServerException("Failed to load Day One Experience Workflow.");
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

    String resourceFile =
        "/applications/DayOneExperienceApplication/collate/DayOneExperienceWorkflow.json";
    resourceFile =
        resourceExists(resourceFile)
            ? resourceFile
            : resourceFile.replace("collate", "openmetadata");

    return JsonUtils.readOrConvertValue(readResource(resourceFile), WorkflowDefinition.class)
        .withOwners(List.of(adminReference))
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy(getAppBot());
  }

  private void createWorkflow() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    repository.createOrUpdate(null, loadWorkflow());
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
