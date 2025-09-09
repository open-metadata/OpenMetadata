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
    // Given: User has domain "team1-domain"
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    // And: Resource has the same domain
    EntityReference resourceDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(resourceContext.getDomains()).thenReturn(List.of(resourceDomain));

    // And: SubjectContext can match domains
    when(subjectContext.hasDomains(anyList())).thenReturn(true);

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be granted
    assertTrue(hasAccess, "User with matching domain should have access to resource");
  }

  @Test
  @DisplayName("User with different domain should NOT access resource with another domain")
  void testUserWithDifferentDomain() {
    // Given: User has domain "team1-domain"
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    // And: Resource has different domain "team2-domain"
    EntityReference resourceDomain =
        createDomain("team2-domain", "87654321-4321-4321-4321-210987654321");
    when(resourceContext.getDomains()).thenReturn(List.of(resourceDomain));

    // And: SubjectContext cannot match domains
    when(subjectContext.hasDomains(anyList())).thenReturn(false);

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be denied
    assertFalse(hasAccess, "User with different domain should NOT have access");
  }

  @Test
  @DisplayName("User with multiple domains should access resource if at least one domain matches")
  void testUserWithMultipleDomains() {
    // Given: User has multiple domains
    EntityReference domain1 = createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    EntityReference domain2 = createDomain("team2-domain", "87654321-4321-4321-4321-210987654321");
    when(user.getDomains()).thenReturn(Arrays.asList(domain1, domain2));

    // And: Resource has one of the user's domains
    EntityReference resourceDomain =
        createDomain("team2-domain", "87654321-4321-4321-4321-210987654321");
    when(resourceContext.getDomains()).thenReturn(List.of(resourceDomain));

    // And: SubjectContext can match at least one domain
    when(subjectContext.hasDomains(anyList())).thenReturn(true);

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be granted
    assertTrue(hasAccess, "User with multiple domains should have access if one matches");
  }

  @Test
  @DisplayName("User without domain should ONLY access resources without domain")
  void testUserWithoutDomainAccessingNonDomainResource() {
    // Given: User has no domains
    when(user.getDomains()).thenReturn(null);

    // And: Resource has no domains
    when(resourceContext.getDomains()).thenReturn(null);

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be granted
    assertTrue(hasAccess, "User without domain should access resources without domain");
  }

  @Test
  @DisplayName("User without domain should NOT access resources with domain")
  void testUserWithoutDomainAccessingDomainResource() {
    // Given: User has no domains
    when(user.getDomains()).thenReturn(null);

    // And: Resource has a domain
    EntityReference resourceDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(resourceContext.getDomains()).thenReturn(List.of(resourceDomain));

    // And: SubjectContext cannot match domains (user has none)
    when(subjectContext.hasDomains(anyList())).thenReturn(false);

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be denied
    assertFalse(hasAccess, "User without domain should NOT access resources with domain");
  }

  @Test
  @DisplayName("User with domain should NOT access resources without domain")
  void testUserWithDomainAccessingNonDomainResource() {
    // Given: User has a domain
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    // And: Resource has no domains
    when(resourceContext.getDomains()).thenReturn(null);

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be denied
    assertFalse(hasAccess, "User with domain should NOT access resources without domain");
  }

  @Test
  @DisplayName("Empty domain lists should be treated as no domain")
  void testEmptyDomainLists() {
    // Given: User has empty domain list
    when(user.getDomains()).thenReturn(Collections.emptyList());

    // And: Resource has empty domain list
    when(resourceContext.getDomains()).thenReturn(Collections.emptyList());

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be granted (both have no domains)
    assertTrue(hasAccess, "Empty domain lists should be treated as no domain");
  }

  @Test
  @DisplayName(
      "Resource with multiple domains should be accessible if user has any matching domain")
  void testResourceWithMultipleDomains() {
    // Given: User has one domain
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    // And: Resource has multiple domains including user's domain
    EntityReference resourceDomain1 =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    EntityReference resourceDomain2 =
        createDomain("team2-domain", "87654321-4321-4321-4321-210987654321");
    when(resourceContext.getDomains()).thenReturn(Arrays.asList(resourceDomain1, resourceDomain2));

    // And: SubjectContext can match domains
    when(subjectContext.hasDomains(anyList())).thenReturn(true);

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be granted
    assertTrue(hasAccess, "User should access resource if any domain matches");
  }

  @Test
  @DisplayName("Null contexts should deny access")
  void testNullContexts() {
    // Given: Null subject context
    RuleEvaluator evaluatorWithNullSubject = new RuleEvaluator(null, null, resourceContext);

    // When/Then: Should return false
    assertFalse(evaluatorWithNullSubject.hasDomain(), "Null subject context should deny access");

    // Given: Null resource context
    RuleEvaluator evaluatorWithNullResource = new RuleEvaluator(null, subjectContext, null);

    // When/Then: Should return false
    assertFalse(evaluatorWithNullResource.hasDomain(), "Null resource context should deny access");
  }

  @Test
  @DisplayName("List operations should return true for post-filtering")
  void testListOperations() {
    // Given: Entity is null (indicating a list operation)
    when(resourceContext.getEntity()).thenReturn(null);

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Should return true (for post-filtering)
    assertTrue(hasAccess, "List operations should return true for post-filtering");

    // Given: Entity has no ID (also indicating a list operation)
    EntityInterface entityWithoutId = mock(EntityInterface.class);
    when(entityWithoutId.getId()).thenReturn(null);
    when(resourceContext.getEntity()).thenReturn(entityWithoutId);

    // When: Checking domain access again
    hasAccess = ruleEvaluator.hasDomain();

    // Then: Should return true (for post-filtering)
    assertTrue(
        hasAccess, "List operations with entity but no ID should return true for post-filtering");
  }

  @Test
  @DisplayName("User should access resource with inherited domain")
  void testInheritedDomainAccess() {
    // Given: User has a domain
    EntityReference userDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    // And: Resource has an inherited domain that matches
    EntityReference inheritedDomain =
        createDomain("team1-domain", "12345678-1234-1234-1234-123456789012");
    inheritedDomain.setInherited(true); // Mark as inherited
    when(resourceContext.getDomains()).thenReturn(List.of(inheritedDomain));

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be granted
    assertTrue(hasAccess, "User should access resource with matching inherited domain");
  }

  @Test
  @DisplayName("User with inherited domain restriction should match inherited resource domains")
  void testBothInheritedDomains() {
    // Given: User has a domain
    EntityReference userDomain =
        createDomain("parent-domain", "12345678-1234-1234-1234-123456789012");
    when(user.getDomains()).thenReturn(List.of(userDomain));

    // And: Resource has the same domain inherited from parent
    EntityReference inheritedDomain =
        createDomain("parent-domain", "12345678-1234-1234-1234-123456789012");
    inheritedDomain.setInherited(true);
    when(resourceContext.getDomains()).thenReturn(List.of(inheritedDomain));

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be granted
    assertTrue(
        hasAccess, "Inherited domains should be treated as regular domains for access control");
  }

  @Test
  @DisplayName("User with multiple domains should match resource with multiple domains if any overlap")
  void testBothWithMultipleDomains() {
    // Given: User has multiple domains
    EntityReference userDomain1 = createDomain("finance-domain", "11111111-1111-1111-1111-111111111111");
    EntityReference userDomain2 = createDomain("marketing-domain", "22222222-2222-2222-2222-222222222222");
    EntityReference userDomain3 = createDomain("engineering-domain", "33333333-3333-3333-3333-333333333333");
    when(user.getDomains()).thenReturn(Arrays.asList(userDomain1, userDomain2, userDomain3));

    // And: Resource has multiple domains with partial overlap
    EntityReference resourceDomain1 = createDomain("hr-domain", "44444444-4444-4444-4444-444444444444");
    EntityReference resourceDomain2 = createDomain("marketing-domain", "22222222-2222-2222-2222-222222222222"); // Matches user's domain2
    EntityReference resourceDomain3 = createDomain("sales-domain", "55555555-5555-5555-5555-555555555555");
    when(resourceContext.getDomains()).thenReturn(Arrays.asList(resourceDomain1, resourceDomain2, resourceDomain3));

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be granted because marketing-domain matches
    assertTrue(hasAccess, "User should access resource when at least one domain matches between multiple domains");
  }

  @Test
  @DisplayName("User with multiple domains should NOT access resource with multiple non-matching domains")
  void testBothWithMultipleDomainsNoMatch() {
    // Given: User has multiple domains
    EntityReference userDomain1 = createDomain("finance-domain", "11111111-1111-1111-1111-111111111111");
    EntityReference userDomain2 = createDomain("marketing-domain", "22222222-2222-2222-2222-222222222222");
    when(user.getDomains()).thenReturn(Arrays.asList(userDomain1, userDomain2));

    // And: Resource has multiple domains with NO overlap
    EntityReference resourceDomain1 = createDomain("hr-domain", "44444444-4444-4444-4444-444444444444");
    EntityReference resourceDomain2 = createDomain("engineering-domain", "33333333-3333-3333-3333-333333333333");
    EntityReference resourceDomain3 = createDomain("sales-domain", "55555555-5555-5555-5555-555555555555");
    when(resourceContext.getDomains()).thenReturn(Arrays.asList(resourceDomain1, resourceDomain2, resourceDomain3));

    // When: Checking domain access
    boolean hasAccess = ruleEvaluator.hasDomain();

    // Then: Access should be denied because no domains match
    assertFalse(hasAccess, "User should NOT access resource when no domains match between multiple domains");
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
