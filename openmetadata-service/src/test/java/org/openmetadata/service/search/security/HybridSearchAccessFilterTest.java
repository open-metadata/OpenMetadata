package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryDsl;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryDsl;
import org.openmetadata.service.search.queries.SearchQueryDsl;
import org.openmetadata.service.search.vector.ChunkSecurityMetadata;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class HybridSearchAccessFilterTest {
  static Stream<SearchQueryDsl> engines() {
    return Stream.of(
        new ElasticQueryDsl(new es.co.elastic.clients.json.jackson.JacksonJsonpMapper()),
        new OpenSearchQueryDsl(new os.org.opensearch.client.json.jackson.JacksonJsonpMapper()));
  }

  @ParameterizedTest
  @MethodSource("engines")
  void unresolvedSubjectsFailClosedWhileAdminsAndDisabledAccessControlRemainCompatible(
      SearchQueryDsl dsl) {
    SubjectContext admin = mock(SubjectContext.class);
    when(admin.isAdmin()).thenReturn(true);
    try (var settings = mockStatic(SearchUtils.class)) {
      settings.when(SearchUtils::isAccessControlEnabled).thenReturn(true);
      assertTrue(HybridSearchAccessFilter.query(dsl, null).contains("must_not"));
      assertTrue(HybridSearchAccessFilter.query(dsl, null).contains("match_all"));
      assertNull(HybridSearchAccessFilter.query(dsl, admin));
      settings.when(SearchUtils::isAccessControlEnabled).thenReturn(false);
      assertNull(HybridSearchAccessFilter.query(dsl, null));
    }
  }

  @ParameterizedTest
  @MethodSource("engines")
  void aResourceDenyAlsoCoversThatTypesSharedIndexChunksAndGatesLegacyMetadata(SearchQueryDsl dsl) {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(anyString()))
        .thenAnswer(call -> call.getArgument(0) + "_alias");
    when(repository.getChildIndexAliases(anyString())).thenReturn(List.of());
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.user()).thenReturn(new User().withId(UUID.randomUUID()).withName("reader"));
    SubjectContext.PolicyContext policy = mock(SubjectContext.PolicyContext.class);
    when(policy.getRules())
        .thenReturn(
            List.of(
                new CompiledRule(
                    new Rule()
                        .withEffect(Rule.Effect.DENY)
                        .withResources(List.of("table"))
                        .withOperations(List.of(MetadataOperation.VIEW_ALL)))));
    when(subject.getPolicies(anyList())).thenAnswer(call -> List.of(policy).iterator());
    try (var entity = mockStatic(Entity.class);
        var settings = mockStatic(SearchUtils.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(repository);
      settings.when(SearchUtils::isAccessControlEnabled).thenReturn(true);
      String clause = HybridSearchAccessFilter.query(dsl, subject);
      assertTrue(clause.contains("must_not"), clause);
      assertTrue(clause.contains("table_alias"), clause);
      assertTrue(clause.contains("entityType") && clause.contains("parentId"), clause);
      assertTrue(clause.contains(ChunkSecurityMetadata.VERSION_FIELD), clause);
      assertTrue(clause.contains(ChunkSecurityMetadata.FINGERPRINT_FIELD), clause);
    }
  }
}
