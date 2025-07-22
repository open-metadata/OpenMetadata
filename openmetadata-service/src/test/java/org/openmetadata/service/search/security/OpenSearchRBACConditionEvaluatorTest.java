package org.openmetadata.service.search.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.util.TestUtils.assertFieldDoesNotExist;
import static org.openmetadata.service.util.TestUtils.assertFieldExists;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import os.org.opensearch.index.query.QueryBuilder;

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
    QueryBuilder openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toString();

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
    QueryBuilder openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toString();

    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext, "$.bool.must[?(@.match_all)]", "match_all for hasAnyRole 'DataSteward'");
    assertFieldExists(
        jsonContext,
        "$.bool.must[?(@.term['domain.id'].value=='" + domain.getId().toString() + "')]",
        "domain.id");
  }

  @Test
  void testOpenSearchNegationWithDomainAndOwnerChecks() {
    setupMockPolicies("!hasDomain() && isOwner()", "ALLOW");
    when(mockUser.getId()).thenReturn(UUID.randomUUID());

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toString();

    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext,
        "$.bool.must_not[0].bool.must_not[?(@.exists.field=='domain.id')]",
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
    QueryBuilder openSearchQuery = ((OpenSearchQueryBuilder) finalQuery).build();
    String generatedQuery = openSearchQuery.toString();

    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext, "$.bool.must[?(@.match_all)]", "match_all for hasAnyRole 'Admin'");
    assertFieldExists(
        jsonContext,
        "$.bool.must[?(@.term['domain.id'].value=='" + domain.getId().toString() + "')]",
        "domain.id");
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
}
