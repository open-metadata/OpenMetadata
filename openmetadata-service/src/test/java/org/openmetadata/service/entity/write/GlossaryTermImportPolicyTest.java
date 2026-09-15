package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.RestUtil.PutResponse;

class GlossaryTermImportPolicyTest {
  @Test
  void exactFqnMatchAvoidsTheGlossaryLookupEvenWithoutAParent() {
    final Fixture fixture = new Fixture();
    fixture.existing = term("glossary.term");
    final GlossaryTerm requested = new GlossaryTerm().withFullyQualifiedName("glossary.term");
    assertSame(fixture.existing, fixture.policy.match(requested));
    assertEquals(1, fixture.fqnReads.get());
    assertEquals(0, fixture.nameReads.get());
    assertTrue(fixture.persisted.isEmpty());
  }

  @Test
  void movedTermMatchesItsStoredNameWithinTheSameGlossary() {
    final Fixture fixture = new Fixture();
    final GlossaryTerm stored = term("glossary.old.term");
    fixture.fallback = JsonUtils.pojoToJson(stored);
    final GlossaryTerm matched = fixture.policy.match(term("glossary.new.term"));
    assertEquals(stored, matched);
    assertEquals(1, fixture.fqnReads.get());
    assertEquals(1, fixture.nameReads.get());
    assertEquals(List.of("glossary", "TeRm"), fixture.nameSelection);
  }

  @ParameterizedTest
  @NullAndEmptySource
  void missingNameMatchRemainsAbsent(final String row) {
    final Fixture fixture = new Fixture();
    fixture.fallback = row;
    assertNull(fixture.policy.match(term("glossary.term")));
    assertEquals(1, fixture.nameReads.get());
  }

  @Test
  void matchingPropagatesAFailedNameLookup() {
    final Fixture fixture = new Fixture();
    fixture.nameFailure = new IllegalStateException("name lookup failed");
    assertSame(
        fixture.nameFailure,
        assertThrows(
            IllegalStateException.class, () -> fixture.policy.match(term("glossary.term"))));
    assertTrue(fixture.persisted.isEmpty());
  }

  @Test
  void upsertToleratesAFailedNameLookupAndCreatesWithTheExistingHrefOrder() {
    final Fixture fixture = new Fixture();
    fixture.nameFailure = new IllegalStateException("name lookup failed");
    final GlossaryTerm requested = term("glossary.term").withUpdatedBy("original-actor");
    final PutResponse<GlossaryTerm> response = fixture.policy.upsert(null, requested, "importer");
    assertEquals(Status.CREATED, response.getStatus());
    assertEquals(EventType.ENTITY_CREATED, response.getChangeType());
    assertSame(requested, response.getEntity());
    assertEquals(URI.create("http://localhost/terms/created"), requested.getHref());
    assertEquals("original-actor", requested.getUpdatedBy());
    assertEquals(List.of(requested), fixture.persisted);
    assertEquals(0, fixture.updates.get());
  }

  @ParameterizedTest
  @ValueSource(strings = {" ", "invalid-json"})
  void malformedFallbackRowsFailMatchingButRemainToleratedByUpsert(final String row) {
    final Fixture fixture = new Fixture();
    fixture.fallback = row;
    assertThrows(RuntimeException.class, () -> fixture.policy.match(term("glossary.term")));
    assertEquals(
        Status.CREATED, fixture.policy.upsert(null, term("glossary.term"), "importer").getStatus());
    assertEquals(1, fixture.persisted.size());
  }

  @Test
  void anExactMatchUpdatesThroughImportModeWithoutAnotherRead() {
    final Fixture fixture = new Fixture();
    fixture.existing = term("glossary.term");
    final GlossaryTerm requested = term("glossary.term");
    final PutResponse<GlossaryTerm> response = fixture.policy.upsert(null, requested, "importer");
    assertEquals(Status.OK, response.getStatus());
    assertSame(requested, response.getEntity());
    assertEquals(fixture.existing.getId(), requested.getId());
    assertEquals("importer", requested.getUpdatedBy());
    assertEquals(1, fixture.updates.get());
    assertEquals(0, fixture.nameReads.get());
    assertEquals(List.of(requested), fixture.persisted);
  }

  @Test
  void aMovedTermUpdatesTheOriginalIdentity() {
    final Fixture fixture = new Fixture();
    final GlossaryTerm stored = term("glossary.old.term");
    fixture.fallback = JsonUtils.pojoToJson(stored);
    final GlossaryTerm requested = term("glossary.new.term");
    final PutResponse<GlossaryTerm> response = fixture.policy.upsert(null, requested, "importer");
    assertEquals(Status.OK, response.getStatus());
    assertEquals(stored.getId(), response.getEntity().getId());
    assertEquals("glossary.new.term", response.getEntity().getFullyQualifiedName());
    assertEquals(1, fixture.fqnReads.get());
    assertEquals(1, fixture.nameReads.get());
  }

  @Test
  void primaryLookupFailureIsNeverTreatedAsAMissingTerm() {
    final Fixture fixture = new Fixture();
    fixture.fqnFailure = new IllegalStateException("primary lookup failed");
    assertSame(
        fixture.fqnFailure,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.policy.upsert(null, term("glossary.term"), "importer")));
    assertEquals(0, fixture.nameReads.get());
    assertTrue(fixture.persisted.isEmpty());
  }

  private static GlossaryTerm term(final String fqn) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName("TeRm")
        .withFullyQualifiedName(fqn)
        .withGlossary(new EntityReference().withFullyQualifiedName("glossary"));
  }

  private static final class Fixture {
    private final AtomicInteger fqnReads = new AtomicInteger();
    private final AtomicInteger nameReads = new AtomicInteger();
    private final AtomicInteger updates = new AtomicInteger();
    private final List<GlossaryTerm> persisted = new ArrayList<>();
    private List<String> nameSelection;
    private GlossaryTerm existing;
    private String fallback;
    private RuntimeException nameFailure;
    private RuntimeException fqnFailure;
    private final GlossaryTermImportPolicy policy =
        new GlossaryTermImportPolicy(
            new GlossaryTermImportPolicy.Reads(this::byFqn, this::byName),
            new GlossaryTermImportPolicy.Writes(this::create, this::withHref, this::update));

    private GlossaryTerm byFqn(final String fqn) {
      fqnReads.incrementAndGet();
      if (fqnFailure != null) {
        throw fqnFailure;
      }
      return existing;
    }

    private String byName(final String glossary, final String name) {
      nameReads.incrementAndGet();
      nameSelection = List.of(glossary, name);
      if (nameFailure != null) {
        throw nameFailure;
      }
      return fallback;
    }

    private GlossaryTerm create(final GlossaryTerm requested) {
      persisted.add(requested);
      assertNull(requested.getHref());
      return requested;
    }

    private GlossaryTerm withHref(final UriInfo uri, final GlossaryTerm entity) {
      assertEquals(List.of(entity), persisted);
      return entity.withHref(URI.create("http://localhost/terms/created"));
    }

    private PutResponse<GlossaryTerm> update(
        final UriInfo uri,
        final GlossaryTerm original,
        final GlossaryTerm requested,
        final EntityCommandActor actor,
        final EntityPutService.Mode mode) {
      assertEquals(EntityPutService.Mode.IMPORT, mode);
      assertNull(actor.impersonatedBy());
      updates.incrementAndGet();
      requested.withId(original.getId()).withUpdatedBy(actor.user());
      persisted.add(requested);
      return new PutResponse<>(Status.OK, requested, EventType.ENTITY_UPDATED);
    }
  }
}
