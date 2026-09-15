package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.ChartRepository;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Counts hard-delete commits and checks publication around an enclosing transaction")
class EntityHardDeletionAtomicityIT {
  private static final String EXTENSION = "delete.atomicity.probe";

  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @ParameterizedTest
  @CsvSource({"false,false", "false,true", "true,false", "true,true"})
  void workflowCancellationWaitsForTheEnclosingCommit(
      boolean bulk, boolean rollback, TestNamespace ns) {
    final var repository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    final Chart original = fixture(ns, repository);
    final var workflows = WorkflowHandler.getInstance();
    final var engine = workflows.getRepositoryService();
    final String key = "deleteProbe_" + UUID.randomUUID().toString().replace('-', '_');
    final var deployment =
        engine.createDeployment().addString(key + ".bpmn20.xml", process(key)).deploy();
    try {
      final var runtime = workflows.getRuntimeService();
      final String variable =
          getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_ID_VARIABLE);
      final String instance =
          runtime
              .startProcessInstanceByKey(key, Map.of(variable, original.getId().toString()))
              .getId();
      final Runnable change =
          () ->
              repository.executeInTransaction(
                  () -> {
                    delete(repository, original, bulk);
                    assertEquals(
                        1,
                        runtime.createProcessInstanceQuery().processInstanceId(instance).count());
                    if (rollback) {
                      throw new IllegalStateException("Keep the entity and its workflow");
                    }
                    return null;
                  });
      if (rollback) {
        assertThrows(IllegalStateException.class, change::run);
      } else {
        change.run();
      }
      assertEquals(
          rollback ? 1 : 0,
          runtime.createProcessInstanceQuery().processInstanceId(instance).count());
    } finally {
      engine.deleteDeployment(deployment.getId(), true);
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void enclosingRollbackPreservesRowsMetadataAndCachedExistence(boolean bulk, TestNamespace ns) {
    final var repository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    final Chart original = fixture(ns, repository);
    final String before = stored(original.getId());

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              repository.executeInTransaction(
                  () -> {
                    delete(repository, original, bulk);
                    throw new IllegalStateException("Roll back the enclosing hard delete");
                  }));
      assertEquals(JsonUtils.readTree(before), JsonUtils.readTree(stored(original.getId())));
      assertEquals("{}", extension(original.getId()));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    final var missing = CacheBundle.getNotFoundCache();
    if (missing != null) {
      assertFalse(missing.isMarkedNotFoundById(Entity.CHART, original.getId()));
      assertFalse(missing.isMarkedNotFoundByName(Entity.CHART, original.getFullyQualifiedName()));
    }
    assertEquals(original.getId(), SdkClients.adminClient().charts().get(original.getId()).getId());
    assertEquals(
        original.getId(),
        SdkClients.adminClient().charts().getByName(original.getFullyQualifiedName()).getId());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void successfulDeletionCommitsOnceBeforePublishingMissingState(boolean bulk, TestNamespace ns) {
    final var repository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    final Chart original = fixture(ns, repository);

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      delete(repository, original, bulk);
      assertNull(stored(original.getId()));
      assertNull(extension(original.getId()));
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertDeleted(original);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void rowDeleteFailureRollsBackAllDependentMetadata(boolean bulk, TestNamespace ns) {
    final var repository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    final Chart original = fixture(ns, repository);
    final String before = stored(original.getId());
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "delete from chart_entity",
                () -> new IllegalStateException("Injected row deletion failure"))) {
      assertThrows(RuntimeException.class, () -> delete(repository, original, bulk));
      assertEquals(JsonUtils.readTree(before), JsonUtils.readTree(stored(original.getId())));
      assertEquals("{}", extension(original.getId()));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertEquals(original.getId(), SdkClients.adminClient().charts().get(original.getId()).getId());
    assertEquals(
        original.getId(),
        SdkClients.adminClient().charts().getByName(original.getFullyQualifiedName()).getId());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void rowDeleteDeadlockReplaysTheWholePurgeBeforePublishing(boolean bulk, TestNamespace ns) {
    final var repository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    final Chart original = fixture(ns, repository);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "delete from chart_entity",
                () ->
                    new RuntimeException(
                        new SQLException("Injected purge deadlock", "40001", 1213)))) {
      delete(repository, original, bulk);
      assertNull(stored(original.getId()));
      assertNull(extension(original.getId()));
      assertEquals(1, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertDeleted(original);
  }

  private void assertDeleted(final Chart chart) {
    // Peer invalidations can evict negative markers; both warmed aliases must still return 404.
    final var charts = SdkClients.adminClient().charts();
    assertEquals(
        404,
        assertThrows(OpenMetadataException.class, () -> charts.get(chart.getId())).getStatusCode());
    assertEquals(
        404,
        assertThrows(
                OpenMetadataException.class, () -> charts.getByName(chart.getFullyQualifiedName()))
            .getStatusCode());
  }

  private Chart fixture(TestNamespace ns, ChartRepository repository) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final Chart chart =
        repository
            .creates()
            .create(
                new Chart()
                    .withId(UUID.randomUUID())
                    .withName(ns.prefix("hardDeleteChart"))
                    .withService(service.getEntityReference())
                    .withVersion(0.1)
                    .withUpdatedBy("admin")
                    .withUpdatedAt(System.currentTimeMillis()),
                new EntityCommandActor(null, null));
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(chart.getId(), EXTENSION, EXTENSION, "{}");
    SdkClients.adminClient().charts().get(chart.getId());
    SdkClients.adminClient().charts().getByName(chart.getFullyQualifiedName());
    return chart;
  }

  private void delete(ChartRepository repository, Chart chart, boolean bulk) {
    if (bulk) {
      repository.subtrees().bulkHardDeleteSubtree(List.of(chart.getId()), "admin");
    } else {
      repository.deletes().internalById("admin", chart.getId(), false, true);
    }
  }

  private String stored(UUID id) {
    final var rows = Entity.getCollectionDAO().chartDAO();
    return rows.findById(rows.getTableName(), id, "");
  }

  private String extension(UUID id) {
    return Entity.getCollectionDAO().entityExtensionDAO().getExtension(id, EXTENSION);
  }

  private String process(String key) {
    return """
        <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                     targetNamespace="https://open-metadata.org/tests">
          <process id="%s" isExecutable="true">
            <startEvent id="start"/>
            <sequenceFlow id="startToWait" sourceRef="start" targetRef="wait"/>
            <receiveTask id="wait"/>
            <sequenceFlow id="waitToEnd" sourceRef="wait" targetRef="end"/>
            <endEvent id="end"/>
          </process>
        </definitions>
        """
        .formatted(key);
  }
}
