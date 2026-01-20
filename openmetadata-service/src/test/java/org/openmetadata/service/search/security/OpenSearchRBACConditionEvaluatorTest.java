package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.util.TestUtils.assertFieldDoesNotExist;
import static org.openmetadata.service.util.TestUtils.assertFieldExists;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

class OpenSearchRBACConditionEvaluatorTest {

  private RBACConditionEvaluator evaluator;
  private User mockUser;
  private SubjectContext mockSubjectContext;

  @BeforeEach
  public void setUp() {
    QueryBuilderFactory queryBuilderFactory = new OpenSearchQueryBuilderFactory();
    evaluator = new RBACConditionEvaluator(queryBuilderFactory);
  }

  private void setupMockPolicies(String expression, String effect) {
    // Mock the user
    mockUser = mock(User.class);
    EntityReference mockUserReference = mock(EntityReference.class);
    when(mockUser.getEntityReference()).thenReturn(mockUserReference);
    when(mockUserReference.getId()).thenReturn(UUID.randomUUID());
    when(mockUser.getId()).thenReturn(UUID.randomUUID());
    when(mockUser.getName()).thenReturn("testUser");

    // Mock the policy context and rules
    SubjectContext.PolicyContext mockPolicyContext = mock(SubjectContext.PolicyContext.class);
    when(mockPolicyContext.getPolicyName()).thenReturn("TestPolicy");

    CompiledRule mockRule = mock(CompiledRule.class);
    when(mockRule.getOperations())
        .thenReturn(List.of(MetadataOperation.VIEW_BASIC)); // Mock operation
    when(mockRule.getCondition()).thenReturn(expression);

    // Mock the effect of the rule (ALLOW/DENY)
    CompiledRule.Effect mockEffect = CompiledRule.Effect.valueOf(effect.toUpperCase());
    when(mockRule.getEffect()).thenReturn(mockEffect);

    when(mockPolicyContext.getRules()).thenReturn(List.of(mockRule));

    // Mock the subject context with this policy
    mockSubjectContext = mock(SubjectContext.class);
    when(mockSubjectContext.getPolicies(any())).thenReturn(List.of(mockPolicyContext).iterator());
    when(mockSubjectContext.user()).thenReturn(mockUser);
  }

  @Test
  void testOpenSearchSimpleRoleAndTagMatching() {
    setupMockPolicies("hasAnyRole('Admin') && matchAnyTag('Finance', 'Confidential')", "ALLOW");

    EntityReference role = new EntityReference();
    role.setName("Admin");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toJsonString();

    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext, "$.bool.must[?(@.match_all)]", "match_all for hasAnyRole 'Admin'");
    assertFieldExists(
        jsonContext,
        "$.bool.must[1].bool.should[?(@.term['tags.tagFQN'].value=='Finance')]",
        "Finance tag");
    assertFieldExists(
        jsonContext,
        "$.bool.must[1].bool.should[?(@.term['tags.tagFQN'].value=='Confidential')]",
        "Confidential tag");
  }

  @Test
  void testOpenSearchRoleAndDomainCheck() {
    setupMockPolicies("hasAnyRole('DataSteward') && hasDomain()", "ALLOW");

    EntityReference role = new EntityReference();
    role.setName("DataSteward");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    when(mockUser.getDomains()).thenReturn(List.of(domain));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toJsonString();

    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext, "$.bool.must[?(@.match_all)]", "match_all for hasAnyRole 'DataSteward'");
    assertFieldExists(
        jsonContext,
        "$.bool.must[?(@.term['domains.id'].value=='" + domain.getId().toString() + "')]",
        "domains.id");
  }

  @Test
  void testOpenSearchNegationWithDomainAndOwnerChecks() {
    setupMockPolicies("!hasDomain() && isOwner()", "ALLOW");
    when(mockUser.getId()).thenReturn(UUID.randomUUID());

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toJsonString();

    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext,
        "$.bool.must_not[0].bool.must_not[?(@.exists.field=='domains.id')]",
        "must_not for hasDomain");
    assertFieldExists(
        jsonContext,
        "$.bool.must[?(@.term['owners.id'].value=='" + mockUser.getId().toString() + "')]",
        "owner.id");
    assertFieldDoesNotExist(jsonContext, "$.bool[?(@.match_none)]", "match_none should not exist");
  }

  @Test
  void testOpenSearchComplexCombination() {
    setupMockPolicies(
        "hasAnyRole('Admin') && matchAnyTag('Sensitive', 'Confidential') && hasDomain() && inAnyTeam('Analytics')",
        "ALLOW");

    EntityReference role = new EntityReference();
    role.setName("Admin");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    when(mockUser.getDomains()).thenReturn(List.of(domain));

    EntityReference team = new EntityReference();
    team.setId(UUID.randomUUID());
    team.setName("Analytics");
    when(mockUser.getTeams()).thenReturn(List.of(team));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toJsonString();

    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext, "$.bool.must[?(@.match_all)]", "match_all for hasAnyRole 'Admin'");
    assertFieldExists(
        jsonContext,
        "$.bool.must[?(@.term['domains.id'].value=='" + domain.getId().toString() + "')]",
        "domains.id");
    assertFieldExists(
        jsonContext, "$.bool.must[?(@.match_all)]", "match_all for inAnyTeam 'Analytics'");

    assertFieldExists(
        jsonContext,
        "$.bool.must[1].bool.should[?(@.term['tags.tagFQN'].value=='Sensitive')]",
        "Sensitive tag");
    assertFieldExists(
        jsonContext,
        "$.bool.must[1].bool.should[?(@.term['tags.tagFQN'].value=='Confidential')]",
        "Confidential tag");

    assertFieldDoesNotExist(jsonContext, "$.bool[?(@.match_none)]", "match_none should not exist");
  }

  @Test
  void testHasAnyRoleWithInheritedRoleFromTeam() {
    setupMockPolicies("hasAnyRole('DataSteward') && matchAnyTag('Sensitive')", "ALLOW");

    when(mockUser.getRoles()).thenReturn(List.of());

    UUID teamId = UUID.randomUUID();
    EntityReference teamRef = new EntityReference();
    teamRef.setId(teamId);
    teamRef.setName("EngineeringTeam");
    when(mockUser.getTeams()).thenReturn(List.of(teamRef));

    Team mockTeam = mock(Team.class);
    EntityReference inheritedRole = new EntityReference();
    inheritedRole.setName("DataSteward");
    when(mockTeam.getDefaultRoles()).thenReturn(List.of(inheritedRole));
    when(mockTeam.getParents()).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () -> Entity.getEntity(eq(Entity.TEAM), eq(teamId), anyString(), any(Include.class)))
          .thenReturn(mockTeam);

      SearchRepository mockSearchRepository = mock(SearchRepository.class);
      when(mockSearchRepository.getIndexOrAliasName(anyString()))
          .thenAnswer(invocation -> invocation.getArgument(0).toString().toLowerCase());
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);

      OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
      Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
      String generatedQuery = openSearchQuery.toJsonString();

      assertTrue(
          generatedQuery.contains("match_all"),
          "Query should contain match_all since user inherits DataSteward role from team");
      assertTrue(generatedQuery.contains("Sensitive"), "Query should contain tag condition");
      assertFalse(generatedQuery.contains("match_none"), "Query should not be match_none");
    }
  }

  @Test
  void testInAnyTeamWithTeamHierarchy() {
    setupMockPolicies("inAnyTeam('ParentTeam') && matchAnyTag('Confidential')", "ALLOW");

    UUID childTeamId = UUID.randomUUID();
    EntityReference childTeamRef = new EntityReference();
    childTeamRef.setId(childTeamId);
    childTeamRef.setName("ChildTeam");
    when(mockUser.getTeams()).thenReturn(List.of(childTeamRef));

    UUID parentTeamId = UUID.randomUUID();
    Team mockChildTeam = mock(Team.class);
    when(mockChildTeam.getName()).thenReturn("ChildTeam");
    EntityReference parentTeamRef = new EntityReference();
    parentTeamRef.setId(parentTeamId);
    parentTeamRef.setName("ParentTeam");
    when(mockChildTeam.getParents()).thenReturn(List.of(parentTeamRef));

    Team mockParentTeam = mock(Team.class);
    when(mockParentTeam.getName()).thenReturn("ParentTeam");
    when(mockParentTeam.getParents()).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TEAM), eq(childTeamId), anyString(), any(Include.class)))
          .thenReturn(mockChildTeam);
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TEAM), eq(parentTeamId), anyString(), any(Include.class)))
          .thenReturn(mockParentTeam);

      SearchRepository mockSearchRepository = mock(SearchRepository.class);
      when(mockSearchRepository.getIndexOrAliasName(anyString()))
          .thenAnswer(invocation -> invocation.getArgument(0).toString().toLowerCase());
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);

      OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
      Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
      String generatedQuery = openSearchQuery.toJsonString();

      assertTrue(
          generatedQuery.contains("match_all"),
          "Query should contain match_all since user's team is child of ParentTeam");
      assertTrue(generatedQuery.contains("Confidential"), "Query should contain tag condition");
      assertFalse(generatedQuery.contains("match_none"), "Query should not be match_none");
    }
  }

  @Test
  void testHasAnyRoleWithNoMatchingInheritedRole() {
    setupMockPolicies("hasAnyRole('Admin') && matchAnyTag('Public')", "ALLOW");

    when(mockUser.getRoles()).thenReturn(List.of());

    UUID teamId = UUID.randomUUID();
    EntityReference teamRef = new EntityReference();
    teamRef.setId(teamId);
    teamRef.setName("RegularTeam");
    when(mockUser.getTeams()).thenReturn(List.of(teamRef));

    Team mockTeam = mock(Team.class);
    EntityReference nonMatchingRole = new EntityReference();
    nonMatchingRole.setName("Viewer");
    when(mockTeam.getDefaultRoles()).thenReturn(List.of(nonMatchingRole));
    when(mockTeam.getParents()).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () -> Entity.getEntity(eq(Entity.TEAM), eq(teamId), anyString(), any(Include.class)))
          .thenReturn(mockTeam);

      SearchRepository mockSearchRepository = mock(SearchRepository.class);
      when(mockSearchRepository.getIndexOrAliasName(anyString()))
          .thenAnswer(invocation -> invocation.getArgument(0).toString().toLowerCase());
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);

      OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
      Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
      String generatedQuery = openSearchQuery.toJsonString();

      assertTrue(
          generatedQuery.contains("must_not") && generatedQuery.contains("match_all"),
          "Query should result in match_nothing since user doesn't have Admin role");
    }
  }
}
