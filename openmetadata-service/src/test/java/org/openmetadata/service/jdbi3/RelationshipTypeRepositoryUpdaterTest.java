package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import jakarta.ws.rs.BadRequestException;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository.Operation;

@Isolated
class RelationshipTypeRepositoryUpdaterTest {
  private static final UUID OWNER_ID = UUID.fromString("00000000-0000-0000-0000-000000000011");
  private static final UUID PEER_ID = UUID.fromString("00000000-0000-0000-0000-000000000012");
  private static final String PEER = "peer";
  private RelationshipTypeRepository repository;

  @BeforeEach
  void setup() {
    Entity.setCollectionDAO(mock(CollectionDAO.class));
    repository = new RelationshipTypeRepository();
  }

  @AfterEach
  void cleanup() {
    Entity.cleanup();
  }

  @Test
  void updaterCannotStripANamedInverseWhenPrepareIsBypassed() {
    final RelationshipType original = type(PEER);
    final var updater =
        repository.new RelationshipTypeUpdater(original, type(null), Operation.PATCH);
    updater.changeDescription = new ChangeDescription();
    assertThrows(BadRequestException.class, () -> updater.entitySpecificUpdate(false));
    assertEquals(PEER, original.getInverse().getName());
  }

  @Test
  void consolidationDoesNotApplyRequestGuardToAnOlderNamedVersion() {
    var updater = updater();
    updater.entitySpecificUpdate(false);
    assertNull(updater.getUpdated().getInverse().getName());

    RelationshipType historicalVersion = type(PEER);
    updater.updated = historicalVersion;
    updater.entitySpecificUpdate(true);
    assertEquals(PEER, historicalVersion.getInverse().getName());
  }

  @Test
  void transactionRetryReappliesTheGuardToRestoredRequestState() {
    var updater = updater();
    updater.entitySpecificUpdate(false);
    assertNull(updater.getUpdated().getInverse().getName());

    updater.original = type(null);
    updater.updated = type(PEER);
    updater.changeDescription = new ChangeDescription();
    updater.resetForRetryAttempt();
    updater.entitySpecificUpdate(false);
    assertNull(updater.getUpdated().getInverse().getName());
  }

  private RelationshipTypeRepository.RelationshipTypeUpdater updater() {
    var updater = repository.new RelationshipTypeUpdater(type(null), type(PEER), Operation.PUT);
    updater.changeDescription = new ChangeDescription();
    return updater;
  }

  private static RelationshipType type(String inverseName) {
    return new RelationshipType()
        .withId(OWNER_ID)
        .withName("owner")
        .withFullyQualifiedName("owner")
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withSystemDefined(false)
        .withInverse(
            new EntityReference()
                .withId(PEER_ID)
                .withFullyQualifiedName(PEER)
                .withName(inverseName));
  }
}
