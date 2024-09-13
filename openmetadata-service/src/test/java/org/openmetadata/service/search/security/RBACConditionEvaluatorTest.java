package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import es.org.elasticsearch.index.query.QueryBuilder;
import java.io.IOException;
import java.util.List;
import java.util.Map;
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

    // Evaluate condition and build query
    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    // Parse the generated query
    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    // Check for the presence of the PII.Sensitive tag in the "should" clause
    assertFieldExists(
        jsonContext,
        "$.bool.should[0].bool.should[?(@.term['tags.tagFQN'].value=='PII.Sensitive')]",
        "PII.Sensitive tag");

    // Check for the presence of Test.Test1 and Test.Test2 tags in the "must" clause
    assertFieldExists(
        jsonContext,
        "$.bool.should[1].bool.must[?(@.term['tags.tagFQN'].value=='Test.Test1')]",
        "Test.Test1 tag");
    assertFieldExists(
        jsonContext,
        "$.bool.should[1].bool.must[?(@.term['tags.tagFQN'].value=='Test.Test2')]",
        "Test.Test2 tag");

    // Check for the presence of owner.id in the "must_not" clause for the negation
    assertFieldExists(
        jsonContext,
        "$.bool.should[2].bool.must_not[0].bool.should[?(@.term['owner.id'])]",
        "owner.id in must_not");

    // Check for the presence of must_not for the case where there is no owner
    assertFieldExists(
        jsonContext,
        "$.bool.should[3].bool.must_not[?(@.exists.field=='owner.id')]",
        "no owner must_not clause");

    // Count the number of bool clauses
    ObjectMapper objectMapper = new ObjectMapper();
    JsonNode rootNode = objectMapper.readTree(generatedQuery);
    AtomicInteger boolQueryCount = new AtomicInteger(0);
    countBoolQueries(rootNode, boolQueryCount);
    assertTrue(
        boolQueryCount.get() == 6, "There should be no more than 5 'bool' clauses in the query.");
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

  @Test
  void testComplexNestedConditions() throws IOException {
    setupMockPolicies(
        "(hasAnyRole('Admin') || (matchAnyTag('Confidential') && hasDomain())) && (!inAnyTeam('HR') || noOwner())",
        "ALLOW");

    EntityReference role = new EntityReference();
    role.setName("Admin");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    when(mockUser.getDomain()).thenReturn(domain);

    EntityReference team = new EntityReference();
    team.setId(UUID.randomUUID());
    team.setName("Engineering");
    when(mockUser.getTeams()).thenReturn(List.of(team));

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    // Assertions
    // Check for match_all for hasAnyRole('Admin')
    assertFieldExists(
        jsonContext, "$.bool.should[?(@.match_all)]", "match_all for hasAnyRole 'Admin'");

    // Check for the presence of domain.id (hasDomain method)
    assertFieldExists(
        jsonContext, "$.bool.should[1].bool.must[?(@.term['domain.id'])]", "domain.id");

    // Check for the presence of Confidential tag in matchAnyTag('Confidential')
    assertFieldExists(
        jsonContext,
        "$.bool.should[1].bool.should[?(@.term['tags.tagFQN'].value=='Confidential')]",
        "Confidential tag");

    // Check for the presence of must_not for noOwner()
    assertFieldExists(
        jsonContext,
        "$.bool.should[2].bool.must_not[?(@.exists.field=='owner.id')]",
        "no owner must_not clause");

    // Ensure the query does not contain a match_none condition
    assertFieldDoesNotExist(jsonContext, "$.bool[?(@.match_none)]", "match_none");
  }

  @Test
  void testMultipleNestedNotOperators() throws IOException {
    setupMockPolicies(
        "!(matchAllTags('Sensitive', 'Internal') && (!hasDomain()) || isOwner())", "ALLOW");

    when(mockUser.getDomain()).thenReturn(null); // User has no domain
    when(mockUser.getId()).thenReturn(UUID.randomUUID());

    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();
    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    assertFieldExists(
        jsonContext,
        "$.bool.must_not[0].bool.should[0].bool.must[?(@.term['tags.tagFQN'].value=='Sensitive')]",
        "Sensitive");
    assertFieldExists(
        jsonContext,
        "$.bool.must_not[0].bool.should[0].bool.must[?(@.term['tags.tagFQN'].value=='Internal')]",
        "Internal");
    assertFieldExists(
        jsonContext,
        "$.bool.must_not[0].bool.should[1].bool.should[?(@.term['owner.id'])]",
        "owner.id");
  }

  @Test
  void testComplexOrConditionsWithNegations() throws IOException {
    setupMockPolicies(
        "(hasAnyRole('Analyst') && matchAnyTag('Public')) || (!hasAnyRole('Viewer') && !inAnyTeam('Finance'))",
        "ALLOW");

    // Mock user roles
    EntityReference role = new EntityReference();
    role.setName("DataScientist");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    // Mock user teams
    EntityReference team = new EntityReference();
    team.setId(UUID.randomUUID());
    team.setName("Marketing");
    when(mockUser.getTeams()).thenReturn(List.of(team));

    // Evaluate condition
    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    // The user does not have the 'Analyst' role and is not in 'Finance' team.
    // The condition '!hasAnyRole('Viewer') && !inAnyTeam('Finance')' evaluates to true.
    // The overall condition is true, so the query should be match_all or have no must_not clauses.
    assertFalse(
        generatedQuery.contains("\"must_not\""),
        "The query should not contain 'must_not' clause for roles or teams.");
  }

  @Test
  void testNestedAndOrWithMultipleMethods() throws IOException {
    setupMockPolicies(
        "(hasDomain() || matchAnyTag('External')) && (inAnyTeam('Engineering', 'Analytics') || hasAnyRole('DataEngineer')) && !noOwner()",
        "ALLOW");

    // Mock user domain
    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    when(mockUser.getDomain()).thenReturn(domain);

    // Mock user teams
    EntityReference team1 = new EntityReference();
    team1.setId(UUID.randomUUID());
    team1.setName("Engineering");
    EntityReference team2 = new EntityReference();
    team2.setId(UUID.randomUUID());
    team2.setName("Marketing");
    when(mockUser.getTeams()).thenReturn(List.of(team1, team2));

    // Mock user roles
    EntityReference role = new EntityReference();
    role.setName("DataScientist");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    // Evaluate condition
    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    // Assertions
    assertTrue(
        generatedQuery.contains("\"domain.id\""), "The query should contain 'domain.id' term.");
    assertTrue(
        generatedQuery.contains("\"owner.id\""), "The query should contain 'owner.id' term.");
    assertFalse(
        generatedQuery.contains("\"must_not\" : [ { \"exists\""),
        "The query should not contain 'must_not' clause for 'noOwner()'.");
  }

  @Test
  void testComplexConditionWithAllMethods() throws IOException {
    setupMockPolicies(
        "(hasAnyRole('Admin') && hasDomain() && matchAllTags('PII', 'Sensitive')) || (isOwner() && !matchAnyTag('Restricted'))",
        "ALLOW");

    // Mock user roles
    EntityReference role = new EntityReference();
    role.setName("Admin");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    // Mock user domain
    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    when(mockUser.getDomain()).thenReturn(domain);

    // Mock user ownership
    when(mockUser.getId()).thenReturn(UUID.randomUUID());
    EntityReference userRef = new EntityReference();
    userRef.setId(mockUser.getId());
    userRef.setType("user");
    when(mockUser.getEntityReference()).thenReturn(userRef);

    // Evaluate condition and build query
    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();

    // Parse the generated query
    DocumentContext jsonContext = JsonPath.parse(generatedQuery);

    // Assertions

    // Check for the presence of domain.id
    assertFieldExists(
        jsonContext, "$.bool.should[0].bool.must[?(@.term['domain.id'])]", "domain.id");

    // Check for the presence of PII and Sensitive tags in the matchAllTags clause
    assertFieldExists(
        jsonContext,
        "$.bool.should[0].bool.must[?(@.term['tags.tagFQN'].value=='PII')]",
        "PII tag");
    assertFieldExists(
        jsonContext,
        "$.bool.should[0].bool.must[?(@.term['tags.tagFQN'].value=='Sensitive')]",
        "Sensitive tag");

    // Check for the presence of must_not for matchAnyTag('Restricted')
    assertFieldExists(
        jsonContext,
        "$.bool.should[1].bool.must_not[0].bool.should[?(@.term['tags.tagFQN'].value=='Restricted')]",
        "must_not for matchAnyTag 'Restricted'");

    // Check for the presence of owner.id in the second should block
    assertFieldExists(
        jsonContext, "$.bool.should[1].bool.should[?(@.term['owner.id'])]", "owner.id");
  }

  @Test
  void testMultipleOrConditionsWithNestedAnd() throws IOException {
    setupMockPolicies(
        "(hasAnyRole('Admin') || hasAnyRole('DataSteward')) && (matchAnyTag('Finance') || matchAllTags('Confidential', 'Internal')) && !inAnyTeam('Data')",
        "ALLOW");

    // Mock user roles
    EntityReference role = new EntityReference();
    role.setName("DataSteward");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    // Mock user teams
    EntityReference team = new EntityReference();
    team.setId(UUID.randomUUID());
    team.setName("Engineering");
    when(mockUser.getTeams()).thenReturn(List.of(team));

    // Evaluate condition
    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();
    DocumentContext jsonContext = JsonPath.parse(generatedQuery);
    // Assertions
    // Assert that the `hasAnyRole` check results in `match_all` since the user has 'DataSteward'
    // role
    assertFieldExists(jsonContext, "$.bool.should[?(@.match_all)]", "match_all for hasAnyRole");

    // Assert that the query contains tag conditions for matchAnyTag and matchAllTags
    assertFieldExists(
        jsonContext,
        "$.bool.should[1].bool.should[?(@.term['tags.tagFQN'].value=='Finance')]",
        "Finance tag");
    assertFieldExists(
        jsonContext,
        "$.bool.should[2].bool.must[?(@.term['tags.tagFQN'].value=='Confidential')]",
        "Confidential tag");
    assertFieldExists(
        jsonContext,
        "$.bool.should[2].bool.must[?(@.term['tags.tagFQN'].value=='Internal')]",
        "Internal tag");

    assertFieldDoesNotExist(jsonContext, "$.bool.must_not", "must_not for inAnyTeam");
  }

  @Test
  void testComplexConditionWithMultipleNegations() throws IOException {
    setupMockPolicies(
        "!((hasAnyRole('Admin') || inAnyTeam('Engineering')) && matchAnyTag('Confidential') && matchAllTags('Sensitive', 'Classified')) && hasDomain() && isOwner()",
        "ALLOW");

    // Mock user roles
    EntityReference role = new EntityReference();
    role.setName("Admin");
    when(mockUser.getRoles()).thenReturn(List.of(role));

    // Mock user teams
    EntityReference team = new EntityReference();
    team.setId(UUID.randomUUID());
    team.setName("Engineering");
    when(mockUser.getTeams()).thenReturn(List.of(team));

    // Mock user domain
    EntityReference domain = new EntityReference();
    domain.setId(UUID.randomUUID());
    when(mockUser.getDomain()).thenReturn(domain);

    // Mock user ownership
    when(mockUser.getId()).thenReturn(UUID.randomUUID());
    EntityReference userRef = new EntityReference();
    userRef.setId(mockUser.getId());
    userRef.setType("user");
    when(mockUser.getEntityReference()).thenReturn(userRef);

    // Evaluate condition
    OMQueryBuilder finalQuery = evaluator.evaluateConditions(mockSubjectContext);
    QueryBuilder elasticQuery = ((ElasticQueryBuilder) finalQuery).build();
    String generatedQuery = elasticQuery.toString();
    DocumentContext jsonContext = JsonPath.parse(generatedQuery);
    // `domain.id` should be in `must`
    assertFieldExists(jsonContext, "$.bool.must[?(@.term['domain.id'])]", "domain.id");

    // `Sensitive` and `Classified` tags should be in `must_not[0].bool.must`
    assertFieldExists(
        jsonContext,
        "$.bool.must_not[0].bool.must[?(@.term['tags.tagFQN'].value=='Sensitive')]",
        "Sensitive");
    assertFieldExists(
        jsonContext,
        "$.bool.must_not[0].bool.must[?(@.term['tags.tagFQN'].value=='Classified')]",
        "Classified");

    // `Confidential` tag should be in `must_not[0].bool.should`
    assertFieldExists(
        jsonContext,
        "$.bool.must_not[0].bool.should[?(@.term['tags.tagFQN'].value=='Confidential')]",
        "Confidential");

    // Ownership (isOwner condition) should be in `should`
    assertFieldExists(jsonContext, "$.bool.should[?(@.term['owner.id'])]", "owner.id");
  }

  private void assertFieldExists(DocumentContext jsonContext, String jsonPath, String fieldName) {
    List<Map<String, Object>> result = jsonContext.read(jsonPath, List.class);
    assertTrue(result.size() > 0, "The query should contain '" + fieldName + "' term.");
  }

  private void assertFieldDoesNotExist(
      DocumentContext jsonContext, String jsonPath, String fieldName) {
    try {
      List<Map<String, Object>> result = jsonContext.read(jsonPath, List.class);
      assertTrue(result.isEmpty(), "The query should not contain '" + fieldName + "' term.");
    } catch (PathNotFoundException e) {
      // If the path doesn't exist, this is expected behavior, so the test should pass.
      assertTrue(true, "The path does not exist as expected: " + jsonPath);
    }
  }
}
