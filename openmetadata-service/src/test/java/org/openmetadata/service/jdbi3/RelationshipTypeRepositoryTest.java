package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.jdbi3.EntityRepository.Operation;

class RelationshipTypeRepositoryTest {
  private static final UUID OWNER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID PEER_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final UUID OTHER_ID = UUID.fromString("00000000-0000-0000-0000-000000000003");
  private static final String OWNER = "owner";
  private static final String PEER = "peer";

  @Test
  void newInverseAndAlreadyNamedDefinitionsUseThePreparedReference() {
    EntityReference requested = reference(OTHER_ID, "other", "other");
    for (EntityReference stored : new EntityReference[] {null, reference(PEER_ID, PEER, PEER)}) {
      assertSame(requested, apply(stored, requested, Operation.PUT, true));
    }
    final EntityReference pendingBatchReference = reference(OTHER_ID, "pending", null);
    assertSame(pendingBatchReference, apply(null, pendingBatchReference, Operation.PUT, true));
  }

  @Test
  void namedInverseCannotLoseItsNameWithoutPrepare() {
    final EntityReference stored = reference(PEER_ID, PEER, PEER);
    for (final Operation operation : new Operation[] {Operation.PUT, Operation.PATCH}) {
      assertThrows(
          BadRequestException.class,
          () -> apply(stored, reference(PEER_ID, PEER, null), operation, true));
    }
  }

  @Test
  void deliberateRemovalOfAnAlreadyNamedInverseKeepsItsExistingBehavior() {
    assertNull(apply(reference(PEER_ID, PEER, PEER), null, Operation.PATCH, true));
  }

  @Test
  void putKeepsTheWholeLegacyReferenceById() {
    EntityReference stored = reference(PEER_ID, PEER, null);
    stored.setDescription("Existing presentation metadata");
    assertSame(stored, apply(stored, reference(PEER_ID, PEER, PEER), Operation.PUT, true));
  }

  @Test
  void putKeepsFqnOnlyLegacyReference() {
    EntityReference stored = reference(null, PEER, null);
    assertSame(stored, apply(stored, reference(PEER_ID, PEER, PEER), Operation.PUT, true));
  }

  @Test
  void putOmissionAndUnrelatedPatchKeepTheLegacyReference() {
    EntityReference stored = reference(null, PEER, null);
    assertSame(stored, apply(stored, null, Operation.PUT, true));
    assertSame(stored, apply(stored, reference(PEER_ID, PEER, PEER), Operation.PATCH, false));
  }

  @Test
  void unchangedNamelessPatchIsAllowed() {
    EntityReference stored = reference(PEER_ID, PEER, null);
    EntityReference requested = reference(PEER_ID, PEER, null);
    assertSame(requested, apply(stored, requested, Operation.PATCH, true));
  }

  @Test
  void explicitActivationAndRemovalAreRejected() {
    EntityReference stored = reference(PEER_ID, PEER, null);
    BadRequestException activation =
        assertThrows(
            BadRequestException.class,
            () -> apply(stored, reference(PEER_ID, PEER, PEER), Operation.PATCH, true));
    assertTrue(activation.getMessage().contains("legacy inverse"));
    assertTrue(activation.getMessage().contains(OWNER));
    assertThrows(BadRequestException.class, () -> apply(stored, null, Operation.PATCH, true));
  }

  @Test
  void putAndPatchCannotRetargetLegacyInverse() {
    for (Operation operation : new Operation[] {Operation.PUT, Operation.PATCH}) {
      assertThrows(
          BadRequestException.class,
          () ->
              apply(
                  reference(PEER_ID, PEER, null),
                  reference(OTHER_ID, "other", "other"),
                  operation,
                  true));
    }
  }

  @Test
  void differentKnownIdsOverrideMatchingFqns() {
    assertThrows(
        BadRequestException.class,
        () ->
            apply(
                reference(PEER_ID, PEER, null),
                reference(OTHER_ID, PEER, PEER),
                Operation.PUT,
                true));
  }

  @Test
  void missingIdentityDoesNotMatchAnotherMissingIdentity() {
    assertThrows(
        BadRequestException.class,
        () -> apply(reference(null, null, null), reference(null, null, null), Operation.PUT, true));
  }

  @Test
  void actualSelfNameAndIdentityCanBeActivated() {
    EntityReference self = reference(OWNER_ID, OWNER, OWNER);
    assertSame(self, apply(reference(PEER_ID, PEER, null), self, Operation.PATCH, true));
    EntityReference fqnSelf = reference(null, OWNER, OWNER);
    assertSame(fqnSelf, apply(reference(null, OWNER, null), fqnSelf, Operation.PUT, true));
  }

  @Test
  void selfIdCannotDisguiseAnotherEffectiveInverseName() {
    assertThrows(
        BadRequestException.class,
        () ->
            apply(
                reference(PEER_ID, PEER, null),
                reference(OWNER_ID, OWNER, PEER),
                Operation.PATCH,
                true));
  }

  @Test
  void selfNameCannotDisguiseAnotherKnownId() {
    assertThrows(
        BadRequestException.class,
        () ->
            apply(
                reference(PEER_ID, PEER, null),
                reference(PEER_ID, OWNER, OWNER),
                Operation.PATCH,
                true));
  }

  private static EntityReference apply(
      EntityReference stored,
      EntityReference requested,
      Operation operation,
      boolean inverseRequested) {
    return RelationshipTypeRepository.inverseForUpdate(
        owner(stored), owner(requested), operation, inverseRequested);
  }

  private static RelationshipType owner(EntityReference inverse) {
    return new RelationshipType()
        .withId(OWNER_ID)
        .withName(OWNER)
        .withFullyQualifiedName(OWNER)
        .withInverse(inverse);
  }

  private static EntityReference reference(UUID id, String fqn, String name) {
    return new EntityReference()
        .withId(id)
        .withType("relationshipType")
        .withFullyQualifiedName(fqn)
        .withName(name);
  }
}
