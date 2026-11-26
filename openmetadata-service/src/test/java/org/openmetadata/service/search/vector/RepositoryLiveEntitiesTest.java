package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

class RepositoryLiveEntitiesTest {

  /** Only what the table holds not deleted is live, under the id the chunks carry. */
  @Test
  void anEntityTheTableDoesNotHoldLiveIsNotLive() {
    UUID kept = UUID.randomUUID();
    UUID gone = UUID.randomUUID();
    String storedAsUppercase = kept.toString().toUpperCase(Locale.ROOT);
    EntityRepository<? extends EntityInterface<?>> tables =
        tablesHolding(List.of(kept, gone), kept);

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.hasEntityRepository(Entity.TABLE)).thenReturn(true);
      entities.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenAnswer(call -> tables);

      Set<String> live =
          new RepositoryLiveEntities()
              .of(Entity.TABLE, List.of(storedAsUppercase, gone.toString()));

      assertEquals(Set.of(storedAsUppercase), live);
    }
  }

  /**
   * The sweep reads ids only. A row whose JSON the server cannot build an entity from would
   * otherwise fail every pass, and the runner would read the whole chunk index again every 15
   * minutes.
   */
  @Test
  void aRowThatCannotBeReadAsAnEntityStillCountsAsLive() {
    UUID unreadable = UUID.randomUUID();
    EntityRepository<? extends EntityInterface<?>> tables =
        tablesHolding(List.of(unreadable), unreadable);
    when(tables.find(anyList(), any()))
        .thenThrow(new JsonParsingException("Unrecognized field \"retiredField\""));

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.hasEntityRepository(Entity.TABLE)).thenReturn(true);
      entities.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenAnswer(call -> tables);

      Set<String> live =
          new RepositoryLiveEntities().of(Entity.TABLE, List.of(unreadable.toString()));

      assertEquals(Set.of(unreadable.toString()), live);
    }
  }

  /** What this server cannot check keeps its chunks. */
  @Test
  void aTypeWithoutARepositoryOrAnIdThatIsNoEntityIdCountsAsLive() {
    String entityId = UUID.randomUUID().toString();

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.hasEntityRepository(anyString())).thenReturn(false);

      Set<String> live = new RepositoryLiveEntities().of("retiredType", List.of(entityId, "x_1"));

      assertEquals(Set.of(entityId, "x_1"), live);
      entities.verify(() -> Entity.getEntityRepository(anyString()), never());
    }
  }

  @SuppressWarnings("unchecked")
  private static EntityRepository<? extends EntityInterface<?>> tablesHolding(
      List<UUID> asked, UUID live) {
    EntityRepository<? extends EntityInterface<?>> tables = mock(EntityRepository.class);
    EntityDAO<EntityInterface<?>> rows = mock(EntityDAO.class);
    when(rows.findReferencesByIds(asked, Include.NON_DELETED))
        .thenReturn(List.of(new EntityReference().withId(live).withType(Entity.TABLE)));
    when(tables.getDao()).thenAnswer(call -> rows);
    return tables;
  }
}
