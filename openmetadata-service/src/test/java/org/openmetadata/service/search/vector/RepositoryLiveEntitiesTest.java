package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

class RepositoryLiveEntitiesTest {

  /** Only what the repository finds not deleted is live, under the id the chunks carry. */
  @Test
  void anEntityTheRepositoryDoesNotFindLiveIsNotLive() {
    UUID kept = UUID.randomUUID();
    UUID gone = UUID.randomUUID();
    String storedAsUppercase = kept.toString().toUpperCase(Locale.ROOT);
    EntityRepository<? extends EntityInterface<?>> tables = mock(EntityRepository.class);
    when(tables.find(List.of(kept, gone), Include.NON_DELETED))
        .thenAnswer(call -> List.of(new Table().withId(kept)));

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.hasEntityRepository(Entity.TABLE)).thenReturn(true);
      entities.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenAnswer(call -> tables);

      Set<String> live =
          new RepositoryLiveEntities()
              .of(Entity.TABLE, List.of(storedAsUppercase, gone.toString()));

      assertEquals(Set.of(storedAsUppercase), live);
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
}
