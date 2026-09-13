package org.openmetadata.service.entity.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO.EntityIdFqnPair;

class EntityCacheTargetsTest {
  @Test
  void renameReturnsTheSameRowsForTheSecondEvictionPass() {
    final Fixture fixture = new Fixture();
    final List<EntityIdFqnPair> affected = fixture.targets.beforeRename(Entity.TAG, "old");
    assertSame(fixture.descendants, affected);
    assertTrue(fixture.cached.asMap().isEmpty());
    fixture.prime();
    fixture.targets.afterRename(Entity.TAG, affected);
    assertTrue(fixture.cached.asMap().isEmpty());
    assertEquals(1, fixture.descendantReads);
  }

  @Test
  void missingRenameInputsDoNotReadSourcesOrEvictEntries() {
    final Fixture fixture = new Fixture();
    assertTrue(fixture.targets.beforeRename(null, "old").isEmpty());
    assertTrue(fixture.targets.beforeRename(Entity.TAG, "").isEmpty());
    fixture.targets.afterRename(null, fixture.descendants);
    fixture.targets.afterRename(Entity.TAG, null);
    fixture.targets.afterRename(Entity.TAG, List.of());
    assertEquals(0, fixture.descendantReads);
    assertEquals(2, fixture.cached.size());
  }

  @Test
  void unavailableAndEmptyDescendantSourcesLeaveRenameCachesUntouched() {
    final Fixture fixture = new Fixture();
    fixture.descendantFailure = true;
    assertTrue(fixture.targets.beforeRename(Entity.TAG, "old").isEmpty());
    fixture.descendantFailure = false;
    fixture.descendants = List.of();
    assertTrue(fixture.targets.beforeRename(Entity.TAG, "old").isEmpty());
    assertEquals(2, fixture.cached.size());
  }

  @Test
  void tagInvalidationWalksEveryPageUsingTheReturnedPageSize() {
    final Fixture fixture = new Fixture();
    assertEquals(2, fixture.targets.tagged("old"));
    assertEquals(List.of(0, 1, 2), fixture.offsets);
    assertTrue(fixture.cached.asMap().isEmpty());
  }

  @Test
  void searchFailuresStopAtTheLastSuccessfulPage() {
    final Fixture fixture = new Fixture();
    fixture.failingOffset = 1;
    assertEquals(1, fixture.targets.tagged("old"));
    assertFalse(fixture.cached.asMap().containsKey(fixture.references.getFirst().getId()));
    assertTrue(fixture.cached.asMap().containsKey(fixture.references.getLast().getId()));
    assertEquals(List.of(0, 1), fixture.offsets);
  }

  @Test
  void runtimeSearchFailureRetainsBestEffortSemantics() {
    final Fixture fixture = new Fixture();
    fixture.runtimeSearchFailure = true;
    assertEquals(0, fixture.targets.tagged("old"));
    assertEquals(2, fixture.cached.size());
  }

  @Test
  void deferredSearchDoesNoWorkUntilTheExistingCommitQueueDrains() {
    final Fixture fixture = new Fixture();
    fixture.deferred = true;
    assertEquals(0, fixture.targets.tagged("old"));
    assertTrue(fixture.offsets.isEmpty());
    assertEquals(2, fixture.cached.size());
    fixture.pending.getFirst().run();
    assertTrue(fixture.cached.asMap().isEmpty());
  }

  @Test
  void rollbackCanDiscardDeferredSearchWithoutPublishing() {
    final Fixture fixture = new Fixture();
    fixture.deferred = true;
    fixture.targets.tagged("old");
    fixture.pending.clear();
    assertTrue(fixture.offsets.isEmpty());
    assertEquals(2, fixture.cached.size());
  }

  @Test
  void tagCollectionsRetainPerTagCountsAndIgnoreEmptyInputs() {
    final Fixture fixture = new Fixture();
    assertEquals(0, fixture.targets.tagged((String) null));
    assertEquals(0, fixture.targets.tagged(""));
    assertEquals(0, fixture.targets.tagged((Collection<String>) null));
    assertEquals(0, fixture.targets.tagged(List.of()));
    assertEquals(4, fixture.targets.tagged(List.of("old", "second")));
    assertEquals(List.of("old", "old", "old", "second", "second", "second"), fixture.tags);
  }

  @Test
  void descendantTagsIncludeThePrefixAndKeepTheExistingDuplicateBehavior() {
    final Fixture fixture = new Fixture();
    fixture.descendants =
        List.of(
            fixture.row("old"),
            fixture.row(null),
            fixture.row("old.child"),
            fixture.row("old.child"));
    assertEquals(6, fixture.targets.taggedDescendants(Entity.TAG, "old"));
    assertEquals(
        List.of(
            "old",
            "old",
            "old",
            "old.child",
            "old.child",
            "old.child",
            "old.child",
            "old.child",
            "old.child"),
        fixture.tags);
    assertEquals(1, fixture.descendantReads);
  }

  @Test
  void unavailableDescendantsStillInvalidateTheRootTag() {
    final Fixture fixture = new Fixture();
    fixture.descendantFailure = true;
    assertEquals(0, fixture.targets.taggedDescendants(null, "old"));
    assertEquals(0, fixture.targets.taggedDescendants(Entity.TAG, ""));
    assertEquals(2, fixture.targets.taggedDescendants(Entity.TAG, "old"));
    assertTrue(fixture.cached.asMap().isEmpty());
  }

  private static final class Fixture {
    private final Cache<UUID, String> cached = CacheBuilder.newBuilder().maximumSize(100).build();
    private List<EntityIdFqnPair> descendants = List.of(row("old.first"), row("old.second"));
    private final List<EntityReference> references =
        descendants.stream()
            .map(
                row ->
                    new EntityReference()
                        .withType(Entity.TAG)
                        .withId(row.id)
                        .withFullyQualifiedName(row.fqn))
            .toList();
    private final List<Integer> offsets = new ArrayList<>();
    private final List<String> tags = new ArrayList<>();
    private final List<Runnable> pending = new ArrayList<>();
    private boolean deferred;
    private boolean descendantFailure;
    private boolean runtimeSearchFailure;
    private int descendantReads;
    private int failingOffset = -1;
    private final EntityCacheTargets targets =
        new EntityCacheTargets(
            (type, prefix) -> {
              descendantReads++;
              if (descendantFailure) {
                throw new IllegalStateException("Database unavailable");
              }
              return descendants;
            },
            this::page,
            new EntityCacheTargets.SearchDeferral() {
              @Override
              public boolean active() {
                return deferred;
              }

              @Override
              public void defer(Runnable search, String tag) {
                pending.add(search);
              }
            },
            (type, id, fqn) -> cached.invalidate(id));

    private Fixture() {
      prime();
    }

    private EntityIdFqnPair row(String fqn) {
      return new EntityIdFqnPair(UUID.randomUUID(), fqn);
    }

    private void prime() {
      references.forEach(
          reference -> cached.put(reference.getId(), reference.getFullyQualifiedName()));
    }

    private List<EntityReference> page(String tag, int offset) throws IOException {
      offsets.add(offset);
      tags.add(tag);
      if (offset == failingOffset) {
        throw new IOException("Search unavailable");
      }
      if (runtimeSearchFailure) {
        throw new IllegalStateException("Search response unavailable");
      }
      return offset == references.size() ? List.of() : List.of(references.get(offset));
    }
  }
}
