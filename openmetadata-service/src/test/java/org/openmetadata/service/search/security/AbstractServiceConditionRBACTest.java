package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.stubbing.Answer;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.ServiceAttributeResolver;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Search translation of the {@code matchAnyService*} policy conditions. The translation is written
 * against {@link QueryBuilderFactory} and so is engine-agnostic; the two subclasses supply the
 * ElasticSearch and OpenSearch factories and their serializers so both wire formats are pinned
 * without duplicating the cases.
 *
 * <p>The condition compiles resolved service ids into the query as literals, so these tests stub
 * the resolver rather than reading services from a database.
 */
abstract class AbstractServiceConditionRBACTest {

  private static final String MATCH_ALL = "match_all";
  private static final String MUST_NOT = "must_not";
  private static final String HIDDEN_TAG = "Environment.Development";

  private final String serviceIdOne = UUID.randomUUID().toString();
  private final String serviceIdTwo = UUID.randomUUID().toString();

  private RBACConditionEvaluator evaluator;
  private SubjectContext subjectContext;
  private List<SubjectContext.PolicyContext> policies;
  private MockedStatic<ServiceAttributeResolver> resolver;

  /** The engine's factory under test. */
  protected abstract QueryBuilderFactory queryBuilderFactory();

  /** Serializes a compiled query into the engine's wire JSON. */
  protected abstract String serialize(OMQueryBuilder queryBuilder);

  @BeforeEach
  void setUp() {
    policies = new ArrayList<>();
    evaluator = new RBACConditionEvaluator(queryBuilderFactory());

    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getIndexOrAliasName(anyString()))
        .thenAnswer(invocation -> invocation.getArgument(0, String.class).toLowerCase());
    when(searchRepository.getChildIndexAliases(anyString())).thenReturn(Collections.emptyList());
    Entity.setSearchRepository(searchRepository);

    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("testUser")
            .withFullyQualifiedName("testUser");
    subjectContext = mock(SubjectContext.class);
    when(subjectContext.user()).thenReturn(user);
    when(subjectContext.getPolicies(any())).thenAnswer(invocation -> policies.iterator());

    resolver = mockStatic(ServiceAttributeResolver.class);
    resolveTo();
  }

  @AfterEach
  void tearDown() {
    resolver.close();
    Entity.setSearchRepository(null);
  }

  @Test
  void denyOnServiceTag_hidesTheAssetsAndTheServiceItself() {
    resolveTo(serviceIdOne, serviceIdTwo);
    givenRule("matchAnyServiceTag('" + HIDDEN_TAG + "')", Rule.Effect.DENY);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertTrue(query.contains(MUST_NOT), "a Deny must exclude the matched documents");
    assertTrue(query.contains("service.id"), "child assets are matched by their service id");
    assertTrue(
        query.contains("id.keyword"),
        "the service's own document is matched too, or a Deny would hide every table but leave "
            + "the service listed");
    assertTrue(query.contains(serviceIdOne) && query.contains(serviceIdTwo));
  }

  @Test
  void allowOnServiceTag_matchesTheAssetsAndTheServiceItself() {
    resolveTo(serviceIdOne);
    givenRule("matchAnyServiceTag('" + HIDDEN_TAG + "')", Rule.Effect.ALLOW);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertTrue(query.contains("service.id"));
    assertTrue(query.contains("id.keyword"));
    assertTrue(query.contains(serviceIdOne));
    assertFalse(query.contains(MUST_NOT), "an Allow should not negate anything");
  }

  /**
   * A tag no service carries makes the condition false for every document, and that has to be said
   * as match-nothing rather than as {@code terms(service.id, [])}. An empty terms clause reads to
   * {@link ConditionCollector} as a real clause, so the OR and NOT short-circuits never fire and
   * correctness would rest on how each client library happens to serialize an empty value list.
   */
  @Test
  void unresolvedServiceTag_deny_hidesNothing() {
    givenRule("matchAnyServiceTag('Environment.NoSuchTag')", Rule.Effect.DENY);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertFalse(query.contains("terms"), "no terms clause should be emitted for an empty id set");
    assertFalse(query.contains("service.id"));
    assertTrue(query.contains(MATCH_ALL), "a Deny that matches nothing leaves everything visible");
  }

  @Test
  void unresolvedServiceTag_allow_grantsNothing() {
    givenRule("matchAnyServiceTag('Environment.NoSuchTag')", Rule.Effect.ALLOW);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertFalse(query.contains("terms"));
    assertEquals(matchNoneJson(), query, "an Allow that matches no service grants nothing");
  }

  @Test
  void negatedUnresolvedServiceTag_matchesEverything() {
    givenRule("!matchAnyServiceTag('Environment.NoSuchTag')", Rule.Effect.ALLOW);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertTrue(query.contains(MATCH_ALL));
    assertFalse(query.contains("terms"));
  }

  @Test
  void serviceTagWithNoArguments_matchesNothing() {
    resolveTo(serviceIdOne);
    givenRule("matchAnyServiceTag()", Rule.Effect.ALLOW);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertEquals(matchNoneJson(), query);
  }

  /** serviceType is indexed on both the asset and the service, so it needs no id resolution. */
  @Test
  void serviceType_filtersOnTheIndexedServiceTypeField() {
    givenRule("matchAnyServiceType('Snowflake', 'BigQuery')", Rule.Effect.DENY);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertTrue(query.contains("serviceType"));
    assertTrue(query.contains("Snowflake") && query.contains("BigQuery"));
    assertFalse(query.contains("service.id"), "no id resolution is needed for a service type");
  }

  @Test
  void serviceEnvironment_resolvesToServiceIds() {
    resolveTo(serviceIdOne);
    givenRule("matchAnyServiceEnvironment('Development')", Rule.Effect.DENY);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertTrue(query.contains("service.id"));
    assertTrue(query.contains("id.keyword"), "the service's own document is covered too");
    assertTrue(query.contains(serviceIdOne));
  }

  @Test
  void unresolvedServiceEnvironment_deny_hidesNothing() {
    givenRule("matchAnyServiceEnvironment('Production')", Rule.Effect.DENY);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertFalse(query.contains("terms"));
    assertTrue(query.contains(MATCH_ALL));
  }

  @Test
  void serviceName_resolvesToServiceIds() {
    resolveTo(serviceIdOne);
    givenRule("matchAnyServiceName('snowflake-sandbox')", Rule.Effect.DENY);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertTrue(query.contains("service.id"));
    assertTrue(query.contains(serviceIdOne));
    assertTrue(
        query.contains("id.keyword"),
        "resolving names to ids rather than filtering on service.name also covers the service doc");
  }

  @Test
  void scopedResources_keepBothTheIndexFilterAndTheServiceClause() {
    resolveTo(serviceIdOne);
    givenRule("matchAnyServiceTag('" + HIDDEN_TAG + "')", Rule.Effect.DENY, List.of("table"));

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertTrue(query.contains("_index"), "the rule's resource scope must still narrow the query");
    assertTrue(query.contains("service.id"));
    assertTrue(query.contains(serviceIdOne));
  }

  /**
   * Arguments used to be read by stripping every quote out of the expression's source text, which
   * silently rewrote any value containing an apostrophe. For a service condition that produced an
   * unresolvable tag and a Deny that quietly hid nothing, while the REST evaluator — which receives
   * the literal from SpEL — kept hiding correctly.
   */
  @Test
  void argumentContainingAnApostrophe_isNotMangled() {
    givenRule("matchAnyTag('Business Glossary.Men''s Wear')", Rule.Effect.DENY);

    String query = serialize(evaluator.evaluateConditions(subjectContext));

    assertTrue(
        query.contains("Men's Wear"), "the apostrophe in the tag name must survive translation");
  }

  private String matchNoneJson() {
    return serialize(queryBuilderFactory().matchNoneQuery());
  }

  /**
   * Stubs the resolver to answer {@code serviceIds} for any non-empty lookup, and nothing for an
   * empty one — mirroring the real resolver, which unions per key and so resolves an empty argument
   * list to an empty id set.
   */
  private void resolveTo(String... serviceIds) {
    Set<String> resolved = Set.of(serviceIds);
    Answer<Set<String>> byKeys =
        invocation -> {
          Collection<String> keys = invocation.getArgument(0);
          return keys.isEmpty() ? Set.of() : resolved;
        };
    resolver.when(() -> ServiceAttributeResolver.serviceIdsForTags(any())).thenAnswer(byKeys);
    resolver.when(() -> ServiceAttributeResolver.serviceIdsForNames(any())).thenAnswer(byKeys);
    resolver
        .when(() -> ServiceAttributeResolver.serviceIdsForEnvironments(any()))
        .thenAnswer(byKeys);
  }

  private void givenRule(String condition, Rule.Effect effect) {
    givenRule(condition, effect, List.of("All"));
  }

  private void givenRule(String condition, Rule.Effect effect, List<String> resources) {
    CompiledRule rule = mock(CompiledRule.class);
    when(rule.getCondition()).thenReturn(condition);
    when(rule.getEffect()).thenReturn(effect);
    when(rule.getResources()).thenReturn(resources);
    when(rule.getOperations()).thenReturn(List.of(MetadataOperation.VIEW_ALL));

    SubjectContext.PolicyContext policyContext = mock(SubjectContext.PolicyContext.class);
    when(policyContext.getPolicyName()).thenReturn("TestPolicy");
    when(policyContext.getRules()).thenReturn(List.of(rule));
    policies.add(policyContext);
  }
}
