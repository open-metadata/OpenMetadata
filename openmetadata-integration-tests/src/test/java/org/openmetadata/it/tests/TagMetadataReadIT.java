package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityCertificationService;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Temporarily decorates the application's SQL logger")
@ExtendWith(TestNamespaceExtension.class)
class TagMetadataReadIT {
  private static final String CERTIFICATION_GOLD = "Certification.Gold";
  private static final String TAGS_AND_CERTIFICATION = "tags,certification";

  @Test
  void tagsAndCertificationShareOneUsageQuery(TestNamespace ns) {
    final List<Table> tables = createTables(ns);
    final TagLabel tag = classificationTag();
    final long expiry = System.currentTimeMillis() + Duration.ofDays(30).toMillis();
    tables.forEach(table -> storeTags(table, tag));
    storeCertification(tables.getFirst(), expiry);

    assertEquals(1, hydrate(tables, TAGS_AND_CERTIFICATION));

    tables.forEach(table -> assertEquals(List.of(tag.getTagFQN()), tagNames(table)));
    assertCertification(tables.getFirst(), expiry);
    assertNull(tables.getLast().getCertification());
    final var response =
        SdkClients.adminClient()
            .tables()
            .list(
                new ListParams()
                    .setDatabaseSchema(
                        tables.getFirst().getDatabaseSchema().getFullyQualifiedName())
                    .setFields(TAGS_AND_CERTIFICATION)
                    .setLimit(100));
    assertEquals(tables.size(), response.getData().size());
    response.getData().forEach(table -> assertEquals(List.of(tag.getTagFQN()), tagNames(table)));
    assertCertification(
        response.getData().stream()
            .filter(table -> table.getId().equals(tables.getFirst().getId()))
            .findFirst()
            .orElseThrow(),
        expiry);
  }

  @Test
  void derivedTagsAreFetchedOnceAcrossTheWholeBatch(TestNamespace ns) {
    final List<Table> tables = createTables(ns);
    final var glossary = GlossaryTestFactory.createSimple(ns);
    final var term = GlossaryTermTestFactory.createSimple(ns, glossary);
    final TagLabel derived = classificationTag();
    Entity.getCollectionDAO()
        .tagUsageDAO()
        .applyTagsBatch(List.of(derived), term.getFullyQualifiedName());
    final TagLabel glossaryTag =
        new TagLabel()
            .withTagFQN(term.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY)
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED);
    tables.forEach(table -> storeTags(table, glossaryTag));
    final Table duplicate = JsonUtils.deepCopy(tables.getFirst(), Table.class);
    tables.add(duplicate);

    assertEquals(2, hydrate(tables, Entity.FIELD_TAGS));

    for (final Table table : tables) {
      assertEquals(2, table.getTags().size());
      assertTrue(tagNames(table).contains(term.getFullyQualifiedName()));
      final TagLabel applied =
          table.getTags().stream()
              .filter(tag -> tag.getTagFQN().equals(derived.getTagFQN()))
              .findFirst()
              .orElseThrow();
      assertEquals(TagLabel.LabelType.DERIVED, applied.getLabelType());
    }
    tables.getFirst().getTags().clear();
    assertEquals(2, duplicate.getTags().size());
  }

  @Test
  void certificationOnlyAndOmittedMetadataKeepTheirQueryBudgets(TestNamespace ns) {
    final List<Table> tables = createTables(ns);
    final long expiry = System.currentTimeMillis() + Duration.ofDays(30).toMillis();
    storeCertification(tables.getFirst(), expiry);

    assertEquals(1, hydrate(tables, Entity.FIELD_CERTIFICATION));
    assertCertification(tables.getFirst(), expiry);
    assertNull(tables.getFirst().getTags());
    assertEquals(0, hydrate(tables, "columns"));
    assertCertification(tables.getFirst(), expiry);
  }

  private List<Table> createTables(final TestNamespace ns) {
    SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final List<Table> tables = new ArrayList<>();
    for (int index = 0; index < 3; index++) {
      tables.add(
          SdkClients.adminClient()
              .tables()
              .create(
                  new CreateTable()
                      .withName(ns.prefix("tag_metadata_" + index))
                      .withDatabaseSchema(schema.getFullyQualifiedName())
                      .withColumns(
                          List.of(
                              new Column().withName("id").withDataType(ColumnDataType.BIGINT)))));
    }
    return tables;
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void certificationAndTagsRollBackTogether(final boolean batch, final TestNamespace ns) {
    final Table table = createTables(ns).getFirst();
    final long expiry = System.currentTimeMillis() + Duration.ofDays(30).toMillis();
    storeCertification(table, expiry);
    final TableRepository repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    final var certifications =
        new EntityCertificationService<Table>(
            () -> Entity.getCollectionDAO().tagUsageDAO(),
            () -> "Certification",
            true,
            TagLabelUtil::applyTagCommonFieldsGracefully);
    table.setCertification(
        new AssetCertification()
            .withTagLabel(new TagLabel().withTagFQN(CERTIFICATION_GOLD))
            .withExpiryDate(expiry + 1000));

    assertThrows(
        IllegalStateException.class,
        () ->
            repository.executeInTransaction(
                () -> {
                  storeTags(table, classificationTag());
                  if (batch) {
                    certifications.applyMany(List.of(table));
                  } else {
                    certifications.apply(table, certifications::read);
                  }
                  assertEquals(expiry + 1000, certifications.read(table).getExpiryDate());
                  throw new IllegalStateException(
                      "Injected failure after certification replacement");
                }));

    hydrate(List.of(table), TAGS_AND_CERTIFICATION);
    assertEquals(List.of(), table.getTags());
    assertCertification(table, expiry);
  }

  private void storeTags(final Table table, final TagLabel tag) {
    Entity.getCollectionDAO()
        .tagUsageDAO()
        .applyTagsBatch(List.of(tag), table.getFullyQualifiedName());
  }

  private void storeCertification(final Table table, final long expiry) {
    storeTags(
        table,
        new TagLabel()
            .withTagFQN(CERTIFICATION_GOLD)
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.AUTOMATED)
            .withState(TagLabel.State.CONFIRMED)
            .withAppliedBy("admin")
            .withMetadata(new TagLabelMetadata().withExpiryDate(expiry)));
  }

  private TagLabel classificationTag() {
    return new TagLabel()
        .withTagFQN(SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN())
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private int hydrate(final List<Table> tables, final String fields) {
    final TableRepository repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    RequestEntityCache.clear();
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from tag_usage")) {
      repository.setFieldsInBulk(repository.fieldPolicy().parse(fields), tables);
      return queries.count();
    } finally {
      RequestEntityCache.clear();
    }
  }

  private List<String> tagNames(final Table table) {
    return table.getTags().stream().map(TagLabel::getTagFQN).toList();
  }

  private void assertCertification(final Table table, final long expiry) {
    assertNotNull(table.getCertification());
    assertEquals(CERTIFICATION_GOLD, table.getCertification().getTagLabel().getTagFQN());
    assertEquals(expiry, table.getCertification().getExpiryDate());
    assertNotNull(table.getCertification().getAppliedDate());
    assertEquals("admin", table.getCertification().getTagLabel().getAppliedBy());
  }
}
