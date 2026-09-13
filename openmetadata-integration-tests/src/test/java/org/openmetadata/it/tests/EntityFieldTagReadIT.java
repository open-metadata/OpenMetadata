package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Temporarily decorates the application's SQL logger")
@ExtendWith(TestNamespaceExtension.class)
class EntityFieldTagReadIT {
  private static final String FIELDS = "columns,tags";

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void equalEntitiesRetainEveryFieldProjectionWithoutAdditionalQueries(
      final boolean nested, final TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final TagLabel tag = classificationTag();
    final Table first =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("field_projection"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(columns(tag, nested)));
    leaf(first, nested).setTags(new ArrayList<>());
    final Table second = JsonUtils.deepCopy(first, Table.class);
    assertEquals(first, second);
    assertNotSame(leaf(first, nested), leaf(second, nested));
    final TableRepository repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    RequestEntityCache.clear();
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from tag_usage")) {
      repository.setFieldsInBulk(
          repository.fieldPolicy().parse(FIELDS), List.of(first, second, first));
      assertEquals(2, queries.count(), "One entity-tag query and one shared field-tag query");
    } finally {
      RequestEntityCache.clear();
    }
    assertTag(first, nested, tag);
    assertTag(second, nested, tag);
    leaf(first, nested).getTags().clear();
    assertTag(second, nested, tag);
    assertTag(client.tables().get(first.getId().toString(), FIELDS), nested, tag);
    assertTag(client.tables().getByName(first.getFullyQualifiedName(), FIELDS), nested, tag);
  }

  private List<Column> columns(final TagLabel tag, final boolean nested) {
    final Column leaf =
        new Column().withName("id").withDataType(ColumnDataType.BIGINT).withTags(List.of(tag));
    return nested
        ? List.of(
            new Column()
                .withName("payload")
                .withDataType(ColumnDataType.STRUCT)
                .withDataTypeDisplay("struct<id:bigint>")
                .withChildren(List.of(leaf)))
        : List.of(leaf);
  }

  private Column leaf(final Table table, final boolean nested) {
    final Column first = table.getColumns().getFirst();
    return nested ? first.getChildren().getFirst() : first;
  }

  private void assertTag(final Table table, final boolean nested, final TagLabel expected) {
    assertEquals(
        List.of(expected.getTagFQN()),
        leaf(table, nested).getTags().stream().map(TagLabel::getTagFQN).toList());
  }

  private TagLabel classificationTag() {
    return new TagLabel()
        .withTagFQN(SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN())
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }
}
