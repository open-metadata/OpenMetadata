package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormField;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.onboarding.OnboardingBoard;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingProgress;
import org.openmetadata.schema.governance.onboarding.OnboardingStage;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.governance.onboarding.OnboardingTaskBinding;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.onboarding.OnboardingBoardService;
import org.openmetadata.service.governance.onboarding.OnboardingBoardService.Filter;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Isolated("Board fixtures and SQL instrumentation use the shared onboarding database")
@ExtendWith(TestNamespaceExtension.class)
class OnboardingBoardResourceIT {
  private final List<UUID> assets = new ArrayList<>();
  private final List<UUID> tasks = new ArrayList<>();
  private EntityReference domain;
  private EntityReference assignee;

  @AfterEach
  void removeFixtures() {
    Entity.getCollectionDAO()
        .useTransaction(
            dao -> {
              tasks.forEach(id -> dao.taskDAO().delete(dao.taskDAO().getTableName(), id));
              for (UUID id : assets) {
                var json = dao.onboardingDAO().find(id.toString());
                if (json != null)
                  dao.onboardingDAO()
                      .deleteTasks(
                          JsonUtils.readValue(json, OnboardingInstance.class).getId().toString());
                dao.onboardingDAO().delete(id.toString());
                dao.relationshipDAO().deleteAll(id, Entity.METRIC);
                dao.metricDAO().delete(dao.metricDAO().getTableName(), id);
              }
            });
  }

  @ParameterizedTest
  @ValueSource(strings = {"domain", "assignee"})
  void sparseFiltersFillPagesBeyondOneThousandRows(String filter, TestNamespace namespace) {
    seed(namespace, 1005, 1001);
    String query = filter + "=" + (filter.equals("domain") ? domain.getId() : assignee.getId());
    OnboardingBoard first = board(query, null, 2);
    assertEquals(assets.subList(1001, 1003), ids(first));
    assertEquals(instanceId(1002).toString(), first.getAfter());
    OnboardingBoard second = board(query, first.getAfter(), 2);
    assertEquals(assets.subList(1003, 1005), ids(second));
    assertNull(second.getAfter(), "An exactly full final page must not advertise an empty page");
    assertTrue(board(query, instanceId(1004).toString(), 2).getData().isEmpty());
  }

  @Test
  void deletedAndUnauthorizedRowsDoNotConsumePageSlots(TestNamespace namespace) {
    seed(namespace, 8, 0);
    Entity.getCollectionDAO().metricDAO().delete(assets.get(0));
    Filter filter = new Filter(Entity.METRIC, OnboardingStage.DRAFT.value(), domain.getId(), null);
    var first =
        OnboardingBoardService.list(filter, null, 2, ref -> !ref.getId().equals(assets.get(1)));
    assertEquals(assets.subList(2, 4), ids(first));
    assertEquals(instanceId(3).toString(), first.getAfter());
    var second = OnboardingBoardService.list(filter, first.getAfter(), 4, ref -> true);
    assertEquals(assets.subList(4, 8), ids(second));
    assertNull(second.getAfter());
    var denied = OnboardingBoardService.list(filter, null, 2, ref -> false);
    assertTrue(denied.getData().isEmpty());
    assertNull(denied.getAfter());
  }

  @Test
  void deletedAssigneesBecomeUnresolvedWorkInBothReadPaths(TestNamespace namespace) {
    seed(namespace, 1, 0);
    var http = SdkClients.adminClient().getHttpClient();
    http.execute(
        HttpMethod.DELETE, "/v1/users/" + assignee.getId() + "?hardDelete=true", null, Void.class);
    var single =
        http.execute(
            HttpMethod.GET,
            "/v1/governance/onboarding/metric/" + assets.getFirst(),
            null,
            OnboardingProgress.class);
    var listed = board("domain=" + domain.getId(), null, 25).getData().getFirst();
    for (var progress : List.of(single, listed)) {
      var unresolved =
          progress.getSteps().stream()
              .filter(step -> step.getStep().getId().equals("display-name"))
              .findFirst()
              .orElseThrow();
      assertEquals(OnboardingStepResult.State.BLOCKED, unresolved.getState());
      assertTrue(unresolved.getAssignees().isEmpty());
      assertTrue(progress.getBlockingSteps().contains("display-name"));
    }
    assertTrue(board("assignee=" + assignee.getId(), null, 25).getData().isEmpty());
  }

  @Test
  void boardReadsAssetsAndDependenciesInBatches(TestNamespace namespace) {
    seed(namespace, 30, 0);
    seedFieldTasks();
    var jdbi = Entity.getJdbi();
    var previous = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    var thread = Thread.currentThread();
    List<String> queries = new ArrayList<>();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(StatementContext context) {
            previous.logBeforeExecution(context);
            if (Thread.currentThread() == thread) queries.add(context.getRenderedSql());
          }

          @Override
          public void logAfterExecution(StatementContext context) {
            previous.logAfterExecution(context);
          }
        });
    try {
      var result =
          OnboardingBoardService.list(
              new Filter(
                  Entity.METRIC, OnboardingStage.DRAFT.value(), domain.getId(), assignee.getId()),
              null,
              25,
              ref -> true);
      assertEquals(assets.subList(0, 25), ids(result));
      assertTrue(
          result.getData().stream()
              .allMatch(
                  row ->
                      row.getSteps().stream().anyMatch(step -> tasks.contains(step.getTaskId()))));
      assertTrue(
          queries.stream().anyMatch(sql -> sql.contains("metric_entity")),
          "Capture real database reads");
      assertTrue(
          queries.stream().filter(sql -> sql.contains("FROM metric_entity")).count() <= 2,
          () -> "Asset reads must be batched: " + queries);
      assertTrue(
          queries.stream().filter(sql -> sql.contains("FROM onboarding_instance")).count() <= 2,
          "Reuse the instances loaded by the board query");
      assertTrue(
          queries.stream().filter(sql -> sql.contains("FROM user_entity")).count() <= 2,
          "Resolve shared assignees once per request");
      assertTrue(
          queries.stream().filter(sql -> sql.contains("FROM task_entity")).count() <= 2,
          "Read assigned tasks in batches");
    } finally {
      jdbi.setSqlLogger(previous);
    }
  }

  private void seedFieldTasks() {
    Entity.getCollectionDAO()
        .useTransaction(
            dao -> {
              for (UUID asset : assets) {
                var instance =
                    JsonUtils.readValue(
                        dao.onboardingDAO().find(asset.toString()), OnboardingInstance.class);
                UUID id = UUID.randomUUID();
                String name = "onboarding-" + id;
                var task =
                    new Task()
                        .withId(id)
                        .withTaskId("TASK-" + (1_000_000 + tasks.size()))
                        .withName(name)
                        .withFullyQualifiedName(name)
                        .withType(TaskEntityType.CustomTask)
                        .withCategory(TaskCategory.Custom)
                        .withStatus(TaskEntityStatus.Open)
                        .withAbout(instance.getEntity())
                        .withAssignees(List.of(assignee))
                        .withCreatedBy(assignee)
                        .withCreatedAt(System.currentTimeMillis())
                        .withUpdatedAt(System.currentTimeMillis())
                        .withUpdatedBy("admin")
                        .withVersion(0.1);
                dao.taskDAO().insert(task, name);
                tasks.add(id);
                instance.setBindings(
                    List.of(
                        new OnboardingTaskBinding()
                            .withTaskId(id)
                            .withStepId("display-name")
                            .withAttempt(1)));
                long revision = instance.getRevision();
                instance.setRevision(revision + 1);
                dao.onboardingDAO()
                    .update(
                        asset.toString(),
                        instance.getStage().value(),
                        revision,
                        JsonUtils.pojoToJson(instance));
                dao.onboardingDAO()
                    .bindTask(id.toString(), instance.getId().toString(), "display-name", 1);
              }
            });
  }

  private void seed(TestNamespace namespace, int count, int firstMatch) {
    var client = SdkClients.adminClient();
    domain =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("board-domain-" + UUID.randomUUID()))
                    .withDescription("Board domain")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE))
            .getEntityReference();
    String userName = "board-assignee-" + UUID.randomUUID();
    assignee =
        client
            .users()
            .create(new CreateUser().withName(userName).withEmail(userName + "@example.com"))
            .getEntityReference();
    var configuration =
        new IntakeForm()
            .withId(UUID.randomUUID())
            .withVersion(0.1)
            .withEntityType(
                org.openmetadata.schema.api.governance.CreateIntakeForm.TargetEntityType.METRIC)
            .withEnabled(true)
            .withFormFields(
                List.of(
                    new IntakeFormField()
                        .withFieldPath("displayName")
                        .withFieldKind(IntakeFormField.FieldKind.NATIVE)
                        .withRequired(true)))
            .withOnboarding(
                new OnboardingConfiguration()
                    .withEnabled(true)
                    .withGates(
                        List.of(
                            new OnboardingGate()
                                .withStage(OnboardingStage.DRAFT)
                                .withSteps(
                                    List.of(
                                        new OnboardingStep()
                                            .withId("display-name")
                                            .withType(OnboardingStep.Type.FIELD)
                                            .withFieldPath("displayName"))))));
    // Bulk storage fixtures exercise a sparse catalog without starting thousands of workflows.
    TestSuiteBootstrap.getJdbi()
        .useTransaction(
            handle -> {
              var dao = handle.attach(CollectionDAO.class);
              for (int index = 0; index < count; index++) {
                String name = namespace.prefix("board-metric-" + index);
                var metric =
                    new Metric()
                        .withId(UUID.randomUUID())
                        .withName(name)
                        .withFullyQualifiedName(name)
                        .withVersion(0.1)
                        .withUpdatedAt(System.currentTimeMillis())
                        .withUpdatedBy("admin")
                        .withDeleted(false)
                        .withEntityStatus(EntityStatus.DRAFT);
                assets.add(metric.getId());
                dao.metricDAO().insert(metric, name);
                var instance =
                    new OnboardingInstance()
                        .withId(instanceId(index))
                        .withEntity(metric.getEntityReference())
                        .withConfiguration(configuration)
                        .withStage(OnboardingStage.DRAFT)
                        .withEnteredAt(System.currentTimeMillis())
                        .withRevision(0L)
                        .withCreationCompleted(true)
                        .withCreator(index >= firstMatch ? assignee : null);
                dao.onboardingDAO()
                    .insert(
                        instance.getId().toString(),
                        metric.getId().toString(),
                        Entity.METRIC,
                        configuration.getId().toString(),
                        instance.getStage().value(),
                        JsonUtils.pojoToJson(instance));
                if (index >= firstMatch)
                  dao.relationshipDAO()
                      .insert(
                          domain.getId(),
                          metric.getId(),
                          Entity.DOMAIN,
                          Entity.METRIC,
                          Relationship.HAS.ordinal());
              }
            });
  }

  private UUID instanceId(int index) {
    return UUID.fromString("00000000-0000-0000-0000-" + String.format("%012d", index + 1));
  }

  private OnboardingBoard board(String filter, String after, int limit) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/governance/onboarding?entityType=metric&stage=Draft&limit="
                + limit
                + "&"
                + filter
                + (after == null ? "" : "&after=" + after),
            null,
            OnboardingBoard.class);
  }

  private List<UUID> ids(OnboardingBoard board) {
    return board.getData().stream().map(row -> row.getEntity().getId()).toList();
  }
}
