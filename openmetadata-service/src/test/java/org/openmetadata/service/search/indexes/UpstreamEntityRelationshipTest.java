package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.openmetadata.schema.type.Include.ALL;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.api.entityRelationship.EsEntityRelationshipData;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableConstraint.ConstraintType;
import org.openmetadata.schema.type.TableConstraint.RelationshipType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

/**
 * A foreign key's relationshipType is ingested from the constrained (FK) table's side: MANY_TO_ONE
 * means "many FK rows per referenced row". The index stores the edge from the referenced table's
 * side (columnFQN = referenced column), so the relationshipType on the edge has to be read from that
 * side too, or the ER diagram draws the crow's foot on the wrong table.
 */
class UpstreamEntityRelationshipTest {

  private static final String SCHEMA_FQN = "svc.db.party";
  private static final String PARENT_FQN = SCHEMA_FQN + ".organization";
  private static final String CHILD_FQN = SCHEMA_FQN + ".organization_duns";
  private static final String PARENT_PK = PARENT_FQN + ".party_guid";
  private static final String PARENT_TYPE_PK = PARENT_FQN + ".organization_type_id";

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository searchRepository = mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
    entityStaticMock
        .when(() -> Entity.getEntityByName(Entity.TABLE, PARENT_FQN, "*", ALL))
        .thenReturn(table(PARENT_FQN, "party_guid", "organization_type_id"));
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  static Stream<Arguments> foreignKeyToEdgeRelationship() {
    return Stream.of(
        Arguments.of(RelationshipType.MANY_TO_ONE, "ONE_TO_MANY"),
        Arguments.of(RelationshipType.ONE_TO_MANY, "MANY_TO_ONE"),
        Arguments.of(RelationshipType.ONE_TO_ONE, "ONE_TO_ONE"),
        Arguments.of(RelationshipType.MANY_TO_MANY, "MANY_TO_MANY"));
  }

  @ParameterizedTest
  @MethodSource("foreignKeyToEdgeRelationship")
  void edgeRelationshipIsReadFromTheReferencedSide(
      RelationshipType foreignKeyRelationship, String expectedEdgeRelationship) {
    Table child = childReferencing(foreignKey("party_guid", PARENT_PK, foreignKeyRelationship));

    var edgeColumn = onlyEdge(child).getColumns().getFirst();

    assertEquals(PARENT_PK, edgeColumn.getColumnFQN());
    assertEquals(CHILD_FQN + ".party_guid", edgeColumn.getRelatedColumnFQN());
    assertEquals(expectedEdgeRelationship, edgeColumn.getRelationshipType());
  }

  @Test
  void edgeRelationshipStaysUnsetWhenForeignKeyHasNone() {
    Table child = childReferencing(foreignKey("party_guid", PARENT_PK, null));

    assertNull(onlyEdge(child).getColumns().getFirst().getRelationshipType());
  }

  @Test
  void secondForeignKeyToSameTableIsReadFromTheReferencedSide() {
    Table child =
        childReferencing(
            foreignKey("party_guid", PARENT_PK, RelationshipType.MANY_TO_ONE),
            foreignKey("organization_type_id", PARENT_TYPE_PK, RelationshipType.ONE_TO_MANY));

    var edgeColumns = onlyEdge(child).getColumns();

    assertEquals(2, edgeColumns.size());
    assertEquals(PARENT_TYPE_PK, edgeColumns.get(1).getColumnFQN());
    assertEquals("ONE_TO_MANY", edgeColumns.get(0).getRelationshipType());
    assertEquals("MANY_TO_ONE", edgeColumns.get(1).getRelationshipType());
  }

  private static EsEntityRelationshipData onlyEdge(Table child) {
    List<Map<String, Object>> edges = SearchIndex.populateUpstreamEntityRelationshipData(child);
    assertEquals(1, edges.size());
    return JsonUtils.convertValue(edges.getFirst(), EsEntityRelationshipData.class);
  }

  private static Table childReferencing(TableConstraint... foreignKeys) {
    return table(CHILD_FQN, "party_guid", "organization_type_id")
        .withTableConstraints(List.of(foreignKeys));
  }

  private static TableConstraint foreignKey(
      String column, String referredColumn, RelationshipType relationshipType) {
    return new TableConstraint()
        .withConstraintType(ConstraintType.FOREIGN_KEY)
        .withColumns(List.of(column))
        .withReferredColumns(List.of(referredColumn))
        .withRelationshipType(relationshipType);
  }

  private static Table table(String fqn, String... columnNames) {
    List<Column> columns =
        Stream.of(columnNames)
            .map(
                name ->
                    new Column()
                        .withName(name)
                        .withDataType(ColumnDataType.STRING)
                        .withFullyQualifiedName(fqn + "." + name))
            .toList();
    return new Table()
        .withId(UUID.randomUUID())
        .withName(fqn.substring(fqn.lastIndexOf('.') + 1))
        .withFullyQualifiedName(fqn)
        .withColumns(columns);
  }
}
