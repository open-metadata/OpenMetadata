package org.openmetadata.service.entity.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.DATABASE_SERVICE;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Edge;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Value;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.Repository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityServiceMutationTest {
  @Test
  void connectionChangesRecordRedactedValuesWithoutDecryptingCallerObjects() {
    final var fixture = new Fixture();
    final DatabaseService original = service().withConnection(connection("first-secret"));
    final DatabaseService updated = copy(original).withConnection(connection("second-secret"));
    final var mutation = fixture.mutation(original, updated, Set.of("connection"));
    mutation.updateWithDeferredStore();
    final var change = mutation.getIncrementalChangeDescription().getFieldsUpdated().getFirst();
    assertEquals("connection", change.getName());
    assertEquals("\"old-encrypted-value\"", change.getOldValue());
    assertEquals("\"new-encrypted-value\"", change.getNewValue());
    assertEquals(0.2, updated.getVersion());
    assertFalse(JsonUtils.pojoToJson(updated.getChangeDescription()).contains("secret"));
    assertEquals(
        "first-secret", ((MysqlConnection) original.getConnection().getConfig()).getUsername());
    assertEquals(
        "second-secret", ((MysqlConnection) updated.getConnection().getConfig()).getUsername());
  }

  @Test
  void unchangedConnectionsKeepTheVersionAndAvoidRelationshipWrites() {
    final var fixture = new Fixture();
    final DatabaseService original = service().withConnection(connection("same"));
    final DatabaseService updated = copy(original);
    final var mutation = fixture.mutation(original, updated, Set.of("connection"));
    mutation.updateWithDeferredStore();
    assertFalse(mutation.incrementalFieldsChanged());
    assertEquals(0.1, updated.getVersion());
    assertEquals(0, fixture.writes);
  }

  @Test
  void absentOriginalConnectionCanBeAddedWithoutRecordingItsContents() {
    final var fixture = new Fixture();
    final DatabaseService original = service();
    final DatabaseService updated = copy(original).withConnection(connection("added-secret"));
    final var mutation = fixture.mutation(original, updated, Set.of("connection"));
    mutation.updateWithDeferredStore();
    assertEquals(0.2, updated.getVersion());
    assertEquals(
        "connection",
        mutation.getIncrementalChangeDescription().getFieldsUpdated().getFirst().getName());
    assertFalse(JsonUtils.pojoToJson(updated.getChangeDescription()).contains("added-secret"));
  }

  @Test
  void omittedAndUnselectedConnectionsDoNotReadSecrets() {
    final var fixture = new Fixture();
    final DatabaseService original = service().withConnection(connection("same"));
    final var omitted =
        fixture.mutation(original, copy(original).withConnection(null), Set.of("connection"));
    fixture.rejectSecrets = true;
    omitted.updateWithDeferredStore();
    final var unselected =
        fixture.mutation(
            original,
            copy(original).withConnection(connection("changed")),
            Set.of("ingestionRunner"));
    unselected.updateWithDeferredStore();
    assertFalse(omitted.incrementalFieldsChanged());
    assertFalse(unselected.incrementalFieldsChanged());
    assertEquals(0, fixture.writes);
  }

  @Test
  void ingestionRunnerReplacementAndRemovalUpdateTheStoredRelationship() {
    final var fixture = new Fixture();
    final DatabaseService original = service().withIngestionRunner(runner());
    fixture.addRunner(original);
    final DatabaseService updated = copy(original).withIngestionRunner(runner());
    final var mutation = fixture.mutation(original, updated, Set.of("ingestionRunner"));
    mutation.updateWithDeferredStore();
    assertEquals(Set.of(edge(updated)), fixture.rows);
    assertEquals(
        "ingestionRunner",
        mutation.getIncrementalChangeDescription().getFieldsUpdated().getFirst().getName());
    final DatabaseService removed = copy(updated).withIngestionRunner(null);
    fixture.mutation(updated, removed, Set.of("ingestionRunner")).updateWithDeferredStore();
    assertTrue(fixture.rows.isEmpty());
    assertEquals(4, fixture.writes);
  }

  @Test
  void sharedServicePolicyKeepsMutationStateIndependentAndUnchangedRunnersAvoidWrites() {
    final var fixture = new Fixture();
    final DatabaseService original = service();
    final DatabaseService updated = copy(original).withIngestionRunner(runner());
    final var changed = fixture.mutation(original, updated, Set.of("ingestionRunner"));
    changed.updateWithDeferredStore();
    final var unchanged = fixture.mutation(updated, copy(updated), Set.of("ingestionRunner"));
    unchanged.updateWithDeferredStore();
    assertTrue(changed.incrementalFieldsChanged());
    assertFalse(unchanged.incrementalFieldsChanged());
    assertEquals(Set.of(edge(updated)), fixture.rows);
    assertEquals(1, fixture.writes);
  }

  private static DatabaseService service() {
    return new DatabaseService()
        .withId(UUID.randomUUID())
        .withName("service")
        .withFullyQualifiedName("service")
        .withServiceType(DatabaseServiceType.Mysql)
        .withUpdatedBy("admin")
        .withUpdatedAt(10L)
        .withVersion(0.1);
  }

  private static DatabaseService copy(DatabaseService entity) {
    return JsonUtils.deepCopy(entity, DatabaseService.class);
  }

  private static DatabaseConnection connection(String username) {
    return new DatabaseConnection().withConfig(new MysqlConnection().withUsername(username));
  }

  private static EntityReference runner() {
    return new EntityReference().withId(UUID.randomUUID()).withType("ingestionRunner");
  }

  private static Edge edge(DatabaseService service) {
    return new Edge(
        service.getId(),
        service.getIngestionRunner().getId(),
        DATABASE_SERVICE,
        service.getIngestionRunner().getType(),
        Relationship.USES);
  }

  @Repository
  private static final class Fixture implements EntityPolicy<DatabaseService> {
    private final EntityPolicyContext<DatabaseService> context;
    private final Set<Edge> rows = new HashSet<>();
    private int writes;
    private boolean rejectSecrets;
    private final SecretsManager secrets = mock(SecretsManager.class);
    private final EntityRelationshipWriter writer;
    private final EntityServiceMutation<DatabaseService, DatabaseConnection> specific;

    private Fixture() {
      context =
          new EntityPolicyContext<>(
              new EntityPolicyContext.Schema<>(
                  "services/databaseServices",
                  DATABASE_SERVICE,
                  DatabaseService.class,
                  mock(CollectionDAO.DatabaseServiceDAO.class)),
              new EntityPolicyContext.WriteFields(
                  "connection,ingestionRunner", "connection,ingestionRunner", Set.of()),
              EntityModuleDependencies.standard());
      EntityModuleFactory.initialize(this, false);
      final EntityRelationshipDAO dao =
          mock(
              EntityRelationshipDAO.class,
              call -> {
                writes++;
                return switch (call.getMethod().getName()) {
                  case "insert" -> {
                    rows.add(
                        new Edge(
                            call.getArgument(0),
                            call.getArgument(1),
                            call.getArgument(2),
                            call.getArgument(3),
                            Relationship.USES));
                    yield null;
                  }
                  case "delete" -> rows.remove(
                          new Edge(
                              call.getArgument(0),
                              call.getArgument(2),
                              call.getArgument(1),
                              call.getArgument(3),
                              Relationship.USES))
                      ? 1
                      : 0;
                  default -> throw new AssertionError(
                      "Unexpected relationship operation " + call.getMethod().getName());
                };
              });
      writer =
          new EntityRelationshipWriter(
              () -> dao,
              new EntityRelationshipWriter.Effects(value -> {}, value -> {}, (type, id) -> {}));
      when(secrets.decryptServiceConnectionConfig(any(), anyString(), any()))
          .thenAnswer(call -> JsonUtils.convertValue(call.getArgument(0), MysqlConnection.class));
      specific =
          new EntityServiceMutation<>(
              new EntityServiceOperations.Definition<>(
                  DatabaseConnection.class, ServiceType.DATABASE),
              () -> {
                if (rejectSecrets)
                  throw new AssertionError("Unselected or absent connection read secrets");
                return secrets;
              },
              new EntityServiceMutation.Relationships<>(DATABASE_SERVICE, writer, this::addRunner));
    }

    private void addRunner(DatabaseService service) {
      if (service.getIngestionRunner() != null) writer.add(edge(service), Value.EMPTY, false);
    }

    private EntityUpdater<DatabaseService> mutation(
        DatabaseService original, DatabaseService updated, Set<String> fields) {
      final var mutation =
          new EntityUpdater<>(
              context.services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, EntityOperation.PUT, null, false),
              specific);
      mutation.setPatchedFields(fields);
      return mutation;
    }

    @Override
    public void setFields(DatabaseService entity, Fields fields, RelationIncludes includes) {}

    @Override
    public void clearFields(DatabaseService entity, Fields fields) {}

    @Override
    public void prepare(DatabaseService entity, boolean update) {}

    @Override
    public void storeEntity(DatabaseService entity, boolean update) {}

    @Override
    public void storeRelationships(DatabaseService entity) {}

    @Override
    public EntityPolicyContext<DatabaseService> context() {
      return context;
    }
  }
}
