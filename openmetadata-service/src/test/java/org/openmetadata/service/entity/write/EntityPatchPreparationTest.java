package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

class EntityPatchPreparationTest {
  private static final Clock CLOCK = Clock.fixed(Instant.ofEpochMilli(1000), ZoneOffset.UTC);

  @Test
  void preparationUsesRestoredSecretsAndNormalizesReferencesBeforeRestoringAttributes() {
    final Table original = new Table().withId(UUID.randomUUID()).withDescription("secret");
    final Table patched = new Table().withDescription("masked").withImpersonatedBy("injected");
    final var owner = new EntityReference().withId(UUID.randomUUID()).withType("user");
    final var domain = new EntityReference().withId(UUID.randomUUID()).withType("domain");
    final var rules =
        new EntityPatchPreparation.Rules<Table>(
            updated -> {
              assertEquals("secret", updated.getDescription());
              assertEquals("editor", updated.getUpdatedBy());
              assertEquals(1000L, updated.getUpdatedAt());
              updated.setDisplayName("prepared");
            },
            (before, updated) -> updated.setDisplayName(updated.getDisplayName() + " evaluated"),
            (before, updated) -> {
              assertEquals(List.of(owner), updated.getOwners());
              assertEquals(List.of(domain), updated.getDomains());
              updated.setId(before.getId());
              updated.setImpersonatedBy("restored actor");
            });
    final var preparation =
        new EntityPatchPreparation<Table>(
            (before, after) ->
                JsonUtils.deepCopy(after, Table.class).withDescription(before.getDescription()),
            rules,
            new EntityPatchPreparation.References(
                value -> List.of(owner), value -> List.of(domain)),
            CLOCK);

    final Table result =
        preparation.prepare(original, patched, new EntityCommandActor("editor", null));

    assertEquals("prepared evaluated", result.getDisplayName());
    assertEquals(original.getId(), result.getId());
    assertNull(result.getImpersonatedBy());
    assertNotSame(patched, result);
    assertEquals("masked", patched.getDescription());
    assertEquals("injected", patched.getImpersonatedBy());
  }

  @Test
  void invalidOwnersStopPreparationBeforeDomainsAndAttributeRestoration() {
    final Table patched = new Table().withDisplayName("untouched");
    final var failure = new IllegalArgumentException("Invalid owner");
    final var preparation =
        new EntityPatchPreparation<Table>(
            (before, after) -> after,
            new EntityPatchPreparation.Rules<>(
                entity -> {},
                (before, after) -> {},
                (before, after) -> after.setDisplayName("restored")),
            new EntityPatchPreparation.References(
                value -> {
                  throw failure;
                },
                value -> {
                  patched.setDisplayName("domains validated");
                  return value;
                }),
            CLOCK);
    assertSame(
        failure,
        assertThrows(
            IllegalArgumentException.class,
            () ->
                preparation.prepare(new Table(), patched, new EntityCommandActor("editor", null))));
    assertEquals("untouched", patched.getDisplayName());
  }
}
