package org.openmetadata.service.search.security;

import es.org.elasticsearch.index.query.BoolQueryBuilder;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import es.org.elasticsearch.index.query.QueryBuilder;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;


class RBACConditionEvaluatorTest {

  private RBACConditionEvaluator evaluator;
  private OMQueryBuilder mockQueryBuilder;
  private User mockUser;
  private SubjectContext mockSubjectContext;

  @BeforeEach
  public void setUp() {
    evaluator = new RBACConditionEvaluator();

    // Mock the query builder
    mockQueryBuilder = mock(OMQueryBuilder.class);
    when(mockQueryBuilder.boolQuery()).thenReturn(mockQueryBuilder);
    when(mockQueryBuilder.must(any())).thenReturn(mockQueryBuilder);
    when(mockQueryBuilder.mustNot(any())).thenReturn(mockQueryBuilder);
    when(mockQueryBuilder.should(any())).thenReturn(mockQueryBuilder);
  }

  // Private method to setup mock user and policies
  private void setupMockPolicies(String expression, String effect) {
    // Mock the user
    mockUser = mock(User.class);
    EntityReference mockUserReference = mock(EntityReference.class);
    when(mockUser.getEntityReference()).thenReturn(mockUserReference);
    when(mockUserReference.getId()).thenReturn(UUID.randomUUID());
    when(mockUser.getId()).thenReturn(UUID.randomUUID());

    // Mock the policy context and rules
    SubjectContext.PolicyContext mockPolicyContext = mock(SubjectContext.PolicyContext.class);
    when(mockPolicyContext.getPolicyName()).thenReturn("TestPolicy");

    CompiledRule mockRule = mock(CompiledRule.class);
    when(mockRule.getOperations()).thenReturn(List.of(MetadataOperation.VIEW_BASIC)); // Mock operation
    when(mockRule.getCondition()).thenReturn(expression);

    // Mock the effect of the rule (ALLOW/DENY)
    CompiledRule.Effect mockEffect = mock(CompiledRule.Effect.class);
    when(mockEffect.toString()).thenReturn(effect);
    when(mockRule.getEffect()).thenReturn(mockEffect);

    when(mockPolicyContext.getRules()).thenReturn(List.of(mockRule));

    // Mock the subject context with this policy
    mockSubjectContext = mock(SubjectContext.class);
    when(mockSubjectContext.getPolicies(any())).thenReturn(List.of(mockPolicyContext).iterator());
    when(mockSubjectContext.user()).thenReturn(mockUser);
  }

  @Test
  void testIsOwner() {
    // Setup the mock for "isOwner()" expression
    setupMockPolicies("isOwner()", "ALLOW");

    // Evaluate condition
    OMQueryBuilder resultQuery = evaluator.evaluateConditions(mockSubjectContext, mockQueryBuilder);

    // Verify that the termQuery was called for the owner ID
    verify(mockQueryBuilder, times(1)).termQuery("owner.id", mockUser.getId().toString());

    // Assert that the result query is the same as mockQueryBuilder
    assertEquals(mockQueryBuilder, resultQuery);
  }

  @Test
  void testNegationWithIsOwner() {
    // Setup the mock for "!isOwner()" expression
    setupMockPolicies("!isOwner()", "DENY");

    // Evaluate condition
    evaluator.evaluateSpELCondition("!isOwner()", mockUser, mockQueryBuilder);

    // Verify that the mustNot query was called for the owner ID
    verify(mockQueryBuilder, times(1)).mustNot(any(OMQueryBuilder.class));
  }

  @Test
  void testMatchAnyTag() {
    // Setup the mock for "matchAnyTag('PII.Sensitive')" expression
    setupMockPolicies("matchAnyTag('PII.Sensitive')", "ALLOW");

    // Evaluate condition
    evaluator.evaluateSpELCondition("matchAnyTag('PII.Sensitive', 'PersonalData.Personal')", mockUser, mockQueryBuilder);

    // Verify that the termQuery was called for the tag
    verify(mockQueryBuilder, times(1)).termQuery("tags.tagFQN", "PII.Sensitive");
  }

  @Test
  void testComplexCondition() {
    // Setup the mock for complex condition
    setupMockPolicies("(matchAnyTag('PII.Sensitive') || matchAllTags('Test.Test1', 'Test.Test2')) && (!isOwner() || noOwner())", "ALLOW");

    // Evaluate complex condition
    evaluator.evaluateSpELCondition("(matchAnyTag('PII.Sensitive') || matchAllTags('Test.Test1', 'Test.Test2')) && (!isOwner() || noOwner())", mockUser, mockQueryBuilder);

    // Verify correct termQuery calls for the tags
    verify(mockQueryBuilder, times(1)).termQuery("tags.tagFQN", "PII.Sensitive");
    verify(mockQueryBuilder, times(1)).termQuery("tags.tagFQN", "Test.Test1");
    verify(mockQueryBuilder, times(1)).termQuery("tags.tagFQN", "Test.Test2");

    // Verify mustNot query for isOwner() negation
    verify(mockQueryBuilder, times(1)).mustNot(any(OMQueryBuilder.class));
  }

  @Test
  void testTermQueryIsolation() {
    ElasticQueryBuilder builder1 = new ElasticQueryBuilder();
    ElasticQueryBuilder builder2 = (ElasticQueryBuilder) builder1.termQuery("tags.tagFQN", "PII.Sensitive");
    ElasticQueryBuilder builder3 = (ElasticQueryBuilder) builder1.termQuery("tags.tagFQN", "PersonalData.Personal");

    // builder2 should only have "PII.Sensitive"
    BoolQueryBuilder query1 = (BoolQueryBuilder) builder2.build();
    Assertions.assertTrue(query1.toString().contains("PII.Sensitive"));

    // builder3 should only have "PersonalData.Personal"
    BoolQueryBuilder query2 = (BoolQueryBuilder) builder3.build();
    Assertions.assertTrue(query2.toString().contains("PersonalData.Personal"));

    // builder1 should be unchanged and empty
    BoolQueryBuilder queryOriginal = (BoolQueryBuilder) builder1.build();
    Assertions.assertTrue(queryOriginal.must().isEmpty());
  }

  @Test
  void testComplexQueryStructure() {
    setupMockPolicies("(matchAnyTag('PII.Sensitive') || matchAllTags('Test.Test1', 'Test.Test2')) && (!isOwner() || noOwner())", "ALLOW");

    // Use the real query builder
    OMQueryBuilder realQueryBuilder = new ElasticQueryBuilder();

    // Evaluate the complex condition
    OMQueryBuilder finalQueryBuilder = evaluator.evaluateSpELCondition(
        "(matchAnyTag('PII.Sensitive') || matchAllTags('Test.Test1', 'Test.Test2')) && (!isOwner() || noOwner())",
        mockUser,
        realQueryBuilder
    );
    // Capture the final query structure
    QueryBuilder finalQuery = (QueryBuilder) finalQueryBuilder.build();
    String generatedQuery = finalQuery.toString();

    // Assert that the query contains the expected fields and values
    assertTrue(generatedQuery.contains("tags.tagFQN"), "The query should contain 'tags.tagFQN'.");
    assertTrue(generatedQuery.contains("PII.Sensitive"), "The query should contain 'PII.Sensitive' tag.");
    assertTrue(generatedQuery.contains("Test.Test1"), "The query should contain 'Test.Test1' tag.");
    assertTrue(generatedQuery.contains("Test.Test2"), "The query should contain 'Test.Test2' tag.");
    assertTrue(generatedQuery.contains("owner.id"), "The query should contain 'owner.id'.");

    // Verify mustNot (negation) is applied for isOwner()
    assertTrue(generatedQuery.contains("must_not"), "The query should contain a negation (must_not).");

    // Ensure that the final query doesn't have excessive nesting
    long boolQueryCount = generatedQuery.chars().filter(ch -> ch == 'b').count();
    assertTrue(boolQueryCount <= 4, "There should be no more than 31 'bool' clauses in the query.");
  }
}