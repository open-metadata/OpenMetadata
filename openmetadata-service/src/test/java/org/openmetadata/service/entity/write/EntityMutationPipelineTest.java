package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;

class EntityMutationPipelineTest {
  @Test
  void patchSelectionKeepsUnselectedValuesAndAlignsIdentityBeforeApplyingFields() {
    final Fixture fixture = new Fixture();
    final State state = new State(Set.of(Entity.FIELD_DESCRIPTION));
    fixture.pipeline.apply(state, new EntityMutationPipeline.Context(false, false));
    assertEquals(state.original.getId(), state.updated.getId());
    assertEquals("normal", state.updated.getDescription());
    assertEquals("untouched", state.updated.getDisplayName());
    assertEquals(
        List.of("identity", "deleted", "description", "specific", "summary"), state.events);
    assertEquals(List.of(Entity.FIELD_DESCRIPTION, Entity.FIELD_DISPLAY_NAME), state.compared);
  }

  @Test
  void importingRunsEveryRuleWithoutConsultingPatchSelection() {
    final Fixture fixture = new Fixture();
    final State state = new State(Set.of());
    fixture.pipeline.apply(state, new EntityMutationPipeline.Context(true, false));
    assertEquals("import", state.updated.getDescription());
    assertEquals("display", state.updated.getDisplayName());
    assertTrue(state.compared.isEmpty());
    assertEquals(
        List.of("identity", "deleted", "description", "display", "specific", "summary"),
        state.events);
  }

  @Test
  void consolidationContextReachesTheFieldAndEntitySpecificPolicies() {
    final Fixture fixture = new Fixture();
    final State state = new State(Set.of(Entity.FIELD_DESCRIPTION));
    final EntityMutationPipeline.Context context = new EntityMutationPipeline.Context(false, true);
    fixture.pipeline.apply(state, context);
    assertSame(context, state.fieldContext);
    assertSame(context, state.specificContext);
    assertTrue(state.specificContext.consolidating());
  }

  @Test
  void softDeletionOnlyAppliesTheDeletionPolicy() {
    final Fixture fixture = new Fixture();
    final State state = new State(Set.of(Entity.FIELD_DESCRIPTION));
    state.deleting = true;
    final UUID requestedId = state.updated.getId();
    fixture.pipeline.apply(state, new EntityMutationPipeline.Context(true, true));
    assertEquals(requestedId, state.updated.getId());
    assertEquals(List.of("deleted"), state.events);
    assertTrue(state.updated.getDeleted());
    assertEquals("untouched", state.updated.getDescription());
    assertTrue(state.compared.isEmpty());
  }

  @Test
  void noSelectedFieldsStillRunTheEntitySpecificPolicyAndSummary() {
    final Fixture fixture = new Fixture();
    final State state = new State(Set.of());
    fixture.pipeline.apply(state, new EntityMutationPipeline.Context(false, false));
    assertEquals(List.of("identity", "deleted", "specific", "summary"), state.events);
    assertEquals("untouched", state.updated.getDescription());
  }

  @Test
  void failedFieldsLeaveLaterFieldsAndSummaryUnapplied() {
    final Fixture fixture = new Fixture();
    final State state = new State(Set.of(Entity.FIELD_DESCRIPTION, Entity.FIELD_DISPLAY_NAME));
    state.failField = true;
    assertThrows(
        IllegalStateException.class,
        () -> fixture.pipeline.apply(state, new EntityMutationPipeline.Context(false, false)));
    assertEquals(List.of("identity", "deleted", "description"), state.events);
    assertEquals("untouched", state.updated.getDisplayName());
  }

  @Test
  void registeredRulesAreAnImmutableStartupSnapshot() {
    final Fixture fixture = new Fixture();
    fixture.rules.clear();
    final State first = new State(Set.of(Entity.FIELD_DESCRIPTION));
    final State second = new State(Set.of(Entity.FIELD_DISPLAY_NAME));
    fixture.pipeline.apply(first, new EntityMutationPipeline.Context(false, false));
    fixture.pipeline.apply(second, new EntityMutationPipeline.Context(false, false));
    assertEquals("normal", first.updated.getDescription());
    assertEquals("untouched", second.updated.getDescription());
    assertEquals("display", second.updated.getDisplayName());
    assertFalse(first.events.contains("display"));
  }

  private static final class Fixture {
    private final List<EntityMutationPipeline.Step<State>> rules = new ArrayList<>();
    private final EntityMutationPipeline<State> pipeline;

    private Fixture() {
      rules.add(
          new EntityMutationPipeline.Step<>(
              Entity.FIELD_DESCRIPTION,
              (state, context) -> {
                assertEquals(state.original.getId(), state.updated.getId());
                state.events.add("description");
                state.fieldContext = context;
                if (state.failField) {
                  throw new IllegalStateException("Injected field failure");
                }
                state.updated.setDescription(context.importing() ? "import" : "normal");
              }));
      rules.add(
          new EntityMutationPipeline.Step<>(
              Entity.FIELD_DISPLAY_NAME,
              (state, context) -> {
                state.events.add("display");
                state.updated.setDisplayName("display");
              }));
      pipeline =
          new EntityMutationPipeline<>(
              new EntityMutationPipeline.Preparation<>(
                  state -> state.deleting,
                  state -> {
                    state.events.add("identity");
                    state.updated.setId(state.original.getId());
                  },
                  state -> {
                    state.events.add("deleted");
                    state.updated.setDeleted(state.deleting);
                  },
                  (state, field) -> {
                    state.compared.add(field);
                    return state.selected.contains(field);
                  }),
              rules,
              (state, context) -> {
                state.specificContext = context;
                state.events.add("specific");
                state.events.add("summary");
              });
    }
  }

  private static final class State {
    private final Table original = new Table().withId(UUID.randomUUID());
    private final Table updated =
        new Table()
            .withId(UUID.randomUUID())
            .withDescription("untouched")
            .withDisplayName("untouched");
    private final Set<String> selected;
    private final List<String> events = new ArrayList<>();
    private final List<String> compared = new ArrayList<>();
    private boolean deleting;
    private boolean failField;
    private EntityMutationPipeline.Context fieldContext;
    private EntityMutationPipeline.Context specificContext;

    private State(final Set<String> selected) {
      this.selected = selected;
    }
  }
}
