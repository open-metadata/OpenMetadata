package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;

class EntityOwnershipUpdatesTest {
  @Test
  void ordinaryPutCannotRemoveOwnersOrDomains() {
    final Fixture fixture = new Fixture();
    fixture.original.withOwners(List.of(ref(Entity.USER))).withDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated);
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated);
    assertSame(fixture.original.getOwners(), fixture.updated.getOwners());
    assertSame(fixture.original.getDomains(), fixture.updated.getDomains());
    fixture.assertNoWrites();
  }

  @Test
  void patchCanRemoveOwnersAndDomainsWithRecordedDeletions() {
    final Fixture fixture = new Fixture();
    fixture.patch = true;
    fixture.original.withOwners(List.of(ref(Entity.USER))).withDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated);
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated);
    assertEquals(List.of(), fixture.updated.getOwners());
    assertEquals(List.of(), fixture.updated.getDomains());
    assertEquals(List.of(), fixture.owners);
    assertEquals(List.of(), fixture.domains);
    assertEquals(2, fixture.changes.getFieldsDeleted().size());
  }

  @Test
  void deniedBotKeepsOwnersDuringPutAndPatch() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.denyOwners = true;
    fixture.original.setOwners(List.of(ref(Entity.USER)));
    fixture.updated.setOwners(List.of(ref(Entity.TEAM)));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated);
    assertSame(fixture.original.getOwners(), fixture.updated.getOwners());
    assertEquals(1, fixture.permissionReads);
    fixture.patch = true;
    fixture.updated.setOwners(null);
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated);
    assertSame(fixture.original.getOwners(), fixture.updated.getOwners());
    fixture.assertNoWrites();
  }

  @Test
  void ownerOverrideAllowedBotsAndInitiallyEmptyOwnershipKeepTheirExistingBehavior() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.denyOwners = true;
    fixture.override = true;
    fixture.original.setOwners(List.of(ref(Entity.USER)));
    fixture.updated.setOwners(List.of(ref(Entity.TEAM)));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated);
    assertEquals(Entity.TEAM, fixture.owners.getFirst().getType());
    assertEquals(0, fixture.permissionReads);
    fixture.override = false;
    fixture.original.setOwners(null);
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated);
    assertEquals(0, fixture.permissionReads);
    fixture.original.setOwners(List.of(ref(Entity.USER)));
    fixture.denyOwners = false;
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated);
    assertEquals(Entity.TEAM, fixture.owners.getFirst().getType());
  }

  @Test
  void botPutPreservesDomainsEvenWithOverrideWhilePatchCanReplaceThem() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.override = true;
    fixture.original.setDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updated.setDomains(List.of(ref(Entity.DOMAIN).withId(new UUID(0, 3))));
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated);
    assertSame(fixture.original.getDomains(), fixture.updated.getDomains());
    fixture.assertNoWrites();
    fixture.patch = true;
    fixture.updated.setDomains(List.of(ref(Entity.DOMAIN).withId(new UUID(0, 3))));
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated);
    assertEquals(new UUID(0, 3), fixture.domains.getFirst().getId());
    assertEquals(0, fixture.permissionReads);
  }

  @Test
  void importCanRemoveValuesWithoutOrdinaryBotRestrictions() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.denyOwners = true;
    fixture.original.withOwners(List.of(ref(Entity.USER))).withDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updates.updateOwnersForImport(fixture, fixture.original, fixture.updated);
    fixture.updates.updateDomainsForImport(fixture, fixture.original, fixture.updated);
    assertEquals(List.of(), fixture.owners);
    assertEquals(List.of(), fixture.domains);
    assertEquals(0, fixture.permissionReads);
  }

  @Test
  void unchangedImportsKeepDistinctOwnerAndDomainInheritanceFallbacks() {
    final Fixture fixture = new Fixture();
    fixture
        .original
        .withOwners(List.of(ref(Entity.USER).withInherited(true)))
        .withDomains(List.of(ref(Entity.DOMAIN).withInherited(true)));
    fixture.updates.updateOwnersForImport(fixture, fixture.original, fixture.updated);
    fixture.updates.updateDomainsForImport(fixture, fixture.original, fixture.updated);
    assertTrue(fixture.updated.getOwners().isEmpty());
    assertSame(fixture.original.getDomains(), fixture.updated.getDomains());
    fixture.assertNoWrites();
  }

  @Test
  void writesAndChangeDescriptionsUseOnlyLocalReferencesAndKeepOrder() {
    final Fixture fixture = new Fixture();
    final EntityReference inherited = ref(Entity.USER).withInherited(true);
    final EntityReference first = ref(Entity.TEAM);
    final EntityReference second = ref(Entity.USER).withId(new UUID(0, 3));
    fixture.updated.setOwners(List.of(inherited, first, second));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated);
    assertEquals(List.of(first, second), fixture.owners);
    assertEquals(List.of(first, second), fixture.updated.getOwners());
    fixture.updated.getOwners().add(ref(Entity.USER));
    assertEquals(1, fixture.changes.getFieldsAdded().size());
  }

  @Test
  void unchangedOrUnselectedValuesRetainTheOriginalProjection() {
    final Fixture fixture = new Fixture();
    fixture.original.withOwners(List.of(ref(Entity.USER))).withDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updated.withOwners(List.of(ref(Entity.USER))).withDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated);
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated);
    fixture.selected = false;
    fixture
        .updated
        .withOwners(List.of(ref(Entity.TEAM)))
        .withDomains(List.of(ref(Entity.DOMAIN).withId(new UUID(0, 3))));
    fixture.updates.updateOwnersForImport(fixture, fixture.original, fixture.updated);
    fixture.updates.updateDomainsForImport(fixture, fixture.original, fixture.updated);
    assertEquals(fixture.original.getOwners(), fixture.updated.getOwners());
    assertSame(fixture.original.getDomains(), fixture.updated.getDomains());
    fixture.assertNoWrites();
  }

  @Test
  void malformedDomainsStillFailBeforeTheBotPutGuard() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    final List<EntityReference> malformed = new ArrayList<>();
    malformed.add(null);
    fixture.original.setDomains(malformed);
    assertThrows(
        NullPointerException.class,
        () -> fixture.updates.updateDomains(fixture, fixture.original, fixture.updated));
    fixture.assertNoWrites();
  }

  private static EntityReference ref(final String type) {
    return new EntityReference().withId(new UUID(0, 1)).withType(type).withName(type);
  }

  private static final class Fixture implements EntityOwnershipUpdates.Session<Table> {
    private final EntityOwnershipUpdates<Table> updates = new EntityOwnershipUpdates<>();
    private final Table original = new Table();
    private final Table updated = new Table();
    private final ChangeDescription changes = new ChangeDescription();
    private List<EntityReference> owners;
    private List<EntityReference> domains;
    private int writes;
    private int permissionReads;
    private boolean patch;
    private boolean bot;
    private boolean denyOwners;
    private boolean override;
    private boolean selected = true;

    private void assertNoWrites() {
      assertEquals(0, writes);
      assertFalse(EntityChangeRecorder.hasChanges(changes));
    }

    @Override
    public boolean isPut() {
      return !patch;
    }

    @Override
    public boolean isPatch() {
      return patch;
    }

    @Override
    public boolean updatedByBot() {
      return bot;
    }

    @Override
    public boolean isOverrideMetadata() {
      return override;
    }

    @Override
    public boolean updatingBotDeniedOperation(final MetadataOperation operation) {
      assertEquals(MetadataOperation.EDIT_OWNERS, operation);
      permissionReads++;
      return denyOwners;
    }

    @Override
    public boolean recordReferenceChanges(
        final String field, final ListChange<EntityReference> values) {
      return selected && EntityChangeRecorder.recordList(changes, field, values);
    }

    @Override
    public void updateOwners(
        final Table entity,
        final List<EntityReference> original,
        final List<EntityReference> updated) {
      owners = updated;
      writes++;
    }

    @Override
    public void updateDomains(
        final Table entity,
        final List<EntityReference> original,
        final List<EntityReference> updated) {
      domains = updated;
      writes++;
    }
  }
}
