package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.AddTagToAssetsRequest;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.util.BulkAssetsOperationResponse;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Observes the retained transaction and cached projections during bulk tag removal")
@ExtendWith(TestNamespaceExtension.class)
class EntityBulkTagRemovalIT {
  private static final String FIELDS = "tags,columns";

  @AfterEach
  void clearRequestCache() {
    RequestEntityCache.clear();
  }

  @ParameterizedTest
  @CsvSource({
    "GLOSSARY,false,false", "GLOSSARY,true,false",
    "CLASSIFICATION,false,false", "CLASSIFICATION,true,false",
    "GLOSSARY,false,true", "GLOSSARY,true,true",
    "CLASSIFICATION,false,true", "CLASSIFICATION,true,true"
  })
  void removalAndPreviewPreserveDatabaseAndCachedReads(
      final TagSource source, final boolean column, final boolean dryRun, final TestNamespace ns) {
    final Fixture fixture = fixture(ns, source, column);
    assertVisible(fixture, true);

    if (source == TagSource.GLOSSARY) {
      removeGlossaryOverApi(fixture, dryRun);
    } else {
      removeClassificationOverApi(fixture, dryRun);
    }
  }

  private void removeGlossaryOverApi(final Fixture fixture, final boolean dryRun) {
    final BulkOperationResult result =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.PUT, path(fixture), request(fixture, dryRun), BulkOperationResult.class);
    assertEquals(dryRun, result.getDryRun());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsProcessed());
    assertStored(fixture, dryRun);
    assertVisible(fixture, dryRun);
  }

  private void removeClassificationOverApi(final Fixture fixture, final boolean dryRun) {
    final BulkAssetsOperationResponse response =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                path(fixture),
                request(fixture, dryRun),
                BulkAssetsOperationResponse.class);
    assertFalse(response.getJobId().isBlank());
    final var completion = Awaitility.await().atMost(Duration.ofSeconds(30));
    final var assertion = dryRun ? completion.during(Duration.ofSeconds(2)) : completion;
    assertion.untilAsserted(
        () -> {
          assertStored(fixture, dryRun);
          assertVisible(fixture, dryRun);
        });
  }

  @ParameterizedTest
  @CsvSource({"GLOSSARY,false", "GLOSSARY,true", "CLASSIFICATION,false", "CLASSIFICATION,true"})
  void enclosingRollbackKeepsTagsAndPublishedProjections(
      final TagSource source, final boolean column, final TestNamespace ns) {
    final Fixture fixture = fixture(ns, source, column);
    assertVisible(fixture, true);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              tables()
                  .executeInTransaction(
                      () -> {
                        removeDirectly(fixture);
                        assertStored(fixture, false);
                        assertVisible(fixture, true);
                        throw new IllegalStateException("Injected failure after tag deletion");
                      }));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertStored(fixture, true);
    assertVisible(fixture, true);
    assertSearchTags(fixture, true);
  }

  @ParameterizedTest
  @CsvSource({"GLOSSARY,false", "GLOSSARY,true", "CLASSIFICATION,false", "CLASSIFICATION,true"})
  void enclosingCommitPublishesBothAliasesWithOneCommit(
      final TagSource source, final boolean column, final TestNamespace ns) {
    final Fixture fixture = fixture(ns, source, column);
    assertVisible(fixture, true);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      tables()
          .executeInTransaction(
              () -> {
                removeDirectly(fixture);
                assertStored(fixture, false);
                assertVisible(fixture, true);
                return null;
              });
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertVisible(fixture, false);
    assertSearchTags(fixture, false);
  }

  private void removeDirectly(final Fixture fixture) {
    switch (fixture.source()) {
      case GLOSSARY -> ((GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM))
          .bulkRemoveGlossaryToAssets(
              fixture.tag().getId(), (AddGlossaryToAssetsRequest) request(fixture, false));
      case CLASSIFICATION -> ((TagRepository) Entity.getEntityRepository(Entity.TAG))
          .bulkRemoveAndValidateTagsToAssets(
              fixture.tag().getId(), (AddTagToAssetsRequest) request(fixture, false));
    }
  }

  private Object request(final Fixture fixture, final boolean dryRun) {
    return switch (fixture.source()) {
      case GLOSSARY -> new AddGlossaryToAssetsRequest()
          .withDryRun(dryRun)
          .withAssets(List.of(fixture.asset()));
      case CLASSIFICATION -> new AddTagToAssetsRequest()
          .withDryRun(dryRun)
          .withAssets(List.of(fixture.asset()));
    };
  }

  private String path(final Fixture fixture) {
    final String collection = fixture.source() == TagSource.GLOSSARY ? "glossaryTerms" : "tags";
    return "/v1/" + collection + "/" + fixture.tag().getId() + "/assets/remove";
  }

  private void assertStored(final Fixture fixture, final boolean present) {
    final boolean stored =
        Entity.getCollectionDAO()
            .tagUsageDAO()
            .getTags(fixture.asset().getFullyQualifiedName())
            .stream()
            .anyMatch(tag -> fixture.tag().getFullyQualifiedName().equals(tag.getTagFQN()));
    assertEquals(present, stored, "Canonical tag rows must reflect the requested operation");
  }

  private void assertVisible(final Fixture fixture, final boolean present) {
    final var client = SdkClients.adminClient();
    assertTags(fixture, client.tables().get(fixture.table().getId().toString(), FIELDS), present);
    assertTags(
        fixture,
        client.tables().getByName(fixture.table().getFullyQualifiedName(), FIELDS),
        present);
  }

  private void assertTags(final Fixture fixture, final Table table, final boolean present) {
    final List<TagLabel> labels =
        fixture.column() ? table.getColumns().getFirst().getTags() : table.getTags();
    final boolean visible =
        labels != null
            && labels.stream()
                .anyMatch(tag -> fixture.tag().getFullyQualifiedName().equals(tag.getTagFQN()));
    assertEquals(present, visible, "ID and FQN projections must match committed tag rows");
  }

  private Fixture fixture(final TestNamespace ns, final TagSource source, final boolean column) {
    final var client = SdkClients.adminClient();
    final EntityReference tag = createTag(ns, source);
    final TagLabel label =
        new TagLabel()
            .withTagFQN(tag.getFullyQualifiedName())
            .withSource(source)
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Column field = new Column().withName("id").withDataType(ColumnDataType.BIGINT);
    if (column) {
      field.setTags(List.of(label));
    }
    final Table table =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("bulk_tag_removal"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(List.of(field))
                    .withTags(column ? null : List.of(label)));
    final EntityReference asset =
        column
            ? new EntityReference()
                .withType(Entity.TABLE_COLUMN)
                .withId(UUID.randomUUID())
                .withFullyQualifiedName(table.getColumns().getFirst().getFullyQualifiedName())
            : table.getEntityReference();
    final Fixture fixture = new Fixture(source, column, tag, table, asset);
    assertSearchTags(fixture, true);
    return fixture;
  }

  private void assertSearchTags(final Fixture fixture, final boolean present) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              final String response =
                  SdkClients.adminClient()
                      .search()
                      .query("id:" + fixture.table().getId())
                      .index("table_search_index")
                      .size(1)
                      .execute();
              final var hits = JsonUtils.readTree(response).path("hits").path("hits");
              assertEquals(1, hits.size());
              final var source = hits.get(0).path("_source");
              final var asset = fixture.column() ? source.path("columns").get(0) : source;
              assertEquals(
                  present,
                  asset
                      .path("tags")
                      .findValuesAsText("tagFQN")
                      .contains(fixture.tag().getFullyQualifiedName()));
            });
  }

  private EntityReference createTag(final TestNamespace ns, final TagSource source) {
    if (source == TagSource.GLOSSARY) {
      return GlossaryTermTestFactory.createSimple(ns, GlossaryTestFactory.createSimple(ns))
          .getEntityReference();
    }
    final var client = SdkClients.adminClient();
    final var classification =
        ns.trackRoot(
            Entity.CLASSIFICATION,
            client
                .classifications()
                .create(
                    new CreateClassification()
                        .withName(ns.prefix("bulk_tag_classification_" + ns.uniqueShortId()))
                        .withDescription("Bulk tag removal")));
    return client
        .tags()
        .create(
            new CreateTag()
                .withName(ns.prefix("label"))
                .withClassification(classification.getFullyQualifiedName())
                .withDescription("Bulk tag removal"))
        .getEntityReference();
  }

  private TableRepository tables() {
    return (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  private record Fixture(
      TagSource source, boolean column, EntityReference tag, Table table, EntityReference asset) {}
}
