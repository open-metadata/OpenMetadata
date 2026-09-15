package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.Charts;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

@Isolated("Counts relationship writes across consolidated PATCH and import updates")
@ExtendWith(TestNamespaceExtension.class)
class EntityConsolidationWritesIT {
  @ParameterizedTest
  @CsvSource({
    "chart,owners,false",
    "chart,domains,false",
    "table,owners,false",
    "table,domains,false",
    "chart,owners,true",
    "chart,domains,true",
    "table,owners,true",
    "table,domains,true"
  })
  void ownershipWritesOnlyTheCurrentDeltaAndPreservesHistoryPolicy(
      String type, String field, boolean importMode, TestNamespace ns) {
    final Target target = new Target(fixture(type, ns), type, importMode);
    final EntityReference first = reference(field, "first", ns);
    final EntityReference second = reference(field, "second", ns);
    final JsonNode initial = update(target, field, List.of(first));
    assertEquals(0.2, initial.path("version").asDouble());
    final double replacementVersion = importMode ? 0.3 : 0.2;
    assertReferences(target, field, List.of(first));
    assertReplacement(target, field, second, replacementVersion);
    assertReferences(target, field, List.of(second));
    assertUnchanged(target, field, second, replacementVersion);
    assertRemoval(target, field);
    assertReferences(target, field, List.of());
    final String archived =
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtension(
                target.entity().getId(),
                EntityUtil.getVersionExtension(type, target.entity().getVersion()));
    if (importMode) {
      assertNotNull(archived, "PUT imports retain history for each edit");
    } else {
      assertNull(archived, "Cancelling a PATCH session removes its archived baseline");
    }
  }

  private void assertReplacement(
      Target target, String field, EntityReference replacement, double version) {
    try (var deletes = counter(target, "delete from entity_relationship");
        var inserts = counter(target, "into entity_relationship")) {
      final JsonNode replaced = update(target, field, List.of(replacement));
      assertEquals(version, replaced.path("version").asDouble());
      assertEquals(1, deletes.count(), "Only the current relationship is removed");
      assertEquals(1, inserts.count(), "The requested relationship is written once");
    }
  }

  private void assertUnchanged(
      Target target, String field, EntityReference unchanged, double version) {
    try (var deletes = counter(target, "delete from entity_relationship");
        var inserts = counter(target, "into entity_relationship")) {
      assertEquals(version, update(target, field, List.of(unchanged)).path("version").asDouble());
      assertEquals(0, deletes.count());
      assertEquals(0, inserts.count());
    }
  }

  private void assertRemoval(Target target, String field) {
    try (var deletes = counter(target, "delete from entity_relationship");
        var inserts = counter(target, "into entity_relationship")) {
      final JsonNode reverted = update(target, field, List.of());
      assertEquals(target.importMode() ? 0.4 : 0.1, reverted.path("version").asDouble());
      assertEquals(1, deletes.count());
      assertEquals(0, inserts.count());
    }
  }

  private void assertReferences(Target target, String field, List<EntityReference> expected) {
    final List<String> ids =
        expected.stream().map(reference -> reference.getId().toString()).toList();
    assertEquals(ids, read(target.path(), field).path(field).findValuesAsText("id"));
    assertEquals(ids, read(target.namePath(), field).path(field).findValuesAsText("id"));
  }

  private SqlQueryCounter counter(Target target, String sql) {
    return target.importMode()
        ? new SqlQueryCounter(Entity.getJdbi(), sql)
        : SqlQueryCounter.forRequests(Entity.getJdbi(), sql);
  }

  private JsonNode update(Target target, String field, Object value) {
    return target.importMode()
        ? importField(
            Entity.getEntityRepository(target.type()), target.entity().getId(), field, value)
        : patch(target.path(), field, value);
  }

  private <T extends EntityInterface> JsonNode importField(
      EntityRepository<T> repository, UUID id, String field, Object value) {
    final T entity = repository.get(null, id, repository.getFields("*"), Include.NON_DELETED, true);
    final var requested = (ObjectNode) JsonUtils.valueToTree(entity);
    requested.set(field, JsonUtils.valueToTree(value));
    return JsonUtils.valueToTree(
        repository
            .createOrUpdateForImport(
                null, JsonUtils.treeToValue(requested, repository.getEntityClass()), "admin")
            .getEntity());
  }

  private JsonNode patch(String path, String field, Object references) {
    final var changes = JsonUtils.getObjectNode();
    changes.put("op", "add");
    changes.put("path", "/" + field);
    changes.set("value", JsonUtils.valueToTree(references));
    return JsonUtils.readTree(
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.PATCH, path, JsonUtils.valueToTree(List.of(changes))));
  }

  private JsonNode read(String path, String field) {
    return JsonUtils.readTree(
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, path + "?fields=" + field, null));
  }

  private EntityInterface fixture(String type, TestNamespace ns) {
    return switch (type) {
      case Entity.CHART -> Charts.create()
          .name(ns.prefix("consolidated_chart"))
          .in(DashboardServiceTestFactory.createMetabase(ns).getFullyQualifiedName())
          .execute();
      case Entity.TABLE -> TableTestFactory.createSimple(
          ns, DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName());
      default -> throw new IllegalArgumentException("Unsupported entity type: " + type);
    };
  }

  private EntityReference reference(String field, String name, TestNamespace ns) {
    return switch (field) {
      case Entity.FIELD_OWNERS -> UserTestFactory.createUser(ns, name).getEntityReference();
      case Entity.FIELD_DOMAINS -> domain(name, ns).getEntityReference();
      default -> throw new IllegalArgumentException("Unsupported relationship field: " + field);
    };
  }

  private Domain domain(String name, TestNamespace ns) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(name))
                    .withDescription("Consolidation fixture")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)));
  }

  private record Target(EntityInterface entity, String type, boolean importMode) {
    private String path() {
      return collectionPath() + "/" + entity.getId();
    }

    private String namePath() {
      return collectionPath() + "/name/" + entity.getFullyQualifiedName();
    }

    private String collectionPath() {
      return "/v1/" + type + "s";
    }
  }
}
