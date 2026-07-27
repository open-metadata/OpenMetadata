package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.exception.PreconditionFailedException;

class EntityETagTest {

  @Test
  void generateETagReturnsQuotedHashAndWeakVariant() {
    EntityInterface entity = entity(1.2, 123456L);

    String strong = EntityETag.generateETag(entity);
    String weak = EntityETag.generateWeakETag(entity);

    assertNotNull(strong);
    assertTrue(strong.startsWith("\""));
    assertTrue(strong.endsWith("\""));
    assertEquals("W/\"1.2\"", weak);
    assertNull(EntityETag.generateETag(null));
    assertNull(EntityETag.generateWeakETag(null));
  }

  @Test
  void etagIsStableForUnchangedEntity() {
    EntityInterface entity = entity(1.2, 123456L);

    assertEquals(EntityETag.generateETag(entity), EntityETag.generateETag(entity));
  }

  @Test
  void etagChangesWhenVotesChangeWithoutVersionBump() {
    // The P0 regression: an upvote writes a VOTED relationship and repopulates the entity's
    // votes block but does NOT bump version/updatedAt. A version-only ETag stayed constant, so
    // the post-vote conditional GET was answered 304 and the header rendered stale counts.
    // The ETag must move when the votes block moves, even though version/updatedAt are identical.
    UUID id = UUID.randomUUID();
    EntityInterface before = table(id, 1.2, 123456L, 0);
    EntityInterface after = table(id, 1.2, 123456L, 1);

    assertEquals(before.getVersion(), after.getVersion());
    assertEquals(before.getUpdatedAt(), after.getUpdatedAt());
    assertNotEquals(EntityETag.generateETag(before), EntityETag.generateETag(after));
  }

  @Test
  void etagChangesWhenVersionChanges() {
    UUID id = UUID.randomUUID();
    EntityInterface v1 = table(id, 1.0, 100L, 0);
    EntityInterface v2 = table(id, 1.1, 200L, 0);

    assertNotEquals(EntityETag.generateETag(v1), EntityETag.generateETag(v2));
  }

  @Test
  void etagReflectsRequestedFieldsForPartialFetches() {
    // The ETag hashes the exact partial representation that is serialized for the requested
    // `fields`, not a canonical full entity. So `fields=tags` and `fields=owners` on the same
    // entity are different representations and MUST get different ETags — a `fields=tags` 304 can
    // never hand back an owners-bearing body. The same selection with unchanged data stays stable
    // so the conditional GET still short-circuits to 304.
    UUID id = UUID.randomUUID();
    EntityInterface tagsOnly =
        partialTable(id).withTags(List.of(new TagLabel().withTagFQN("PII.Sensitive")));
    EntityInterface ownersOnly =
        partialTable(id)
            .withOwners(
                List.of(
                    new EntityReference()
                        .withId(UUID.randomUUID())
                        .withType("user")
                        .withName("u1")));
    EntityInterface tagsOnlyUnchanged =
        partialTable(id).withTags(List.of(new TagLabel().withTagFQN("PII.Sensitive")));

    assertNotEquals(EntityETag.generateETag(tagsOnly), EntityETag.generateETag(ownersOnly));
    assertEquals(EntityETag.generateETag(tagsOnly), EntityETag.generateETag(tagsOnlyUnchanged));
  }

  @Test
  void etagReflectsRelationshipOnlyMutations() {
    // Regression matrix (Slack thread, validated against AUT): every mutation that rewrites the
    // response body WITHOUT bumping version/updatedAt must still move the ETag. votes/followers are
    // covered above; this locks in the rest of the stale-304 class. Each pair shares id + version +
    // updatedAt and differs only in the named field — exactly the shape a version-only ETag missed.
    UUID t = UUID.randomUUID();
    UUID u = UUID.randomUUID();
    record Case(String field, EntityInterface before, EntityInterface after) {}
    List<Case> cases =
        List.of(
            new Case(
                "customMetrics",
                partialTable(t).withCustomMetrics(List.of(new CustomMetric().withName("cm1"))),
                partialTable(t).withCustomMetrics(List.of(new CustomMetric().withName("cm2")))),
            new Case(
                "testSuite",
                partialTable(t).withTestSuite(ref("testSuite", "ts1")),
                partialTable(t).withTestSuite(ref("testSuite", "ts2"))),
            new Case(
                "domains",
                partialTable(t).withDomains(List.of(ref("domain", "d1"))),
                partialTable(t).withDomains(List.of(ref("domain", "d2")))),
            new Case(
                "dataProducts",
                partialTable(t).withDataProducts(List.of(ref("dataProduct", "dp1"))),
                partialTable(t).withDataProducts(List.of(ref("dataProduct", "dp2")))),
            new Case(
                "tags",
                partialTable(t).withTags(List.of(new TagLabel().withTagFQN("PII.Sensitive"))),
                partialTable(t).withTags(List.of(new TagLabel().withTagFQN("PII.None")))),
            new Case(
                "user.roles",
                user(u).withRoles(List.of(ref("role", "r1"))),
                user(u).withRoles(List.of(ref("role", "r2")))),
            new Case(
                "user.defaultPersona",
                user(u).withDefaultPersona(ref("persona", "p1")),
                user(u).withDefaultPersona(ref("persona", "p2"))));

    for (Case c : cases) {
      assertEquals(c.before().getVersion(), c.after().getVersion());
      assertEquals(c.before().getUpdatedAt(), c.after().getUpdatedAt());
      assertNotEquals(
          EntityETag.generateETag(c.before()),
          EntityETag.generateETag(c.after()),
          c.field() + " change must move the ETag");
    }
  }

  @Test
  void validateETagSupportsExactWildcardWeakAndMultipleMatches() {
    EntityInterface entity = entity(2.5, 98765L);
    String etag = EntityETag.generateETag(entity);
    String weak = EntityETag.generateWeakETag(entity);

    assertDoesNotThrow(() -> EntityETag.validateETag(null, entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag(etag, entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag(weak, entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag("\"other\", " + etag, entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag("*", entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag("\"stale\"", entity, false));
  }

  @Test
  void validateETagRejectsMismatchedHeaders() {
    EntityInterface entity = entity(3.1, 24680L);

    assertThrows(
        PreconditionFailedException.class,
        () -> EntityETag.validateETag("\"stale-etag\"", entity, true));
  }

  @Test
  void addETagHeaderAndEnforcementFlagBehaveAsExpected() {
    EntityInterface entity = entity(4.0, 13579L);

    Response response = EntityETag.addETagHeader(Response.ok(), entity).build();

    assertEquals(EntityETag.generateETag(entity), response.getHeaderString(EntityETag.ETAG_HEADER));
    assertFalse(EntityETag.isETagEnforcementEnabled());
  }

  private static EntityInterface entity(double version, long updatedAt) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("etag_table")
        .withVersion(version)
        .withUpdatedAt(updatedAt);
  }

  private static EntityInterface table(UUID id, double version, long updatedAt, int upVotes) {
    return new Table()
        .withId(id)
        .withName("etag_table")
        .withVersion(version)
        .withUpdatedAt(updatedAt)
        .withVotes(new Votes().withUpVotes(upVotes).withDownVotes(0));
  }

  private static Table partialTable(UUID id) {
    return new Table().withId(id).withName("etag_table").withVersion(1.0).withUpdatedAt(100L);
  }

  private static User user(UUID id) {
    return new User().withId(id).withName("etag_user").withVersion(1.0).withUpdatedAt(100L);
  }

  private static EntityReference ref(String type, String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type).withName(name);
  }
}
