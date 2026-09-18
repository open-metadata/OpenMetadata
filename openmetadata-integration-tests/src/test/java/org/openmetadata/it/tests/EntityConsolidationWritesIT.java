package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.Charts;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

@Isolated("Counts relationship writes across consolidated PATCH and import updates")
@ExtendWith(TestNamespaceExtension.class)
class EntityConsolidationWritesIT {
  @ParameterizedTest
  @ValueSource(strings = {Entity.CHART, Entity.TABLE})
  void consolidatedExtensionsWriteOnlyChangedProperties(String type, TestNamespace ns) {
    final var client = SdkClients.adminClient().getHttpClient();
    final Type definition =
        client.execute(
            HttpMethod.GET,
            "/v1/metadata/types/name/" + type + "?fields=customProperties",
            null,
            Type.class);
    final Type integer =
        client.execute(HttpMethod.GET, "/v1/metadata/types/name/integer", null, Type.class);
    final String first = "first" + ns.uniqueShortId();
    final String second = "second" + ns.uniqueShortId();
    final String typePath = "/v1/metadata/types/" + definition.getId();
    try {
      for (String field : List.of(first, second)) {
        client.execute(
            HttpMethod.PUT,
            typePath,
            new CustomProperty()
                .withName(field)
                .withDescription("Consolidated extension fixture")
                .withPropertyType(integer.getEntityReference()),
            Type.class);
      }
      final var target = new Target(fixture(type, ns), type, false);
      patch(target.path(), "extension", Map.of(first, 1, second, 7));
      assertExtensionWrites(target, Map.of(first, 2, second, 7), 0, 1, 0.2);
      assertExtensionWrites(target, Map.of(first, 2, second, 7), 0, 0, 0.2);
      assertExtensionWrites(target, Map.of(second, 7), 1, 0, 0.2);
      assertExtensionWrites(target, Map.of(), 1, 0, 0.1);
    } finally {
      patch(typePath, "customProperties", definition.getCustomProperties());
    }
  }

  private void assertExtensionWrites(
      Target target, Map<String, Integer> extension, int removed, int stored, double version) {
    final String prefix = TypeRegistry.getCustomPropertyFQNPrefix(target.type());
    final Predicate<StatementContext> property =
        context ->
            context
                .getBinding()
                .findForName("extension", context)
                .map(Object::toString)
                .filter(value -> value.startsWith(prefix))
                .isPresent();
    try (var deletes =
            SqlQueryCounter.forRequests(
                Entity.getJdbi(), "delete from entity_extension", property);
        var inserts =
            SqlQueryCounter.forRequests(Entity.getJdbi(), "into entity_extension", property)) {
      assertEquals(
          version, patch(target.path(), "extension", extension).path("version").asDouble());
      assertEquals(removed, deletes.count(), "Only removed custom properties are deleted");
      assertEquals(stored, inserts.count(), "Only changed custom properties are stored");
    }
    final JsonNode expected = JsonUtils.valueToTree(extension.isEmpty() ? null : extension);
    assertEquals(
        expected, JsonUtils.valueToTree(read(target.path(), "extension").get("extension")));
    assertEquals(
        expected, JsonUtils.valueToTree(read(target.namePath(), "extension").get("extension")));
  }

  @ParameterizedTest
  @CsvSource({"chart,false", "table,false", "chart,true", "table,true"})
  void tagsWriteOnlyTheCurrentDelta(String type, boolean importMode, TestNamespace ns) {
    final var target = new Target(fixture(type, ns), type, importMode);
    final var first = List.of(tag("Tier.Tier1"));
    final var second = List.of(tag("Tier.Tier2"));
    assertEquals(0.2, update(target, "tags", first).path("version").asDouble());
    assertTagWrites(target, second, 1, 1, importMode ? 0.3 : 0.2);
    assertTagWrites(target, second, 0, 0, importMode ? 0.3 : 0.2);
    assertTagWrites(target, List.of(), 1, 0, importMode ? 0.4 : 0.1);
  }

  @ParameterizedTest
  @ValueSource(strings = {Entity.CHART, Entity.TABLE})
  void importsReplaceChangedTagAttributesWithoutRewritingOtherTags(String type, TestNamespace ns) {
    final var target = new Target(fixture(type, ns), type, true);
    final var first = tag("Tier.Tier1");
    final var other = tag("PII.Sensitive");
    update(target, "tags", List.of(first, other));
    final var changed =
        tag("Tier.Tier1")
            .withReason("Reviewed")
            .withState(TagLabel.State.SUGGESTED)
            .withLabelType(TagLabel.LabelType.AUTOMATED)
            .withAppliedBy("ingestion-bot");
    assertTagWrites(target, List.of(other, changed), 1, 1, 0.2);
    final JsonNode labels = read(target.path(), "tags").path("tags");
    for (var label : labels) {
      if (label.path("tagFQN").asText().equals("Tier.Tier1")) {
        assertEquals("Reviewed", label.path("reason").asText());
        assertEquals("Suggested", label.path("state").asText());
        assertEquals("Automated", label.path("labelType").asText());
        assertEquals("ingestion-bot", label.path("appliedBy").asText());
      }
    }
    assertTagWrites(target, List.of(other, changed), 0, 0, 0.2);
  }

  @ParameterizedTest
  @ValueSource(strings = {Entity.CHART, Entity.TABLE})
  void importingTagsRetainsTheSeparateCertification(String type, TestNamespace ns) {
    final var target = new Target(fixture(type, ns), type, true);
    patch(
        target.path(),
        "certification",
        new AssetCertification().withTagLabel(tag("Certification.Gold")));
    final var certification = read(target.path(), "certification").path("certification");
    update(target, "tags", List.of(tag("Tier.Tier1")));
    assertTagWrites(target, List.of(tag("Tier.Tier2")), 1, 1, 0.4);
    assertEquals(certification, read(target.path(), "certification").path("certification"));
    assertEquals(certification, read(target.namePath(), "certification").path("certification"));
  }

  private void assertTagWrites(
      Target target, List<TagLabel> tags, int removed, int added, double version) {
    try (var deletes = counter(target, "delete from tag_usage");
        var inserts = counter(target, "insert into tag_usage")) {
      assertEquals(version, update(target, "tags", tags).path("version").asDouble());
      assertEquals(
          removed, deletes.count(), "No tag or certification writes during historical comparisons");
      assertEquals(added, inserts.count(), "Only current tags are inserted");
    }
    assertEquals(
        tags.stream().map(TagLabel::getTagFQN).toList(),
        read(target.path(), "tags").path("tags").findValuesAsText("tagFQN"));
    assertEquals(
        tags.stream().map(TagLabel::getTagFQN).toList(),
        read(target.namePath(), "tags").path("tags").findValuesAsText("tagFQN"));
  }

  private TagLabel tag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  @ParameterizedTest
  @CsvSource({
    "chart,owners,false",
    "chart,domains,false",
    "table,owners,false",
    "table,domains,false",
    "chart,owners,true",
    "chart,domains,true",
    "table,owners,true",
    "table,domains,true",
    "domain,experts,false",
    "dataProduct,experts,false",
    "glossary,reviewers,false",
    "domain,experts,true",
    "dataProduct,experts,true",
    "glossary,reviewers,true"
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

  @ParameterizedTest
  @CsvSource({"chart,false", "table,false", "chart,true", "table,true"})
  void dataProductChangesLeaveUnchangedMembershipAndLineageAlone(
      String type, boolean importMode, TestNamespace ns) {
    final var target = new Target(fixture(type, ns), type, importMode);
    final var domain = reference("domains", "product_domain", ns);
    update(target, "domains", List.of(domain));
    final var first = dataProduct(domain, "first", ns).getEntityReference();
    final var kept = dataProduct(domain, "kept", ns).getEntityReference();
    final var second = dataProduct(domain, "second", ns).getEntityReference();
    update(target, "dataProducts", List.of(first, kept));
    final double version = importMode ? 0.4 : 0.2;
    assertDataProductWrites(target, List.of(second, kept), 1, 1, 4, version);
    assertDataProductWrites(target, List.of(second, kept), 0, 0, 0, version);
    assertDataProductWrites(target, List.of(kept), 1, 0, 2, importMode ? 0.5 : 0.2);
  }

  private DataProduct dataProduct(EntityReference domain, String name, TestNamespace ns) {
    return ns.trackRoot(
        Entity.DATA_PRODUCT,
        SdkClients.adminClient()
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(ns.prefix(name))
                    .withDescription("Data product write budget fixture")
                    .withDomains(List.of(domain.getFullyQualifiedName()))));
  }

  private void assertDataProductWrites(
      Target target,
      List<EntityReference> references,
      int removed,
      int added,
      int topologyReads,
      double version) {
    try (var deletes = counter(target, "delete from entity_relationship");
        var inserts = counter(target, "into entity_relationship");
        var topology = counter(target, "er1.fromEntity = 'dataProduct'")) {
      assertEquals(version, update(target, "dataProducts", references).path("version").asDouble());
      assertEquals(removed, deletes.count());
      assertEquals(added, inserts.count());
      assertEquals(
          topologyReads, topology.count(), "Only changed memberships need lineage lookups");
    }
    final var expected = references.stream().map(ref -> ref.getId().toString()).sorted().toList();
    for (var path : List.of(target.path(), target.namePath())) {
      assertEquals(
          expected,
          read(path, "dataProducts").path("dataProducts").findValuesAsText("id").stream()
              .sorted()
              .toList());
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
      case Entity.GLOSSARY -> GlossaryTestFactory.createSimple(ns);
      case Entity.DOMAIN -> domain("experts", ns);
      case Entity.DATA_PRODUCT -> dataProduct(
          domain("product_domain", ns).getEntityReference(), "experts", ns);
      default -> throw new IllegalArgumentException("Unsupported entity type: " + type);
    };
  }

  private EntityReference reference(String field, String name, TestNamespace ns) {
    return switch (field) {
      case Entity.FIELD_OWNERS, Entity.FIELD_EXPERTS, Entity.FIELD_REVIEWERS -> UserTestFactory
          .createUser(ns, name)
          .getEntityReference();
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
      return "/v1/" + (Entity.GLOSSARY.equals(type) ? "glossaries" : type + "s");
    }
  }
}
