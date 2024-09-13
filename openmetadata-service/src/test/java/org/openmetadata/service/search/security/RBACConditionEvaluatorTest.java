package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.org.elasticsearch.index.query.QueryBuilder;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class RBACConditionEvaluatorTest {

  private RBACConditionEvaluator evaluator;
  private User mockUser;
  private SubjectContext mockSubjectContext;
  private QueryBuilderFactory queryBuilderFactory;

  @BeforeEach
  public void setUp() {
    queryBuilderFactory = new ElasticQueryBuilderFactory();
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
  void testIsOwner() {
    setupMockPolicies("isOwner()", "ALLOW");

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(generatedQuery.contains("owner.id"), "The query should contain 'owner.id'.");
    assertTrue(
        generatedQuery.contains(mockUser.getId().toString()),
        "The query should contain the user's ID.");
  }

  @Test
  void testNegationWithIsOwner() {
    setupMockPolicies("!isOwner()", "DENY");

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(
        generatedQuery.contains("must_not"), "The query should contain 'must_not' for negation.");
    assertTrue(
        generatedQuery.contains("owner.id"),
        "The query should contain 'owner.id' in the negation.");
    assertTrue(
        generatedQuery.contains(mockUser.getId().toString()),
        "The negation should contain the user's ID.");
  }

  @Test
  void testMatchAnyTag() {
    setupMockPolicies("matchAnyTag('PII.Sensitive', 'PersonalData.Personal')", "ALLOW");

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(generatedQuery.contains("tags.tagFQN"), "The query should contain 'tags.tagFQN'.");
    assertTrue(
        generatedQuery.contains("PII.Sensitive"), "The query should contain 'PII.Sensitive' tag.");
    assertTrue(
        generatedQuery.contains("PersonalData.Personal"),
        "The query should contain 'PersonalData.Personal' tag.");
  }

  @Test
  void testComplexCondition() {
    setupMockPolicies(
        "(matchAnyTag('PII.Sensitive') || matchAllTags('Test.Test1', 'Test.Test2')) && (!isOwner() || noOwner())",
        "ALLOW");

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(generatedQuery.contains("tags.tagFQN"), "The query should contain 'tags.tagFQN'.");
    assertTrue(
        generatedQuery.contains("PII.Sensitive"), "The query should contain 'PII.Sensitive' tag.");
    assertTrue(generatedQuery.contains("Test.Test1"), "The query should contain 'Test.Test1' tag.");
    assertTrue(generatedQuery.contains("Test.Test2"), "The query should contain 'Test.Test2' tag.");
    assertTrue(generatedQuery.contains("owner.id"), "The query should contain 'owner.id'.");

    assertTrue(
        generatedQuery.contains("must_not"), "The query should contain a negation (must_not).");
  }

  @Test
  void testComplexQueryStructure() throws IOException {
    setupMockPolicies(
        "(matchAnyTag('PII.Sensitive') || matchAllTags('Test.Test1', 'Test.Test2')) && (!isOwner() || noOwner())",
        "ALLOW");

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(generatedQuery.contains("tags.tagFQN"), "The query should contain 'tags.tagFQN'.");
    assertTrue(
        generatedQuery.contains("PII.Sensitive"), "The query should contain 'PII.Sensitive' tag.");
    assertTrue(generatedQuery.contains("Test.Test1"), "The query should contain 'Test.Test1' tag.");
    assertTrue(generatedQuery.contains("Test.Test2"), "The query should contain 'Test.Test2' tag.");
    assertTrue(generatedQuery.contains("owner.id"), "The query should contain 'owner.id'.");

    assertTrue(
        generatedQuery.contains("must_not"), "The query should contain a negation (must_not).");

    ObjectMapper objectMapper = new ObjectMapper();
    JsonNode rootNode = objectMapper.readTree(generatedQuery);
    AtomicInteger boolQueryCount = new AtomicInteger(0);
    countBoolQueries(rootNode, boolQueryCount);
    assertTrue(
        boolQueryCount.get() == 5, "There should be no more than 5 'bool' clauses in the query.");
  }

  @Test
  void testHasDomain() {
    setupMockPolicies("hasDomain()", "ALLOW");

    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    domain.setName("Finance");
    when(mockUser.getDomain()).thenReturn(domain);

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(generatedQuery.contains("domain.id"), "The query should contain 'domain.id'.");
    assertTrue(
        generatedQuery.contains(domain.getId().toString()),
        "The query should contain the user's domain ID.");
  }

  @Test
  void testComplexConditionWithRolesDomainTagsTeams() throws IOException {
    setupMockPolicies(
        "hasAnyRole('Admin', 'DataSteward') && hasDomain() && (matchAnyTag('Sensitive') || inAnyTeam('Analytics'))",
        "ALLOW");

    EntityReference role = new EntityReference();
    role.setName("DataSteward");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    domain.setName("Finance");
    when(mockUser.getDomain()).thenReturn(domain);

    EntityReference team = new EntityReference();
    team.setId(UUID.randomUUID());
    team.setName("Analytics");
    when(mockUser.getTeams()).thenReturn(List.of(team));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(generatedQuery.contains("domain.id"), "The query should contain 'domain.id'.");
    assertTrue(
        generatedQuery.contains(domain.getId().toString()),
        "The query should contain the user's domain ID.");
    assertTrue(generatedQuery.contains("tags.tagFQN"), "The query should contain 'tags.tagFQN'.");
    assertTrue(generatedQuery.contains("Sensitive"), "The query should contain 'Sensitive' tag.");
    assertFalse(generatedQuery.contains("match_none"), "The query should not be match_none.");
  }

  @Test
  void testConditionUserDoesNotHaveRole() throws IOException {
    setupMockPolicies("hasAnyRole('Admin', 'DataSteward') && isOwner()", "ALLOW");
    EntityReference role = new EntityReference();
    role.setName("DataConsumer");
    when(mockUser.getRoles()).thenReturn(List.of(role));
    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    // Adjust the assertion
    assertTrue(
        generatedQuery.contains("\"must_not\""), "The query should contain 'must_not' clause.");
    assertTrue(
        generatedQuery.contains("\"match_all\""),
        "The must_not clause should contain 'match_all' query.");
  }

  @Test
  void testNegationWithRolesAndTeams() throws IOException {
    setupMockPolicies("!(hasAnyRole('Viewer') || inAnyTeam('Marketing')) && isOwner()", "ALLOW");
    EntityReference role = new EntityReference();
    role.setName("Viewer");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    EntityReference team = new EntityReference();
    team.setId(UUID.randomUUID());
    team.setName("Marketing");
    when(mockUser.getTeams()).thenReturn(List.of(team));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();
    assertTrue(generatedQuery.contains("must_not"), "The query should contain 'must_not'.");
    assertTrue(
        generatedQuery.contains("match_all"), "The must_not clause should contain 'match_all'.");
  }

  @Test
  void testComplexConditionUserMeetsAllCriteria() throws IOException {
    setupMockPolicies(
        "hasDomain() && inAnyTeam('Engineering', 'Analytics') && matchAllTags('Confidential', 'Internal')",
        "ALLOW");

    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    domain.setName("Technology");
    when(mockUser.getDomain()).thenReturn(domain);

    EntityReference team = new EntityReference();
    team.setId(UUID.randomUUID());
    team.setName("Engineering");
    when(mockUser.getTeams()).thenReturn(List.of(team));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(generatedQuery.contains("domain.id"), "The query should contain 'domain.id'.");
    assertTrue(
        generatedQuery.contains(domain.getId().toString()),
        "The query should contain the user's domain ID.");
    assertTrue(generatedQuery.contains("tags.tagFQN"), "The query should contain 'tags.tagFQN'.");
    assertTrue(
        generatedQuery.contains("Confidential"), "The query should contain 'Confidential' tag.");
    assertTrue(generatedQuery.contains("Internal"), "The query should contain 'Internal' tag.");
    assertFalse(generatedQuery.contains("match_none"), "The query should not be match_none.");
  }

  @Test
  void testConditionUserLacksDomain() throws IOException {
    setupMockPolicies("hasDomain() && isOwner() && matchAnyTag('Public')", "ALLOW");
    when(mockUser.getDomain()).thenReturn(null);
    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(
        generatedQuery.contains("\"must_not\""), "The query should contain 'must_not' clause.");
    assertTrue(
        generatedQuery.contains("\"match_all\""),
        "The must_not clause should contain 'match_all' query.");
  }

  @Test
  void testNestedLogicalOperators() throws IOException {
    setupMockPolicies(
        "(hasAnyRole('Admin') || inAnyTeam('Engineering')) && (matchAnyTag('Sensitive') || isOwner())",
        "ALLOW");

    EntityReference role = new EntityReference();
    role.setName("Admin");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    EntityReference team = new EntityReference();
    team.setId(UUID.randomUUID());
    team.setName("Marketing");
    when(mockUser.getTeams()).thenReturn(List.of(team));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    assertTrue(generatedQuery.contains("tags.tagFQN"), "The query should contain 'tags.tagFQN'.");
    assertTrue(generatedQuery.contains("Sensitive"), "The query should contain 'Sensitive' tag.");
    assertTrue(generatedQuery.contains("owner.id"), "The query should contain 'owner.id'.");
    assertFalse(generatedQuery.contains("match_none"), "The query should not be match_none.");
  }

  private void countBoolQueries(JsonNode node, AtomicInteger count) {
    if (node.isObject()) {
      if (node.has("bool")) {
        count.incrementAndGet();
        countBoolQueries(node.get("bool"), count);
      } else {
        node.fields()
            .forEachRemaining(
                entry -> {
                  countBoolQueries(entry.getValue(), count);
                });
      }
    } else if (node.isArray()) {
      node.forEach(
          element -> {
            countBoolQueries(element, count);
          });
    }
  }
}
