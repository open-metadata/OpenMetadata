package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.mockito.MockedStatic;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class PrivateSearchFieldsTest {
  private static final String USER_INDEX = "user_search_index";
  private static final String TABLE_INDEX = "table_search_index";
  private MockedStatic<Entity> entity;

  @BeforeEach
  void setUp() {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexMapping(Entity.USER))
        .thenReturn(
            IndexMapping.builder()
                .indexName(USER_INDEX)
                .alias(Entity.USER)
                .parentAliases(List.of())
                .childAliases(List.of())
                .build());
    when(repository.getIndexOrAliasName(anyString()))
        .thenAnswer(
            invocation ->
                Entity.USER.equals(invocation.getArgument(0))
                    ? USER_INDEX
                    : invocation.getArgument(0));
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(repository);
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void aSearchOfUsersThatNamesAnEmailFieldIsRefusedToCallersWhoMayNotReadEmails() {
    SubjectContext analyst = caller(false, false);
    for (SearchRequest request :
        List.of(
            search(USER_INDEX).withQuery("email.keyword:j*"),
            search(Entity.USER)
                .withQueryFilter("{\"query\":{\"prefix\":{\"email.keyword\":\"j\"}}}"),
            search(USER_INDEX).withPostFilter("{\"query_string\":{\"query\":\"jane@acme.com\"}}"),
            search(USER_INDEX).withSortFieldParam("email.keyword"),
            search("*_search_index").withQuery("email:jane*"))) {
      assertRefused(() -> PrivateSearchFields.refuseReferences(analyst, request));
    }
    assertRefused(
        () -> PrivateSearchFields.refuseFieldReference(analyst, USER_INDEX, "email.keyword"));
    assertRefused(
        () ->
            PrivateSearchFields.refuseReferences(
                analyst, aggregation(USER_INDEX).withFieldName("email.keyword")));
    assertRefused(
        () ->
            PrivateSearchFields.refuseReferences(
                analyst, aggregation(USER_INDEX).withQuery("email:j*")));
  }

  @Test
  void ordinarySearchesAdminsBotsAndOtherIndexesAreNotRefused() {
    SubjectContext analyst = caller(false, false);
    SearchRequest ordinary =
        search(USER_INDEX)
            .withQuery("jane@acme.com")
            .withQueryFilter("{\"query\":{\"term\":{\"columns.name.keyword\":\"email\"}}}")
            .withSortFieldParam("displayName.keyword");
    assertDoesNotThrow(() -> PrivateSearchFields.refuseReferences(analyst, ordinary));
    assertDoesNotThrow(
        () ->
            PrivateSearchFields.refuseReferences(
                analyst, search(TABLE_INDEX).withQuery("email.keyword:j*")));
    assertDoesNotThrow(
        () ->
            PrivateSearchFields.refuseReferences(
                analyst,
                aggregation(USER_INDEX)
                    .withQuery("{\"query\":{\"term\":{\"isBot\":false}}}")
                    .withQueryText("jane@acme.com")));
    SearchRequest emailSearch = search(USER_INDEX).withQuery("email.keyword:j*");
    for (SubjectContext reader : List.of(caller(true, false), caller(false, true))) {
      assertDoesNotThrow(() -> PrivateSearchFields.refuseReferences(reader, emailSearch));
    }
    assertDoesNotThrow(() -> PrivateSearchFields.refuseReferences(null, emailSearch));
  }

  @Test
  void hitsLeaveEmailOutOnlyForCallersWhoMayNotReadIt() {
    assertEquals(
        List.of("columns", "email"),
        PrivateSearchFields.sourceExcludes(caller(false, false), USER_INDEX, List.of("columns")));
    assertEquals(
        List.of(), PrivateSearchFields.sourceExcludes(caller(false, false), TABLE_INDEX, null));
    assertEquals(
        List.of(), PrivateSearchFields.sourceExcludes(caller(true, false), USER_INDEX, null));
    assertFalse(PrivateSearchFields.matchesPrivateFields(caller(false, false), Entity.USER));
    assertTrue(PrivateSearchFields.matchesPrivateFields(caller(false, true), Entity.USER));
  }

  @Test
  void anIndexExpressionReachesUsersByNameAliasWildcardOrAllIndexes() {
    Set<String> users = Set.of(Entity.USER, USER_INDEX);
    for (String index :
        List.of("om_user_search_index", "table_search_index,om_user", "om_*", "*", "_all", "us*")) {
      assertTrue(PrivateSearchFields.reaches(index, users, "om"), index);
    }
    for (String index :
        List.of("om_table_search_index", "om_dataAsset", "om_all", "-om_user_search_index", "")) {
      assertFalse(PrivateSearchFields.reaches(index, users, "om"), index);
    }
  }

  private static void assertRefused(Executable search) {
    SearchException refused = assertThrows(SearchException.class, search);
    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), refused.getResponse().getStatus());
  }

  private static SearchRequest search(String index) {
    return new SearchRequest().withIndex(index).withQuery("*");
  }

  private static AggregationRequest aggregation(String index) {
    return new AggregationRequest().withIndex(index).withFieldName("name.keyword");
  }

  private static SubjectContext caller(boolean admin, boolean bot) {
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.isAdmin()).thenReturn(admin);
    when(subject.isBot()).thenReturn(bot);
    return subject;
  }
}
