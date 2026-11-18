package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.FqnKeyedRowCleanup.MAX_KEPT_SUBTREES;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * The probe queries stand in for the entity tables: each test sets which entities they find, and
 * asserts which rows the cleanup then deletes.
 */
class FqnKeyedRowCleanupTest {
  private static final String FQN = "svc";
  private static final String HASH = FullyQualifiedName.buildHash(FQN);
  private static final String OWN_TABLE = "pipeline_service_entity";

  private final CollectionDAO daoCollection = mock(CollectionDAO.class);
  private final CollectionDAO.TagUsageDAO tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);
  private final CollectionDAO.FieldRelationshipDAO fieldRelationshipDAO =
      mock(CollectionDAO.FieldRelationshipDAO.class);
  private final List<String> probes = new ArrayList<>();
  private List<String> namesakeHashes = List.of();
  private List<String> nestedHashes = List.of();
  private MockedStatic<Entity> entity;

  @BeforeEach
  void setUp() {
    when(daoCollection.tagUsageDAO()).thenReturn(tagUsageDAO);
    when(daoCollection.fieldRelationshipDAO()).thenReturn(fieldRelationshipDAO);
    when(tagUsageDAO.listEntityFqnHashes(anyString(), anyMap()))
        .thenAnswer(invocation -> found(invocation.getArgument(0)));
    List<EntityRepository<? extends EntityInterface<?>>> repositories =
        List.of(
            repository(OWN_TABLE, "nameHash", true, false),
            repository("database_service_entity", "nameHash", true, false),
            repository("dashboard_data_model_entity", "fqnHash", true, true),
            repository("user_entity", "nameHash", false, false));
    entity = mockStatic(Entity.class);
    entity.when(Entity::getEntityRepositories).thenReturn(repositories);
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void deletesTheRowsAtAndUnderAnFqnNoOtherEntityShares() {
    cleanup(true).delete(List.of(FQN));

    verify(fieldRelationshipDAO).deleteAllByPrefix(FQN, Entity.PIPELINE_SERVICE);
    verify(tagUsageDAO).deleteTagLabelsByTargetPrefix(FQN);
  }

  @Test
  void keepsEveryRowAtAndUnderAnFqnAnotherTypeHasToo() {
    namesakeHashes = List.of(HASH);

    cleanup(true).delete(List.of(FQN));

    verifyNoInteractions(fieldRelationshipDAO);
    verify(tagUsageDAO, never()).deleteTagLabelsByTargetPrefix(any());
    verify(tagUsageDAO, never()).deleteTagsByTarget(any());
  }

  @Test
  void keepsTheSubtreesOfEntitiesThatNestUnderTheFqn() {
    String model = HASH + ".m1";
    String otherModel = HASH + ".m2";
    nestedHashes = List.of(model + ".c1", otherModel, model);

    cleanup(true).delete(List.of(FQN));

    List<String> kept = List.of(model, otherModel);
    verify(fieldRelationshipDAO).deleteAllByPrefixOutside(FQN, Entity.PIPELINE_SERVICE, kept);
    verify(tagUsageDAO).deleteTagLabelsByTargetPrefixOutside(FQN, kept);
    verify(tagUsageDAO, never()).deleteTagLabelsByTargetPrefix(any());
  }

  @Test
  void deletesOnlyTheRowsAtTheFqnWhenTooManyEntitiesNestUnderIt() {
    nestedHashes =
        IntStream.rangeClosed(0, MAX_KEPT_SUBTREES).mapToObj(index -> HASH + ".m" + index).toList();

    cleanup(true).delete(List.of(FQN));

    verify(tagUsageDAO).deleteTagsByTarget(FQN);
    verify(tagUsageDAO, never()).deleteTagLabelsByTargetPrefixOutside(any(), any());
    verifyNoInteractions(fieldRelationshipDAO);
  }

  @Test
  void aTypeWithoutTagsDeletesItsFieldRelationshipsWithoutProbing() {
    new FqnKeyedRowCleanup(daoCollection, Entity.TYPE, "type_entity", false).delete(List.of(FQN));

    verify(fieldRelationshipDAO).deleteAllByPrefix(FQN, Entity.TYPE);
    verify(tagUsageDAO, never()).listEntityFqnHashes(anyString(), anyMap());
    verify(tagUsageDAO, never()).deleteTagLabelsByTargetPrefix(any());
  }

  @Test
  void looksForNamesakesInOtherTaggableTablesAndForNestedEntitiesInNestingOnes() {
    cleanup(true).delete(List.of(FQN));

    String namesakeProbe = probes.get(0);
    assertTrue(
        namesakeProbe.contains("SELECT nameHash FROM database_service_entity WHERE nameHash IN"));
    assertTrue(namesakeProbe.contains("FROM dashboard_data_model_entity"));
    assertFalse(namesakeProbe.contains(OWN_TABLE), "its own table holds the entity being deleted");
    assertFalse(namesakeProbe.contains("user_entity"), "an untaggable type holds no tag labels");
    assertEquals(
        "(SELECT fqnHash FROM dashboard_data_model_entity WHERE (fqnHash LIKE :under0) LIMIT 1)",
        probes.get(1));
  }

  @Test
  void probesEachBatchTwiceAndListsNestedEntitiesOnlyWhenTheBatchHasAny() {
    List<String> fqns = IntStream.range(0, 120).mapToObj(index -> "svc" + index).toList();

    cleanup(true).delete(fqns);

    assertEquals(6, probes.size(), "a namesake and a nesting probe for each batch of 50");
    fqns.forEach(fqn -> verify(tagUsageDAO).deleteTagLabelsByTargetPrefix(fqn));
  }

  @Test
  void anFqnIsSharedWhenATaggableEntityOfAnotherTypeHasIt() {
    namesakeHashes = List.of(HASH);

    assertTrue(cleanup(true).isSharedByAnotherType(FQN));
    assertFalse(
        new FqnKeyedRowCleanup(daoCollection, Entity.TYPE, "type_entity", false)
            .isSharedByAnotherType(FQN));
  }

  @Test
  void outsideKeptSubtreesKeepsTheRowsAtAndUnderEachKeptSubtree() {
    Map<String, String> bindings = new HashMap<>();

    String condition =
        FqnKeyedRowCleanup.outsideKeptSubtrees("targetFQNHash", List.of("a.b", "a.c"), bindings);

    assertEquals(
        " AND NOT (targetFQNHash = :kept0 OR targetFQNHash LIKE :keptUnder0"
            + " OR targetFQNHash = :kept1 OR targetFQNHash LIKE :keptUnder1)",
        condition);
    assertEquals(
        Map.of("kept0", "a.b", "keptUnder0", "a.b.%", "kept1", "a.c", "keptUnder1", "a.c.%"),
        bindings);
    assertEquals(
        "", FqnKeyedRowCleanup.outsideKeptSubtrees("targetFQNHash", List.of(), new HashMap<>()));
  }

  @Test
  void outermostDropsHashesThatNestUnderAnother() {
    assertEquals(
        List.of("a", "ab"), FqnKeyedRowCleanup.outermost(List.of("ab", "a.x", "a", "a.x.y", "a")));
  }

  private FqnKeyedRowCleanup cleanup(boolean taggable) {
    return new FqnKeyedRowCleanup(daoCollection, Entity.PIPELINE_SERVICE, OWN_TABLE, taggable);
  }

  private List<String> found(String probe) {
    probes.add(probe);
    List<String> found = nestedHashes;
    if (probe.contains(" IN (")) {
      found = namesakeHashes;
    } else if (probe.contains("LIMIT 1)")) {
      found = nestedHashes.stream().limit(1).toList();
    }
    return found;
  }

  @SuppressWarnings("unchecked")
  private static EntityRepository<? extends EntityInterface<?>> repository(
      String table, String hashColumn, boolean taggable, boolean nestsUnderUnrelatedFqns) {
    EntityRepository<? extends EntityInterface<?>> repository = mock(EntityRepository.class);
    EntityDAO<?> dao = mock(EntityDAO.class);
    when(dao.getTableName()).thenReturn(table);
    when(dao.getNameHashColumn()).thenReturn(hashColumn);
    doReturn(dao).when(repository).getDao();
    when(repository.isSupportsTags()).thenReturn(taggable);
    when(repository.nestsUnderUnrelatedFqns()).thenReturn(nestsUnderUnrelatedFqns);
    return repository;
  }
}
