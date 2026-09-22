package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.util.TestUtils.assertFieldDoesNotExist;
import static org.openmetadata.service.util.TestUtils.assertFieldExists;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.security.policyevaluator.TeamGraphFixture;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

class OpenSearchRBACConditionEvaluatorTest {

  private RBACConditionEvaluator evaluator;
  private User mockUser;
  private SubjectContext mockSubjectContext;

  /**
   * TeamHierarchyResolver reads the team graph out of entity_relationship rather than loading a
   * Team per node, so tests that exercise hasAnyRole() or inAnyTeam() register the graph here.
   * Installed once because this class runs its tests concurrently and each of them uses fresh ids.
   */
  @BeforeAll
  static void installTeamGraph() {
    TeamRepository teamRepository = mock(TeamRepository.class);
    RoleRepository roleRepository = mock(RoleRepository.class);
    Entity.registerEntity(Team.class, Entity.TEAM, teamRepository);
    Entity.registerEntity(Role.class, Entity.ROLE, roleRepository);
    TeamGraphFixture.install();
    TeamGraphFixture.stubReferences(teamRepository, Entity.TEAM);
    TeamGraphFixture.stubReferences(roleRepository, Entity.ROLE);
  }

  private static EntityReference reference(String entityType, String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(entityType).withName(name);
  }

  @BeforeEach
  public void setUp() {
    QueryBuilderFactory queryBuilderFactory = new OpenSearchQueryBuilderFactory();
    evaluator = new RBACConditionEvaluator(queryBuilderFactory);

    SearchRepository mockSearchRepository = mock(SearchRepository.class);
    when(mockSearchRepository.getIndexOrAliasName(anyString()))
        .thenAnswer(invocation -> invocation.getArgument(0).toString().toLowerCase());
    when(mockSearchRepository.getChildIndexAliases(anyString()))
        .thenReturn(Collections.emptyList());
    Entity.setSearchRepository(mockSearchRepository);
  }

  @AfterEach
  public void tearDown() {
    Entity.setSearchRepository(null);
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
        "$..bool.should[?(@.term['domains.id'].value=='" + domain.getId().toString() + "')]",
        "domains.id");
  }

  @Test
  void testHasDomainWithMultipleDomains() {
    setupMockPolicies("hasDomain()", "ALLOW");

    EntityReference domain1 = new EntityReference();
    domain1.setId(UUID.randomUUID());
    domain1.setName("Finance");

    EntityReference domain2 = new EntityReference();
    domain2.setId(UUID.randomUUID());
    domain2.setName("Engineering");

    when(mockUser.getDomains()).thenReturn(List.of(domain1, domain2));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toJsonString();

    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext,
        "$.bool.should[?(@.term['domains.id'].value=='" + domain1.getId() + "')]",
        "domain1 should be in a should (OR) clause");
    assertFieldExists(
        jsonContext,
        "$.bool.should[?(@.term['domains.id'].value=='" + domain2.getId() + "')]",
        "domain2 should be in a should (OR) clause");
    assertFieldExists(
        jsonContext,
        "$.bool.should[?(@.bool.must_not)]",
        "should include a clause for entities with no domain");
  }

  @Test
  void testHasDomainRestrictsDomainIndexToOwnDomains() {
    setupMockPolicies("hasDomain()", "ALLOW");

    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    domain.setName("Finance");
    when(mockUser.getDomains()).thenReturn(List.of(domain));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    String generatedQuery = ((OpenSearchQueryBuilder) finalQuery).build().toJsonString();
    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext,
        "$.bool.should[?(@.terms['id.keyword'])]",
        "a Domain entity must be matchable by its own id so the domain index hides foreign domains");
    assertTrue(
        generatedQuery.contains(domain.getId().toString()),
        "The id terms clause should contain the user's domain id.");
    assertFieldExists(
        jsonContext,
        "$.bool.should[?(@.bool.must_not[?(@.term['entityType'].value=='domain')])]",
        "the no-domain clause must exclude Domain documents so foreign domains do not leak");
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
        "$.bool.must[?(@.nested.query.term['owners.id'].value=='"
            + mockUser.getId().toString()
            + "')]",
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
        "$..bool.should[?(@.term['domains.id'].value=='" + domain.getId().toString() + "')]",
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

    TeamGraphFixture.registerTeam(
        teamRef, List.of(), List.of(reference(Entity.ROLE, "DataSteward")), List.of());

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toJsonString();

    assertTrue(
        generatedQuery.contains("match_all"),
        "Query should contain match_all since user inherits DataSteward role from team");
    assertTrue(generatedQuery.contains("Sensitive"), "Query should contain tag condition");
    assertFalse(generatedQuery.contains("match_none"), "Query should not be match_none");
  }

  @Test
  void testInAnyTeamWithTeamHierarchy() {
    setupMockPolicies("inAnyTeam('ParentTeam') && matchAnyTag('Confidential')", "ALLOW");

    UUID childTeamId = UUID.randomUUID();
    EntityReference childTeamRef = new EntityReference();
    childTeamRef.setId(childTeamId);
    childTeamRef.setName("ChildTeam");
    when(mockUser.getTeams()).thenReturn(List.of(childTeamRef));

    EntityReference parentTeamRef = reference(Entity.TEAM, "ParentTeam");
    TeamGraphFixture.registerTeam(parentTeamRef, List.of(), List.of(), List.of());
    TeamGraphFixture.registerTeam(childTeamRef, List.of(parentTeamRef), List.of(), List.of());

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toJsonString();

    assertTrue(
        generatedQuery.contains("match_all"),
        "Query should contain match_all since user's team is child of ParentTeam");
    assertTrue(generatedQuery.contains("Confidential"), "Query should contain tag condition");
    assertFalse(generatedQuery.contains("match_none"), "Query should not be match_none");
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

    TeamGraphFixture.registerTeam(
        teamRef, List.of(), List.of(reference(Entity.ROLE, "Viewer")), List.of());

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    Query openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toJsonString();

    assertTrue(
        generatedQuery.contains("must_not") && generatedQuery.contains("match_all"),
        "Query should result in match_nothing since user doesn't have Admin role");
  }

  @Test
  void testNestedQueryWorksForMappedFields() {
    // Verifies nested query produces correct structure for indexes that have the field mapped
    OpenSearchQueryBuilderFactory factory = new OpenSearchQueryBuilderFactory();

    OMQueryBuilder nested =
        factory.nestedQuery("owners", factory.termQuery("owners.id", "user-abc"));
    Query query = ((OpenSearchQueryBuilder) nested).build();
    String json = query.toJsonString();

    assertTrue(json.contains("\"path\":\"owners\""), "must target correct nested path");
    assertTrue(json.contains("\"owners.id\""), "must query the nested field");
    assertTrue(json.contains("\"user-abc\""), "must contain the search value");
  }

  @Test
  void testNestedQueryDoesNotFailForUnmappedFields() {
    // Verifies ignore_unmapped=true is set so indexes without the nested field don't throw errors
    OpenSearchQueryBuilderFactory factory = new OpenSearchQueryBuilderFactory();

    OMQueryBuilder nested =
        factory.nestedQuery("owners", factory.termQuery("owners.id", "user-abc"));
    Query query = ((OpenSearchQueryBuilder) nested).build();
    String json = query.toJsonString();

    assertTrue(
        json.contains("\"ignore_unmapped\":true"),
        "must set ignore_unmapped so query works on indexes without this nested field");
  }

  @Test
  void testStaticNestedQueryWorksForMappedFields() {
    Query inner =
        Query.of(q -> q.term(t -> t.field("owners.id").value(v -> v.stringValue("team-1"))));

    Query nested =
        org.openmetadata.service.search.opensearch.OpenSearchQueryBuilder.nestedQuery(
            "owners", inner);
    String json = nested.toJsonString();

    assertTrue(json.contains("\"path\":\"owners\""), "must target correct nested path");
    assertTrue(json.contains("\"owners.id\""), "must query the nested field");
    assertTrue(json.contains("\"team-1\""), "must contain the search value");
  }

  @Test
  void testStaticNestedQueryDoesNotFailForUnmappedFields() {
    Query inner =
        Query.of(q -> q.term(t -> t.field("owners.id").value(v -> v.stringValue("team-1"))));

    Query nested =
        org.openmetadata.service.search.opensearch.OpenSearchQueryBuilder.nestedQuery(
            "owners", inner);
    String json = nested.toJsonString();

    assertTrue(
        json.contains("\"ignore_unmapped\":true"),
        "must set ignore_unmapped so query works on indexes without this nested field");
  }
}
