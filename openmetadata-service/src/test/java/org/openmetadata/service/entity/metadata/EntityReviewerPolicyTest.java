package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.security.AuthorizationException;

class EntityReviewerPolicyTest {
  @Test
  void absentReviewersAllowAnUpdateWithoutLoadingTeams() {
    final EntityReviewerPolicy policy =
        new EntityReviewerPolicy(
            name -> {
              throw new AssertionError(name);
            });
    policy.check(new GlossaryTerm(), "actor");
    policy.check(new GlossaryTerm().withReviewers(List.of()), "actor");
  }

  @Test
  void directReviewersMatchNamesOrFullyQualifiedNamesAndShortCircuit() {
    final EntityReviewerPolicy policy =
        new EntityReviewerPolicy(
            name -> {
              throw new AssertionError(name);
            });
    final GlossaryTerm entity =
        new GlossaryTerm()
            .withReviewers(
                List.of(
                    reference(USER, "actor", "\"actor\""), reference(TEAM, "unused", "unused")));
    assertDoesNotThrow(() -> policy.check(entity, "actor"));
    assertDoesNotThrow(() -> policy.check(entity, "\"actor\""));
  }

  @Test
  void teamReviewersResolveTheStoredNameAndMatchBothUserProjections() {
    final List<String> names = new ArrayList<>();
    final EntityReviewerPolicy policy =
        new EntityReviewerPolicy(
            name -> {
              names.add(name);
              return List.of(reference(USER, "actor", "\"actor\""));
            });
    final GlossaryTerm entity =
        new GlossaryTerm()
            .withReviewers(List.of(reference(TEAM, "review team", "\"review team\"")));
    policy.check(entity, "actor");
    policy.check(entity, "\"actor\"");
    assertEquals(List.of("review team", "review team"), names);
  }

  @Test
  void rejectedReviewersKeepTheAuthorizationMessage() {
    final EntityReviewerPolicy policy = new EntityReviewerPolicy(name -> List.of());
    final GlossaryTerm entity =
        new GlossaryTerm()
            .withReviewers(
                List.of(
                    reference(TEAM, "reviewers", "reviewers"), reference(USER, "other", "other")));
    assertEquals(
        notReviewer("actor"),
        assertThrows(AuthorizationException.class, () -> policy.check(entity, "actor"))
            .getMessage());
  }

  @Test
  void malformedReferencesRetainNullFailuresAndNameShortCircuiting() {
    final EntityReviewerPolicy policy = new EntityReviewerPolicy(name -> null);
    final GlossaryTerm entity =
        new GlossaryTerm().withReviewers(List.of(reference(USER, "actor", null)));
    policy.check(entity, "actor");
    assertThrows(NullPointerException.class, () -> policy.check(entity, "other"));
    entity.setReviewers(List.of(reference(null, "actor", "actor")));
    assertThrows(NullPointerException.class, () -> policy.check(entity, "actor"));
    entity.setReviewers(List.of(reference(TEAM, "team", "team")));
    assertThrows(NullPointerException.class, () -> policy.check(entity, "actor"));
  }

  private static EntityReference reference(final String type, final String name, final String fqn) {
    return new EntityReference().withType(type).withName(name).withFullyQualifiedName(fqn);
  }
}
