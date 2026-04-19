package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.State;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

class TableRepositoryColumnTagsTest {
  private CollectionDAO collectionDAO;
  private CollectionDAO.TagUsageDAO tagUsageDAO;
  private TableRepository repository;

  @BeforeEach
  void setUp() {
    Entity.cleanup();

    collectionDAO = mock(CollectionDAO.class);
    tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);

    when(collectionDAO.tableDAO()).thenReturn(mock(CollectionDAO.TableDAO.class));
    when(collectionDAO.tagUsageDAO()).thenReturn(tagUsageDAO);
    Entity.setCollectionDAO(collectionDAO);

    repository = new TableRepository();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void setFields_hydratesColumnTagsWhenOnlyColumnsAreRequested() {
    Table table = tableWithColumn("service.database.schema.users", "email");
    TagLabel piiTag =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(LabelType.MANUAL)
            .withState(State.CONFIRMED);
    String columnFqn = table.getColumns().getFirst().getFullyQualifiedName();

    when(tagUsageDAO.getTagsByPrefix(table.getFullyQualifiedName(), ".%", true))
        .thenReturn(Map.of(FullyQualifiedName.buildHash(columnFqn), List.of(piiTag)));

    repository.setFields(
        table,
        new Fields(repository.getAllowedFields(), "columns"),
        RelationIncludes.fromInclude(Include.NON_DELETED));

    assertNull(table.getTags());
    assertColumnTags(table, piiTag);
  }

  @Test
  void setFieldsInBulk_hydratesColumnTagsWhenOnlyColumnsAreRequested() {
    Table table = tableWithColumn("service.database.schema.users", "email");
    TagLabel piiTag =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(LabelType.MANUAL)
            .withState(State.CONFIRMED);
    String columnFqn = table.getColumns().getFirst().getFullyQualifiedName();

    when(tagUsageDAO.getTagsInternalBatch(anyList()))
        .thenReturn(List.of(tagUsage(columnFqn, piiTag)));

    repository.setFieldsInBulk(
        new Fields(repository.getAllowedFields(), "columns"), List.of(table));

    assertNull(table.getTags());
    assertColumnTags(table, piiTag);
  }

  private static Table tableWithColumn(String tableFqn, String columnName) {
    String schemaFqn = FullyQualifiedName.getParentFQN(tableFqn);
    String databaseFqn = FullyQualifiedName.getParentFQN(schemaFqn);
    String serviceFqn = FullyQualifiedName.getParentFQN(databaseFqn);
    Column column =
        new Column()
            .withName(columnName)
            .withFullyQualifiedName(FullyQualifiedName.add(tableFqn, columnName))
            .withDataType(ColumnDataType.STRING);

    return new Table()
        .withId(UUID.randomUUID())
        .withName(FullyQualifiedName.getShortName(tableFqn))
        .withFullyQualifiedName(tableFqn)
        .withDatabaseSchema(entityReference(Entity.DATABASE_SCHEMA, schemaFqn))
        .withDatabase(entityReference(Entity.DATABASE, databaseFqn))
        .withService(entityReference(Entity.DATABASE_SERVICE, serviceFqn))
        .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
        .withColumns(List.of(column));
  }

  private static EntityReference entityReference(String type, String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(FullyQualifiedName.getShortName(fqn))
        .withFullyQualifiedName(fqn);
  }

  private static CollectionDAO.TagUsageDAO.TagLabelWithFQNHash tagUsage(
      String targetFqn, TagLabel tagLabel) {
    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash usage =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    usage.setTargetFQNHash(FullyQualifiedName.buildHash(targetFqn));
    usage.setSource(tagLabel.getSource().ordinal());
    usage.setTagFQN(tagLabel.getTagFQN());
    usage.setLabelType(tagLabel.getLabelType().ordinal());
    usage.setState(tagLabel.getState().ordinal());
    return usage;
  }

  private static void assertColumnTags(Table table, TagLabel expectedTag) {
    List<TagLabel> tags = table.getColumns().getFirst().getTags();
    assertEquals(1, tags.size());
    assertEquals(expectedTag.getTagFQN(), tags.getFirst().getTagFQN());
    assertEquals(expectedTag.getSource(), tags.getFirst().getSource());
    assertEquals(expectedTag.getLabelType(), tags.getFirst().getLabelType());
    assertEquals(expectedTag.getState(), tags.getFirst().getState());
  }
}
