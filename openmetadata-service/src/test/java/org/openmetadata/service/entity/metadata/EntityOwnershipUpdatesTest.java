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
import org.openmetadata.service.entity.history.EntityVersionPolicy;
import org.openmetadata.service.entity.metadata.EntityOwnershipUpdates.Decision;
import org.openmetadata.service.entity.metadata.EntityOwnershipUpdates.Policy;
import org.openmetadata.service.entity.write.EntityChangeRecorder;

class EntityOwnershipUpdatesTest {
  @Test
  void decisionsCalculateIncrementalAndSessionDeltasWithoutChangingInputs() {
    final EntityReference first = ref(Entity.USER);
    final EntityReference second = ref(Entity.TEAM);
    final EntityReference third = ref(Entity.USER).withId(new UUID(0, 3));
    final List<EntityReference> baseline = List.of(first);
    final List<EntityReference> current = List.of(second);
    final List<EntityReference> requested = List.of(third);
    final Decision incremental = Decision.between(current, requested, Policy.PATCH, true);
    final Decision consolidated = Decision.between(baseline, requested, Policy.PATCH, true);
    assertEquals(current, incremental.change().values().deleted());
    assertEquals(baseline, consolidated.change().values().deleted());
    assertEquals(requested, incremental.change().values().added());
    assertEquals(requested, consolidated.change().values().added());
    assertEquals(List.of(first), baseline);
    assertEquals(List.of(second), current);
    assertEquals(List.of(third), requested);
    final ChangeDescription changes = new ChangeDescription();
    EntityChangeRecorder.recordList(changes, Entity.FIELD_OWNERS, incremental.change());
    assertEquals(1, changes.getFieldsAdded().size());
    assertEquals(1, changes.getFieldsDeleted().size());
    assertEquals(current, incremental.change().values().deleted());
  }

  @Test
  void decisionsRetainImportInheritanceAndPatchSelectionSemantics() {
    final List<EntityReference> inherited = List.of(ref(Entity.USER).withInherited(true));
    final Decision imported = Decision.between(inherited, List.of(), Policy.IMPORT_OWNERS, true);
    assertEquals(List.of(), imported.result());
    assertFalse(imported.changed());
    assertSame(inherited, Decision.between(inherited, List.of(), Policy.PATCH, true).result());
    final List<EntityReference> requested = List.of(ref(Entity.TEAM));
    assertSame(inherited, Decision.between(inherited, requested, Policy.PATCH, false).result());
    assertFalse(Decision.between(inherited, requested, Policy.PATCH, false).changed());
    final List<EntityReference> local = List.of(ref(Entity.USER));
    assertSame(local, Decision.between(local, List.of(), Policy.PUT, true).result());
    assertEquals(List.of(), Decision.between(local, List.of(), Policy.PATCH, true).result());
  }

  @Test
  void consolidatedOwnershipHistoryCanBeVersionedWithoutApplyingIncrementalWrites() {
    final Table baseline = new Table().withVersion(1.0).withOwners(List.of(ref(Entity.USER)));
    final List<EntityReference> current = List.of(ref(Entity.TEAM));
    final Decision incremental =
        Decision.between(current, baseline.getOwners(), Policy.PATCH, true);
    final Decision consolidated =
        Decision.between(baseline.getOwners(), baseline.getOwners(), Policy.PATCH, true);
    assertTrue(incremental.changed());
    assertFalse(consolidated.changed());
    final ChangeDescription changes = new ChangeDescription();
    EntityChangeRecorder.recordList(changes, Entity.FIELD_OWNERS, consolidated.change());
    final Table result = new Table().withOwners(consolidated.result());
    assertFalse(
        EntityVersionPolicy.updateVersion(baseline, result, changes, baseline.getVersion(), false));
    assertEquals(1.0, result.getVersion());
    assertEquals(List.of(ref(Entity.USER)), result.getOwners());
    assertEquals(List.of(ref(Entity.TEAM)), current);
  }

  @Test
  void ordinaryPutCannotRemoveOwnersOrDomains() {
    final Fixture fixture = new Fixture();
    fixture.original.withOwners(List.of(ref(Entity.USER))).withDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, false);
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated, false);
    assertSame(fixture.original.getOwners(), fixture.updated.getOwners());
    assertSame(fixture.original.getDomains(), fixture.updated.getDomains());
    fixture.assertNoWrites();
  }

  @Test
  void patchCanRemoveOwnersAndDomainsWithRecordedDeletions() {
    final Fixture fixture = new Fixture();
    fixture.patch = true;
    fixture.original.withOwners(List.of(ref(Entity.USER))).withDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, false);
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated, false);
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
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, false);
    assertSame(fixture.original.getOwners(), fixture.updated.getOwners());
    assertEquals(1, fixture.permissionReads);
    fixture.patch = true;
    final List<EntityReference> malformed = new ArrayList<>();
    malformed.add(null);
    fixture.updated.setOwners(malformed);
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, false);
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
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, false);
    assertEquals(Entity.TEAM, fixture.owners.getFirst().getType());
    assertEquals(0, fixture.permissionReads);
    fixture.override = false;
    fixture.original.setOwners(null);
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, false);
    assertEquals(0, fixture.permissionReads);
    fixture.original.setOwners(List.of(ref(Entity.USER)));
    fixture.denyOwners = false;
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, false);
    assertEquals(Entity.TEAM, fixture.owners.getFirst().getType());
  }

  @Test
  void botPutPreservesDomainsEvenWithOverrideWhilePatchCanReplaceThem() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.override = true;
    fixture.original.setDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updated.setDomains(List.of(ref(Entity.DOMAIN).withId(new UUID(0, 3))));
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated, false);
    assertSame(fixture.original.getDomains(), fixture.updated.getDomains());
    fixture.assertNoWrites();
    fixture.patch = true;
    fixture.updated.setDomains(List.of(ref(Entity.DOMAIN).withId(new UUID(0, 3))));
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated, false);
    assertEquals(new UUID(0, 3), fixture.domains.getFirst().getId());
    assertEquals(0, fixture.permissionReads);
  }

  @Test
  void importCanRemoveValuesWithoutOrdinaryBotRestrictions() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.denyOwners = true;
    fixture.original.withOwners(List.of(ref(Entity.USER))).withDomains(List.of(ref(Entity.DOMAIN)));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, true);
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated, true);
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
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, true);
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated, true);
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
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, false);
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
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, false);
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated, false);
    fixture.selected = false;
    fixture
        .updated
        .withOwners(List.of(ref(Entity.TEAM)))
        .withDomains(List.of(ref(Entity.DOMAIN).withId(new UUID(0, 3))));
    fixture.updates.updateOwners(fixture, fixture.original, fixture.updated, true);
    fixture.updates.updateDomains(fixture, fixture.original, fixture.updated, true);
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
        () -> fixture.updates.updateDomains(fixture, fixture.original, fixture.updated, false));
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
    public boolean shouldCompare(final String field) {
      return selected;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return changes;
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
