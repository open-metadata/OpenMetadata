package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;

/**
 * Comprehensive test suite for Domain-based access control using DomainOnlyAccessRole.
 * Tests all scenarios mentioned in GitHub issues #22637 and #22276.
 */
public class DomainAccessTest {

  private RuleEvaluator ruleEvaluator;
  private SubjectContext subjectContext;
  private ResourceContextInterface resourceContext;
  private User user;
  private EntityInterface entity;

  @BeforeEach
  void setUp() {
    user = mock(User.class);
    subjectContext = mock(SubjectContext.class);
    resourceContext = mock(ResourceContextInterface.class);
    entity = mock(EntityInterface.class);

    when(subjectContext.user()).thenReturn(user);

    // Set up entity with ID (to indicate it's not a list operation)
    when(entity.getId()).thenReturn(UUID.randomUUID());
    when(entity.getFullyQualifiedName()).thenReturn("test.entity");
    when(resourceContext.getEntity()).thenReturn(entity);

    // Create RuleEvaluator with mocked contexts
    ruleEvaluator = new RuleEvaluator(null, subjectContext, resourceContext);
  }

  @Test
  @DisplayName("User with matching domain should access resource with same domain")
  void testUserWithMatchingDomain() {
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    EntityReference resourceDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(resourceContext.getDomains()).thenReturn(List.of(resourceDomain));

    when(subjectContext.hasDomains(anyList())).thenReturn(true);

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(hasAccess, "User with matching domain should have access to resource");
  }

  @Test
  @DisplayName("User with different domain should NOT access resource with another domain")
  void testUserWithDifferentDomain() {
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    EntityReference resourceDomain =
        createDomain("team2-domain", "87654321-4321-4321-4321-210987654321");
    when(resourceContext.getDomains()).thenReturn(List.of(resourceDomain));

    when(subjectContext.hasDomains(anyList())).thenReturn(false);

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertFalse(hasAccess, "User with different domain should NOT have access");
  }

  @Test
  @DisplayName("User with multiple domains should access resource if at least one domain matches")
  void testUserWithMultipleDomains() {
    EntityReference domain1 = createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    EntityReference domain2 = createDomain("team2-domain", "87654321-4321-4321-4321-210987654321");
    when(user.getDomains()).thenReturn(Arrays.asList(domain1, domain2));

    EntityReference resourceDomain =
        createDomain("team2-domain", "87654321-4321-4321-4321-210987654321");
    when(resourceContext.getDomains()).thenReturn(List.of(resourceDomain));

    when(subjectContext.hasDomains(anyList())).thenReturn(true);

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(hasAccess, "User with multiple domains should have access if one matches");
  }

  @Test
  @DisplayName("User without domain should ONLY access resources without domain")
  void testUserWithoutDomainAccessingNonDomainResource() {
    when(user.getDomains()).thenReturn(null);

    when(resourceContext.getDomains()).thenReturn(null);

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(hasAccess, "User without domain should access resources without domain");
  }

  @Test
  @DisplayName("User without domain should NOT access resources with domain")
  void testUserWithoutDomainAccessingDomainResource() {
    when(user.getDomains()).thenReturn(null);

    EntityReference resourceDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(resourceContext.getDomains()).thenReturn(List.of(resourceDomain));

    when(subjectContext.hasDomains(anyList())).thenReturn(false);

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertFalse(hasAccess, "User without domain should NOT access resources with domain");
  }

  @Test
  @DisplayName("User with domain should access resources without domain")
  void testUserWithDomainAccessingNonDomainResource() {
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    when(resourceContext.getDomains()).thenReturn(null);

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(hasAccess, "User with domain should be able to access resources without domain");
  }

  @Test
  @DisplayName("Empty domain lists should be treated as no domain")
  void testEmptyDomainLists() {
    when(user.getDomains()).thenReturn(Collections.emptyList());

    when(resourceContext.getDomains()).thenReturn(Collections.emptyList());

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(hasAccess, "Empty domain lists should be treated as no domain");
  }

  @Test
  @DisplayName(
      "Resource with multiple domains should be accessible if user has any matching domain")
  void testResourceWithMultipleDomains() {
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    EntityReference resourceDomain1 =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    EntityReference resourceDomain2 =
        createDomain("team2-domain", "87654321-4321-4321-4321-210987654321");
    when(resourceContext.getDomains()).thenReturn(Arrays.asList(resourceDomain1, resourceDomain2));

    when(subjectContext.hasDomains(anyList())).thenReturn(true);

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(hasAccess, "User should access resource if any domain matches");
  }

  @Test
  @DisplayName("Null contexts should deny access")
  void testNullContexts() {
    RuleEvaluator evaluatorWithNullSubject = new RuleEvaluator(null, null, resourceContext);

    assertFalse(evaluatorWithNullSubject.hasDomain(), "Null subject context should deny access");

    RuleEvaluator evaluatorWithNullResource = new RuleEvaluator(null, subjectContext, null);

    assertFalse(evaluatorWithNullResource.hasDomain(), "Null resource context should deny access");
  }

  @Test
  @DisplayName("List operations should return true for post-filtering")
  void testListOperations() {
    when(resourceContext.getEntity()).thenReturn(null);

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(hasAccess, "List operations should return true for post-filtering");

    EntityInterface entityWithoutId = mock(EntityInterface.class);
    when(entityWithoutId.getId()).thenReturn(null);
    when(resourceContext.getEntity()).thenReturn(entityWithoutId);

    hasAccess = ruleEvaluator.hasDomain();

    assertTrue(
        hasAccess, "List operations with entity but no ID should return true for post-filtering");
  }

  @Test
  @DisplayName("User should access resource with inherited domain")
  void testInheritedDomainAccess() {
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    EntityReference inheritedDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    inheritedDomain.setInherited(true);
    when(resourceContext.getDomains()).thenReturn(List.of(inheritedDomain));

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(hasAccess, "User should access resource with matching inherited domain");
  }

  @Test
  @DisplayName("User with inherited domain restriction should match inherited resource domains")
  void testBothInheritedDomains() {
    EntityReference userDomain =
        createDomain("parent-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    EntityReference inheritedDomain =
        createDomain("parent-domain", "12345678-1234-1234-1234-123456789012");
    inheritedDomain.setInherited(true);
    when(resourceContext.getDomains()).thenReturn(List.of(inheritedDomain));

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(
        hasAccess, "Inherited domains should be treated as regular domains for access control");
  }

  @Test
  @DisplayName(
      "User with multiple domains should match resource with multiple domains if any overlap")
  void testBothWithMultipleDomains() {
    EntityReference userDomain1 =
        createDomain("finance-domain", "11111111-1111-1111-1111-111111111111");
    EntityReference userDomain2 =
        createDomain("marketing-domain", "22222222-2222-2222-2222-222222222222");
    EntityReference userDomain3 =
        createDomain("engineering-domain", "33333333-3333-3333-3333-333333333333");
    when(user.getDomains()).thenReturn(Arrays.asList(userDomain1, userDomain2, userDomain3));

    EntityReference resourceDomain1 =
        createDomain("hr-domain", "44444444-4444-4444-4444-444444444444");
    EntityReference resourceDomain2 =
        createDomain("marketing-domain", "22222222-2222-2222-2222-222222222222");
    EntityReference resourceDomain3 =
        createDomain("sales-domain", "55555555-5555-5555-5555-555555555555");
    when(resourceContext.getDomains())
        .thenReturn(Arrays.asList(resourceDomain1, resourceDomain2, resourceDomain3));

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertTrue(
        hasAccess,
        "User should access resource when at least one domain matches between multiple domains");
  }

  @Test
  @DisplayName(
      "User with multiple domains should NOT access resource with multiple non-matching domains")
  void testBothWithMultipleDomainsNoMatch() {
    EntityReference userDomain1 =
        createDomain("finance-domain", "11111111-1111-1111-1111-111111111111");
    EntityReference userDomain2 =
        createDomain("marketing-domain", "22222222-2222-2222-2222-222222222222");
    when(user.getDomains()).thenReturn(Arrays.asList(userDomain1, userDomain2));

    EntityReference resourceDomain1 =
        createDomain("hr-domain", "44444444-4444-4444-4444-444444444444");
    EntityReference resourceDomain2 =
        createDomain("engineering-domain", "33333333-3333-3333-3333-333333333333");
    EntityReference resourceDomain3 =
        createDomain("sales-domain", "55555555-5555-5555-5555-555555555555");
    when(resourceContext.getDomains())
        .thenReturn(Arrays.asList(resourceDomain1, resourceDomain2, resourceDomain3));

    boolean hasAccess = ruleEvaluator.hasDomain();

    assertFalse(
        hasAccess,
        "User should NOT access resource when no domains match between multiple domains");
  }

  /**
   * Helper method to create an EntityReference for a domain
   */
  private EntityReference createDomain(String name, String id) {
    EntityReference domain = new EntityReference();
    domain.setName(name);
    domain.setId(UUID.fromString(id));
    domain.setType("domain");
    domain.setFullyQualifiedName(name);
    return domain;
  }
}
