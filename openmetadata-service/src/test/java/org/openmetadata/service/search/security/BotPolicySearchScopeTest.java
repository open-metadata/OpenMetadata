package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

/**
 * Pins what each seeded bot's policy compiles to now that bots are no longer exempt from search RBAC
 * (#30023). Bots skip team policies entirely ({@code SubjectCache#loadPoliciesForUser}), so a bot
 * compiles from its directly-assigned role alone and never picks up the Organization {@code ViewAll}
 * that makes every human's allow side {@code match_all}. That makes the per-policy shape the whole
 * story for blast radius, so a change to any seeded bot policy should fail here rather than in
 * production.
 */
class BotPolicySearchScopeTest {

  private static final String ALL_RESOURCES = "All";
  private static final String INGESTION_PIPELINE_RESOURCE = "ingestionPipeline";
  private static final String MATCH_ALL = "match_all";

  private RBACConditionEvaluator evaluator;
  private User botUser;
  private SubjectContext botSubject;

  @BeforeEach
  void setUp() {
    evaluator = new RBACConditionEvaluator(new OpenSearchQueryBuilderFactory());
  }

  @Test
  @DisplayName("A bot on an All/ViewAll policy still sees everything, so stock bots are unaffected")
  void testUnrestrictedBotPolicyCompilesToMatchAll() {
    // IngestionBotPolicy, ProfilerBotPolicy, QualityBotPolicy, LineageBotPolicy, UsageBotPolicy,
    // ApplicationBotPolicy and DataConsumerPolicy (via DefaultBotRole) all have this shape.
    givenBotWithRules(allowRule(List.of(ALL_RESOURCES), null));

    String query = compiledQuery();

    assertTrue(query.contains(MATCH_ALL), "an unconditioned ViewAll on All resources matches all");
    assertFalse(query.contains("_index"), "resources 'All' must not add an index filter");
  }

  @Test
  @DisplayName(
      "A bot whose policy names resources is scoped to them, matching its REST permissions")
  void testResourceScopedBotPolicyCompilesToIndexFilter() {
    // GovernanceBotRole carries only DefaultBotPolicy, whose sole search-relevant allow is ViewAll
    // on ingestionPipeline. This is the one seeded bot whose search results narrow.
    givenBotWithRules(allowRule(List.of(INGESTION_PIPELINE_RESOURCE), null));

    String query = compiledQuery();

    assertTrue(query.contains("_index"), "a named resource compiles to an index filter");
    assertTrue(query.contains(INGESTION_PIPELINE_RESOURCE.toLowerCase()));
  }

  @Test
  @DisplayName("A bot holding the domain-scoped policy is filtered to its own domains (#30023)")
  void testDomainScopedBotPolicyCompilesToDomainTerms() {
    UUID ownDomainId = UUID.randomUUID();
    givenBotWithRules(
        denyRule(List.of(ALL_RESOURCES), "!hasDomain()"),
        allowRule(List.of(ALL_RESOURCES), "hasDomain()"));
    when(botUser.getDomains()).thenReturn(List.of(domainRef(ownDomainId)));

    String query = compiledQuery();

    assertTrue(query.contains("domains.id"), "the subject's domains must reach the query");
    assertTrue(
        query.contains(ownDomainId.toString()), "only the subject's own domain id is allowed");
  }

  private void givenBotWithRules(CompiledRule... rules) {
    botUser = mock(User.class);
    EntityReference userReference = mock(EntityReference.class);
    when(userReference.getId()).thenReturn(UUID.randomUUID());
    when(botUser.getEntityReference()).thenReturn(userReference);
    when(botUser.getId()).thenReturn(UUID.randomUUID());
    when(botUser.getName()).thenReturn("test-bot");
    when(botUser.getIsBot()).thenReturn(true);

    SubjectContext.PolicyContext policyContext = mock(SubjectContext.PolicyContext.class);
    when(policyContext.getPolicyName()).thenReturn("TestBotPolicy");
    when(policyContext.getRules()).thenReturn(List.of(rules));

    botSubject = mock(SubjectContext.class);
    when(botSubject.isBot()).thenReturn(true);
    when(botSubject.user()).thenReturn(botUser);
    when(botSubject.getPolicies(any())).thenReturn(List.of(policyContext).iterator());
  }

  private String compiledQuery() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SearchRepository searchRepository = mock(SearchRepository.class);
      when(searchRepository.getIndexOrAliasName(anyString()))
          .thenAnswer(invocation -> invocation.getArgument(0).toString().toLowerCase());
      when(searchRepository.getChildIndexAliases(anyString())).thenReturn(Collections.emptyList());
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      OMQueryBuilder compiled = evaluator.evaluateConditions(botSubject);
      Query query = ((OpenSearchQueryBuilder) compiled).build();
      return query.toJsonString();
    }
  }

  private static CompiledRule allowRule(List<String> resources, String condition) {
    return rule(resources, condition, CompiledRule.Effect.ALLOW);
  }

  private static CompiledRule denyRule(List<String> resources, String condition) {
    return rule(resources, condition, CompiledRule.Effect.DENY);
  }

  private static CompiledRule rule(
      List<String> resources, String condition, CompiledRule.Effect effect) {
    CompiledRule compiledRule = mock(CompiledRule.class);
    when(compiledRule.getResources()).thenReturn(resources);
    when(compiledRule.getOperations()).thenReturn(List.of(MetadataOperation.VIEW_ALL));
    when(compiledRule.getCondition()).thenReturn(condition);
    when(compiledRule.getEffect()).thenReturn(effect);
    return compiledRule;
  }

  private static EntityReference domainRef(UUID id) {
    return new EntityReference().withId(id).withType(Entity.DOMAIN);
  }
}
