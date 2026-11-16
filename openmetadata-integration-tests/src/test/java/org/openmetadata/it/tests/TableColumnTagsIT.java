package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.models.ListParams;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class TableColumnTagsIT {

  private static final String COLUMNS_ONLY = "columns";

  @ParameterizedTest
  @ValueSource(strings = {COLUMNS_ONLY, "columns,tags"})
  void getReturnsPatchedColumnTags(String fields, TestNamespace ns) {
    final Table table = createPatchedTable(ns);
    final var tables = SdkClients.adminClient().tables();

    assertAll(
        () -> assertReadTags(tables.get(table.getId().toString(), fields), fields),
        () -> assertReadTags(tables.getByName(table.getFullyQualifiedName(), fields), fields));
  }

  @ParameterizedTest
  @ValueSource(strings = {COLUMNS_ONLY, "columns,tags"})
  void listReturnsPatchedColumnTags(String fields, TestNamespace ns) {
    final Table table = createPatchedTable(ns);
    final var tables = SdkClients.adminClient().tables();
    final Table untagged =
        tables.create(
            tableRequest(ns, table.getDatabaseSchema().getFullyQualifiedName(), "untagged"));
    final List<Table> listed = listTables(table, fields);

    assertEquals(2, listed.size());
    assertReadTags(findTable(listed, table), fields);
    final Table listedUntagged = findTable(listed, untagged);
    assertTrue(nullOrEmpty(listedUntagged.getColumns().getFirst().getTags()));
    assertTrue(nullOrEmpty(listedUntagged.getColumns().get(1).getChildren().getFirst().getTags()));
  }

  private List<Table> listTables(Table table, String fields) {
    return SdkClients.adminClient()
        .tables()
        .list(
            new ListParams()
                .setDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
                .setFields(fields))
        .getData();
  }

  private Table findTable(List<Table> tables, Table expected) {
    return tables.stream()
        .filter(table -> table.getId().equals(expected.getId()))
        .findFirst()
        .orElseThrow();
  }

  private Table createPatchedTable(TestNamespace ns) {
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final var tables = SdkClients.adminClient().tables();
    final Table table =
        tables.create(
            tableRequest(ns, schema.getFullyQualifiedName(), "tagged")
                .withTags(List.of(tagLabel())));
    final Table patched = patchColumnTags(table);
    assertColumnTags(patched);
    return patched;
  }

  private Table patchColumnTags(Table table) {
    final var patch = JsonUtils.getObjectMapper().createArrayNode();
    for (final String path : List.of("/columns/0/tags/-", "/columns/1/children/0/tags/-")) {
      patch.add(JsonUtils.valueToTree(Map.of("op", "add", "path", path, "value", tagLabel())));
    }
    return SdkClients.adminClient().tables().patch(table.getId(), patch);
  }

  private CreateTable tableRequest(TestNamespace ns, String schema, String name) {
    return new CreateTable()
        .withName(ns.shortPrefix(name))
        .withDatabaseSchema(schema)
        .withColumns(
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                new Column()
                    .withName("address")
                    .withDataType(ColumnDataType.STRUCT)
                    .withChildren(
                        List.of(new Column().withName("zip").withDataType(ColumnDataType.INT))),
                new Column().withName("untagged").withDataType(ColumnDataType.INT)));
  }

  private TagLabel tagLabel() {
    return new TagLabel()
        .withTagFQN(SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN())
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private void assertReadTags(Table table, String fields) {
    assertColumnTags(table);
    if (COLUMNS_ONLY.equals(fields)) {
      assertTrue(nullOrEmpty(table.getTags()), "Table tags require fields=tags");
    } else {
      assertTag(table.getTags());
    }
  }

  private void assertColumnTags(Table table) {
    assertEquals(3, table.getColumns().size());
    assertTag(table.getColumns().getFirst().getTags());
    assertTag(table.getColumns().get(1).getChildren().getFirst().getTags());
    assertTrue(nullOrEmpty(table.getColumns().getLast().getTags()));
  }

  private void assertTag(List<TagLabel> tags) {
    assertEquals(List.of(tagLabel().getTagFQN()), tags.stream().map(TagLabel::getTagFQN).toList());
    assertEquals(TagLabel.LabelType.MANUAL, tags.getFirst().getLabelType());
    assertEquals(TagLabel.State.CONFIRMED, tags.getFirst().getState());
  }
}
