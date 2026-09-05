package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * The compiled RBAC query is cached for five minutes with no invalidation hook, so the key has to
 * cover every input {@code RBACConditionEvaluator} reads. {@code hasDomain()} compiles the subject's
 * domain ids into literal term clauses, which is why domains sit in the key alongside roles.
 */
class OpenSearchRbacCacheKeyTest {

  private static final UUID USER_ID = UUID.randomUUID();
  private static final UUID ROLE_ID = UUID.randomUUID();

  @Test
  @DisplayName("Two subjects sharing roles but not domains do not share a cached query")
  void testDomainsChangeTheKey() {
    SubjectContext financeSubject = subject(List.of(ROLE_ID), List.of(UUID.randomUUID()));
    SubjectContext marketingSubject = subject(List.of(ROLE_ID), List.of(UUID.randomUUID()));

    assertNotEquals(
        OpenSearchSearchManager.rbacCacheKey(financeSubject),
        OpenSearchSearchManager.rbacCacheKey(marketingSubject));
  }

  @Test
  @DisplayName("Role order does not change the key, so equivalent subjects share one cached query")
  void testKeyIsStableAcrossOrdering() {
    UUID secondRoleId = UUID.randomUUID();
    UUID domainId = UUID.randomUUID();

    assertEquals(
        OpenSearchSearchManager.rbacCacheKey(
            subject(List.of(ROLE_ID, secondRoleId), List.of(domainId))),
        OpenSearchSearchManager.rbacCacheKey(
            subject(List.of(secondRoleId, ROLE_ID), List.of(domainId))));
  }

  @Test
  @DisplayName("Two subjects sharing roles and domains but not teams do not share a cached query")
  void testTeamsChangeTheKey() {
    UUID domainId = UUID.randomUUID();
    SubjectContext engineering =
        subject(List.of(ROLE_ID), List.of(domainId), List.of(UUID.randomUUID()));
    SubjectContext marketing =
        subject(List.of(ROLE_ID), List.of(domainId), List.of(UUID.randomUUID()));

    assertNotEquals(
        OpenSearchSearchManager.rbacCacheKey(engineering),
        OpenSearchSearchManager.rbacCacheKey(marketing),
        "isOwner, isReviewer and inAnyTeam compile team ids into the query");
  }

  @Test
  @DisplayName("A subject with no roles, domains or teams keys cleanly rather than throwing")
  void testKeyToleratesNullCollections() {
    SubjectContext bareSubject = subject(null, null, null);

    assertEquals(USER_ID + ":::", OpenSearchSearchManager.rbacCacheKey(bareSubject));
  }

  private static SubjectContext subject(List<UUID> roleIds, List<UUID> domainIds) {
    return subject(roleIds, domainIds, null);
  }

  private static SubjectContext subject(
      List<UUID> roleIds, List<UUID> domainIds, List<UUID> teamIds) {
    User user = mock(User.class);
    when(user.getId()).thenReturn(USER_ID);
    when(user.getRoles()).thenReturn(references(roleIds, Entity.ROLE));
    when(user.getDomains()).thenReturn(references(domainIds, Entity.DOMAIN));
    when(user.getTeams()).thenReturn(references(teamIds, Entity.TEAM));

    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.user()).thenReturn(user);
    return subjectContext;
  }

  private static List<EntityReference> references(List<UUID> ids, String type) {
    return ids == null
        ? null
        : ids.stream().map(id -> new EntityReference().withId(id).withType(type)).toList();
  }
}
