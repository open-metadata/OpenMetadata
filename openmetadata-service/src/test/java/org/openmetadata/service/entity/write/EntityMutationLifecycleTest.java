package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.entity.write.EntityMutationLifecycle.Mode;

class EntityMutationLifecycleTest {
  @ParameterizedTest
  @EnumSource(Mode.class)
  void publicationFollowsTheOwningFlushAndRetainsItsMode(final Mode mode) {
    final Fixture fixture = new Fixture();
    fixture.lifecycle.update(fixture.session, mode);
    assertEquals(1, fixture.commits);
    assertEquals(
        List.of(new Applied(mode == Mode.OPTIMISTIC, mode == Mode.IMPORT)), fixture.applied);
    assertEquals(
        List.of("reset", "write", "commit", "cache", "clear", "postUpdate", "react"),
        fixture.events);
    assertEquals(0.2, fixture.session.getUpdated().getVersion());
  }

  @Test
  void replayRestoresEntityIdentityAndVersionBeforeResettingSubclassGuards() {
    final Fixture fixture = new Fixture();
    final Table original = fixture.session.getOriginal();
    final Table updated = fixture.session.getUpdated();
    fixture.retry = true;
    fixture.lifecycle.update(fixture.session, Mode.NORMAL);
    assertSame(original, fixture.session.getOriginal());
    assertSame(updated, fixture.session.getUpdated());
    assertEquals(0.2, updated.getVersion());
    assertEquals("requested", updated.getDescription());
    assertEquals(2, fixture.applied.size());
    assertEquals(1, fixture.commits);
    assertEquals(2, fixture.session.resets);
    assertEquals(
        List.of(
            "reset",
            "write",
            "rollback",
            "reset",
            "write",
            "commit",
            "cache",
            "clear",
            "postUpdate",
            "react"),
        fixture.events);
  }

  @Test
  void firstAttemptKeepsPreparationDoneAfterCapturingTheSnapshot() {
    final Fixture fixture = new Fixture();
    fixture.prepareOnEntry = true;
    fixture.lifecycle.update(fixture.session, Mode.NORMAL);
    assertEquals("prepared", fixture.session.getUpdated().getDescription());
  }

  @Test
  void failedFlushClearsSerializedStateWithoutPublishing() {
    final Fixture fixture = new Fixture();
    fixture.failWrite = true;
    assertThrows(
        IllegalStateException.class, () -> fixture.lifecycle.update(fixture.session, Mode.NORMAL));
    assertEquals(List.of("reset", "write", "clear"), fixture.events);
    assertEquals(0, fixture.commits);
  }

  @Test
  void failedCachePublicationStillClearsSerializedStateAndStopsReact() {
    final Fixture fixture = new Fixture();
    fixture.session.failCache = true;
    assertThrows(
        IllegalStateException.class, () -> fixture.lifecycle.update(fixture.session, Mode.NORMAL));
    assertEquals(List.of("reset", "write", "commit", "cache", "clear"), fixture.events);
  }

  @Test
  void failedPostUpdateKeepsDeferredReactUnexecuted() {
    final Fixture fixture = new Fixture();
    fixture.failPostUpdate = true;
    assertThrows(
        IllegalStateException.class, () -> fixture.lifecycle.update(fixture.session, Mode.NORMAL));
    assertEquals(
        List.of("reset", "write", "commit", "cache", "clear", "postUpdate"), fixture.events);
  }

  @Test
  void unchangedRequestsDoNotPublishCacheOrReact() {
    final Fixture fixture = new Fixture();
    fixture.change = false;
    fixture.lifecycle.update(fixture.session, Mode.NORMAL);
    assertEquals(List.of("reset", "write", "commit", "clear"), fixture.events);
  }

  @Test
  void incrementalAndUnversionedChangesStillReactWithoutAStoredEntity() {
    final Fixture fixture = new Fixture();
    fixture.change = false;
    fixture.session.setIncrementalChangeDescription(
        new ChangeDescription()
            .withFieldsUpdated(List.of(new FieldChange().withName("description"))));
    fixture.lifecycle.update(fixture.session, Mode.NORMAL);
    assertTrue(fixture.events.contains("react"));
    assertFalse(fixture.events.contains("cache"));
    final Fixture unversioned = new Fixture();
    unversioned.change = false;
    unversioned.session.setEntityChanged(true);
    unversioned.lifecycle.update(unversioned.session, Mode.NORMAL);
    assertTrue(unversioned.events.contains("react"));
  }

  private record Applied(boolean optimistic, boolean importing) {}

  private static final class Fixture {
    private final List<String> events = new ArrayList<>();
    private final List<Applied> applied = new ArrayList<>();
    private final Session session = new Session(events);
    private final EntityMutationLifecycle<Table> lifecycle;
    private boolean retry;
    private boolean prepareOnEntry;
    private boolean failWrite;
    private boolean failPostUpdate;
    private boolean change = true;
    private int commits;

    private Fixture() {
      lifecycle =
          new EntityMutationLifecycle<>(
              Table.class,
              new EntityMutationLifecycle.Execution<>(
                  work -> {
                    if (prepareOnEntry) {
                      session.getUpdated().setDescription("prepared");
                    }
                    session.inTransaction = true;
                    try {
                      work.run();
                      if (retry) {
                        events.add("rollback");
                        session.getOriginal().setDescription("mutated");
                        session.getUpdated().setDescription("mutated");
                        session.setOriginal(new Table());
                        session.setUpdated(new Table());
                        work.run();
                      }
                      commits++;
                      events.add("commit");
                    } finally {
                      session.inTransaction = false;
                    }
                  },
                  (state, optimistic, importing) -> {
                    assertTrue(session.inTransaction);
                    assertEquals("original", state.getOriginal().getDescription());
                    assertEquals(0.1, state.getUpdated().getVersion());
                    applied.add(new Applied(optimistic, importing));
                    events.add("write");
                    if (failWrite) {
                      throw new IllegalStateException("Injected write failure");
                    }
                    if (change) {
                      state.getUpdated().setVersion(state.getUpdated().getVersion() + 0.1);
                      state.setVersionChanged(true);
                      state.setEntityStored(true);
                    }
                  },
                  () -> events.add("clear")),
              (original, updated) -> {
                assertFalse(session.inTransaction);
                events.add("postUpdate");
                if (failPostUpdate) {
                  throw new IllegalStateException("Injected postUpdate failure");
                }
              });
    }
  }

  private static final class Session extends MutationState<Table>
      implements EntityMutationLifecycle.Session<Table> {
    private final List<String> events;
    private int resets;
    private boolean inTransaction;
    private boolean failCache;

    private Session(final List<String> events) {
      super(
          new Table().withDescription("original").withVersion(0.1),
          new Table().withDescription("requested").withVersion(0.1));
      this.events = events;
    }

    @Override
    public void resetMutationAttempt() {
      assertEquals("original", getOriginal().getDescription());
      events.add("reset");
      resets++;
    }

    @Override
    public void publishStoredEntity() {
      assertFalse(inTransaction);
      events.add("cache");
      if (failCache) {
        throw new IllegalStateException("Injected cache failure");
      }
    }

    @Override
    public void runDeferredReactOperations() {
      assertFalse(inTransaction);
      events.add("react");
    }

    @Override
    public boolean canConsolidateChanges() {
      return false;
    }

    @Override
    public void applyChanges(final boolean importing, final boolean consolidating) {
      throw new AssertionError("The injected flush owns mutation application");
    }
  }
}
