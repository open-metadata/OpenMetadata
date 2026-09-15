package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SessionMultiNodeCluster;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.service.Entity;

/** Additional HTTP nodes must not replace the primary application's transaction dependencies. */
@Isolated("Decorates the primary application's SQL logger after starting additional nodes")
class SessionMultiNodeIsolationIT {
  private static final String EXTENSION = "multi.node.rollback";

  @BeforeAll
  static void startNodes() {
    SessionMultiNodeCluster.getInstance();
  }

  @Test
  void primaryRepositoriesStillShareOneRollbackBoundary() {
    final UUID first = UUID.randomUUID();
    final UUID second = UUID.randomUUID();
    assertThrows(
        IllegalStateException.class,
        () ->
            Entity.getEntityRepository(Entity.CHART)
                .executeInTransaction(
                    () -> {
                      insert(first);
                      Entity.getEntityRepository(Entity.TABLE)
                          .executeInTransaction(
                              () -> {
                                insert(second);
                                return null;
                              });
                      throw new IllegalStateException("Rollback both repositories");
                    }));

    assertNull(read(first));
    assertNull(read(second));
  }

  @Test
  void primaryMetadataReadsRemainObservable() {
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "entity_extension")) {
      assertNull(
          Entity.getEntityRepository(Entity.TABLE)
              .context()
              .dependencies()
              .daos()
              .entityExtensionDAO()
              .getExtension(UUID.randomUUID(), EXTENSION));
      assertEquals(1, queries.count());
    }
  }

  private static void insert(final UUID id) {
    Entity.getCollectionDAO().entityExtensionDAO().insert(id, EXTENSION, EXTENSION, "{}");
  }

  private static String read(final UUID id) {
    return Entity.getCollectionDAO().entityExtensionDAO().getExtension(id, EXTENSION);
  }
}
