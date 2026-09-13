package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityFieldTagProjectionTest {

  @Test
  void equalEntitiesEachReceiveTheirOwnFieldProjection() {
    final Table first = table(new Table(), 2);
    final Table second = JsonUtils.deepCopy(first, Table.class);
    assertEquals(first, second);
    assertNotSame(first.getColumns().getFirst(), second.getColumns().getFirst());
    repository().load(List.of(first, second));
    assertTrue(first.getColumns().stream().allMatch(column -> column.getTags().isEmpty()));
    assertTrue(second.getColumns().stream().allMatch(column -> column.getTags().isEmpty()));
    first.getColumns().getFirst().getTags().add(new TagLabel().withTagFQN("local.tag"));
    assertTrue(second.getColumns().getFirst().getTags().isEmpty());
  }

  @Test
  void fieldLoadingDoesNotHashTheEntireEntityGraph() {
    final HashTrackedTable table = table(new HashTrackedTable(), 1000);
    repository().load(List.of(table));
    assertTrue(table.getColumns().stream().allMatch(column -> column.getTags().isEmpty()));
    assertEquals(
        0, table.hashes.get(), "Field loading must not traverse every entity value for a map key");
  }

  private static <T extends Table> T table(final T table, final int columns) {
    table.setId(UUID.randomUUID());
    table.setName("table");
    table.setFullyQualifiedName("service.database.schema.table");
    table.setColumns(
        IntStream.range(0, columns)
            .mapToObj(
                index ->
                    new Column()
                        .withName("column" + index)
                        .withFullyQualifiedName(table.getFullyQualifiedName() + ".column" + index)
                        .withTags(new ArrayList<>(List.of(new TagLabel().withTagFQN("old.tag")))))
            .toList());
    return table;
  }

  private static TestRepository repository() {
    final CollectionDAO previous = Entity.getCollectionDAO();
    final CollectionDAO collection = mock(CollectionDAO.class);
    final CollectionDAO.TagUsageDAO tags = mock(CollectionDAO.TagUsageDAO.class);
    when(collection.tagUsageDAO()).thenReturn(tags);
    when(tags.getTagsInternalBatch(anyList())).thenReturn(List.of());
    Entity.setCollectionDAO(collection);
    try {
      return new TestRepository();
    } finally {
      Entity.setCollectionDAO(previous);
    }
  }

  private static final class HashTrackedTable extends Table {

    private final AtomicInteger hashes = new AtomicInteger();

    @Override
    public int hashCode() {
      hashes.incrementAndGet();
      return super.hashCode();
    }
  }

  @Repository()
  private static final class TestRepository implements EntityPolicy<Table> {

    private TestRepository() {
      this.entityContext =
          new EntityPolicyContext<>(
              new EntityPolicyContext.Schema<>(
                  "tables", Entity.TABLE, Table.class, mock(CollectionDAO.TableDAO.class)),
              new EntityPolicyContext.WriteFields(Entity.FIELD_TAGS, Entity.FIELD_TAGS, Set.of()),
              EntityModuleDependencies.standard());
      EntityModuleFactory.initialize(this, false);
    }

    private void load(final List<Table> tables) {
      fieldTags().populate(tables, Table::getColumns);
    }

    @Override
    public void setFields(Table entity, Fields fields, RelationIncludes includes) {}

    @Override
    public void clearFields(Table entity, Fields fields) {}

    @Override
    public void prepare(Table entity, boolean update) {}

    @Override
    public void storeEntity(Table entity, boolean update) {}

    @Override
    public void storeRelationships(Table entity) {}

    private final EntityPolicyContext<Table> entityContext;

    @Override
    public final EntityPolicyContext<Table> context() {
      return entityContext;
    }
  }
}
