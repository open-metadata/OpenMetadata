package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.TotalHitsRelation;

/**
 * Verifies that {@code OpenSearchAggregationManager.aggregate(AggregationRequest,
 * SubjectContext)} applies the caller's RBAC policy conditions so the aggregation buckets are
 * computed only over documents the caller is permitted to see — mirroring the listing path. A
 * non-admin subject with access control enabled must receive a filter referencing its own domain;
 * an admin, a {@code null} subject, or a subject with access control disabled must not.
 */
class OpenSearchAggregationRbacTest {

  private static final String TABLE_INDEX = "table_search_index";
  private static final UUID DOMAIN_ID = UUID.randomUUID();
  private static SearchSettings aclOffSettings;
  private static SearchSettings aclOnSettings;

  private final List<SearchRequest> sent = new ArrayList<>();
  private MockedStatic<Entity> entity;
  private MockedStatic<SettingsCache> settings;
  private OpenSearchClient client;
  private RBACConditionEvaluator evaluator;

  @BeforeAll
  static void loadShippedSearchSettings() throws Exception {
    List<String> files =
        EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
    String json =
        CommonUtil.getResourceAsStream(EntityRepository.class.getClassLoader(), files.getFirst());
    aclOffSettings = JsonUtils.readValue(json, SearchSettings.class);
    aclOnSettings = JsonUtils.readValue(json, SearchSettings.class);
    aclOnSettings.getGlobalSettings().setEnableAccessControl(true);
  }

  @BeforeEach
  void setUp() throws Exception {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(anyString())).thenAnswer(i -> i.getArgument(0));
    when(repository.getIndexNameWithoutAlias(anyString())).thenAnswer(i -> i.getArgument(0));
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(repository);
    settings = mockStatic(SettingsCache.class);
    settings
        .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
        .thenReturn(aclOnSettings);
    client = mock(OpenSearchClient.class);
    when(client.search(any(SearchRequest.class), eq(JsonData.class)))
        .thenAnswer(
            invocation -> {
              sent.add(invocation.getArgument(0));
              return new SearchResponse.Builder<JsonData>()
                  .took(1)
                  .timedOut(false)
                  .shards(shards -> shards.total(1).successful(1).failed(0))
                  .hits(
                      hits ->
                          hits.total(t -> t.value(0).relation(TotalHitsRelation.Eq))
                              .hits(List.of()))
                  .build();
            });
    evaluator = new RBACConditionEvaluator(new OpenSearchQueryBuilderFactory());
  }

  @AfterEach
  void tearDown() {
    settings.close();
    entity.close();
  }

  @Test
  void nonAdminSubjectWithAccessControlOnAppliesRbacFilter() throws Exception {
    OpenSearchAggregationManager manager = new OpenSearchAggregationManager(client, evaluator);
    aggregate(manager, domainScopedSubject(false));
    JsonNode json = json(sent.getFirst());
    assertTrue(
        json.toString().contains("domains.id"),
        "non-admin aggregation must be RBAC-filtered by domain: " + json);
    assertTrue(
        json.toString().contains(DOMAIN_ID.toString()),
        "the subject's own domain id must reach the query: " + json);
  }

  @Test
  void adminSubjectIsNotRbacFiltered() throws Exception {
    OpenSearchAggregationManager manager = new OpenSearchAggregationManager(client, evaluator);
    aggregate(manager, domainScopedSubject(true));
    JsonNode json = json(sent.getFirst());
    assertFalse(
        json.toString().contains("domains.id"),
        "admin aggregation must not be RBAC-filtered: " + json);
  }

  @Test
  void nullSubjectIsNotRbacFiltered() throws Exception {
    OpenSearchAggregationManager manager = new OpenSearchAggregationManager(client, evaluator);
    aggregate(manager, null);
    JsonNode json = json(sent.getFirst());
    assertFalse(
        json.toString().contains("domains.id"),
        "null-subject aggregation must not be RBAC-filtered: " + json);
  }

  @Test
  void accessControlOffLeavesQueryUnfilteredByRbac() throws Exception {
    settings
        .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
        .thenReturn(aclOffSettings);
    OpenSearchAggregationManager manager = new OpenSearchAggregationManager(client, evaluator);
    aggregate(manager, domainScopedSubject(false));
    JsonNode json = json(sent.getFirst());
    assertFalse(
        json.toString().contains("domains.id"),
        "access-control-off aggregation must not be RBAC-filtered: " + json);
  }

  @Test
  void subjectLessOverloadProducesSameQueryAsNullSubject() throws Exception {
    OpenSearchAggregationManager manager = new OpenSearchAggregationManager(client, evaluator);

    sent.clear();
    manager.aggregate(baseRequest()).close();
    JsonNode fromNoArg = json(sent.getFirst());

    sent.clear();
    manager.aggregate(baseRequest(), null).close();
    JsonNode fromNullSubject = json(sent.getFirst());

    assertEquals(
        fromNoArg, fromNullSubject, "aggregate(request) must match aggregate(request, null)");
    assertFalse(
        fromNoArg.toString().contains("domains.id"), "null subject must not be RBAC-filtered");
  }

  private AggregationRequest baseRequest() {
    return new AggregationRequest()
        .withIndex(TABLE_INDEX)
        .withQuery("*")
        .withFieldName("entityType")
        .withFieldValue("")
        .withSize(10);
  }

  private void aggregate(OpenSearchAggregationManager manager, SubjectContext subjectContext)
      throws Exception {
    try (Response response = manager.aggregate(baseRequest(), subjectContext)) {
      assertEquals(200, response.getStatus());
    }
  }

  private SubjectContext domainScopedSubject(boolean isAdmin) {
    User user = mock(User.class);
    EntityReference userReference = mock(EntityReference.class);
    when(userReference.getId()).thenReturn(UUID.randomUUID());
    when(user.getEntityReference()).thenReturn(userReference);
    when(user.getId()).thenReturn(UUID.randomUUID());
    when(user.getName()).thenReturn("analyst");
    EntityReference domainRef = new EntityReference().withId(DOMAIN_ID).withType(Entity.DOMAIN);
    when(user.getDomains()).thenReturn(List.of(domainRef));

    SubjectContext.PolicyContext policyContext = mock(SubjectContext.PolicyContext.class);
    when(policyContext.getPolicyName()).thenReturn("DomainAccessPolicy");
    CompiledRule deny = denyRule(List.of("All"), "!hasDomain()");
    CompiledRule allow = allowRule(List.of("All"), "hasDomain()");
    when(policyContext.getRules()).thenReturn(List.of(deny, allow));

    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.isAdmin()).thenReturn(isAdmin);
    when(subjectContext.isBot()).thenReturn(false);
    when(subjectContext.user()).thenReturn(user);
    when(subjectContext.getPolicies(any())).thenReturn(List.of(policyContext).iterator());
    return subjectContext;
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

  private static JsonNode json(SearchRequest request) throws Exception {
    return JsonUtils.readTree(request.toJsonString());
  }
}
