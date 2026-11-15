package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;

class PrivateFieldReferencesTest {

  @Test
  void emailFieldsAndPatternsThatMatchThemArePrivate() {
    for (String field :
        List.of("email", "email.keyword", "Email", "email^5", "email*", "em*", "*", "*.keyword")) {
      assertTrue(PrivateFieldReferences.isPrivateField(field), field);
    }
    for (String field : List.of("name", "name.keyword", "displayName*", "columns.name", "")) {
      assertFalse(PrivateFieldReferences.isPrivateField(field), field);
    }
    assertFalse(PrivateFieldReferences.isPrivateField(null));
  }

  @Test
  void aLuceneQueryNamesTheTermBeforeEachColonOutsideQuotesAndRegexps() {
    assertEquals(
        List.of("email.keyword"), PrivateFieldReferences.luceneFieldNames("email.keyword:j*"));
    assertEquals(
        List.of("name", "email"),
        PrivateFieldReferences.luceneFieldNames("name:jane AND -email : \"x\""));
    assertEquals(
        List.of("_exists_", "email"), PrivateFieldReferences.luceneFieldNames("_exists_:email"));
    assertEquals(List.of("email*"), PrivateFieldReferences.luceneFieldNames("email\\*:j"));
    assertEquals(
        List.of("tags.tagFQN"),
        PrivateFieldReferences.luceneFieldNames("tags.tagFQN:\"PII.Email\""));
    assertEquals(
        List.of("description"),
        PrivateFieldReferences.luceneFieldNames("description:/email:.*/ \"email: x\""));
    assertEquals(List.of(), PrivateFieldReferences.luceneFieldNames("*:*"));
    assertEquals(List.of(), PrivateFieldReferences.luceneFieldNames("jane@acme.com"));
  }

  @Test
  void aLuceneFieldNameIsReadWithItsEscapesResolvedAsLuceneResolvesThem() {
    assertEquals(List.of("email"), PrivateFieldReferences.luceneFieldNames("em\\u0061il:j*"));
    assertEquals(
        List.of("email.keyword"),
        PrivateFieldReferences.luceneFieldNames("email.k\\u0065yword:j*"));
    assertEquals(
        List.of("_exists_", "email"),
        PrivateFieldReferences.luceneFieldNames("_exists_:\"\\u0065mail\""));
    assertEquals(List.of("name"), PrivateFieldReferences.luceneFieldNames("n\\a\\me:jane"));
    assertEquals(List.of("a:b"), PrivateFieldReferences.luceneFieldNames("a\\u003Ab:x"));
  }

  @Test
  void aLuceneQueryWithEscapesLuceneRefusesCountsAsNamingAPrivateField() {
    for (String query : List.of("em\\u006:j", "em\\u00zz:j", "x\\u12:y", "_exists_:\"x\\u1\"")) {
      assertTrue(PrivateFieldReferences.inLuceneQuery(query), query);
    }
  }

  @Test
  void aLuceneQueryNamesAPrivateFieldOnlyThroughAFieldReference() {
    for (String query :
        List.of(
            "email.keyword:j*",
            "email:(a OR b)",
            "+email:jane",
            "_exists_:email",
            "em\\*:jane",
            "em\\u0061il:j*",
            "\\u0045MAIL.keyword:j*",
            "*:jane@acme.com",
            "name:x OR email.keyword:/j.*/")) {
      assertTrue(PrivateFieldReferences.inLuceneQuery(query), query);
    }
    for (String query :
        List.of(
            "jane@acme.com",
            "email",
            "@timestamp",
            "*",
            "*:*",
            "tags.tagFQN:\"PII.Email\"",
            "columnNames:email",
            "x-email:jane")) {
      assertFalse(PrivateFieldReferences.inLuceneQuery(query), query);
    }
  }

  @Test
  void queryDslNamesAPrivateFieldByKeyParameterScriptOrEveryField() {
    for (String dsl :
        List.of(
            "{\"query\":{\"prefix\":{\"email.keyword\":\"j\"}}}",
            "{\"bool\":{\"should\":[{\"wildcard\":{\"email\":{\"value\":\"j*\"}}}]}}",
            "{\"exists\":{\"field\":\"email\"}}",
            "{\"multi_match\":{\"query\":\"jane\",\"fields\":[\"name\",\"em*^2\"]}}",
            "{\"query_string\":{\"query\":\"jane@acme.com\"}}",
            "{\"query_string\":{\"query\":\"email:j*\",\"fields\":[\"name\"]}}",
            "{\"query_string\":{\"query\":\"em\\\\u0061il:j*\",\"fields\":[\"name\"]}}",
            "{\"simple_query_string\":{\"query\":\"jane\",\"fields\":[]}}",
            "{\"script\":{\"script\":\"doc['email.keyword'].value.startsWith('j')\"}}",
            "{\"script\":{\"script\":\"doc['e' + 'mail.keyword'].value.startsWith('j')\"}}",
            "{\"function_score\":{\"functions\":[{\"script_score\":{\"script\":{"
                + "\"source\":\"doc[params.a + params.b].value.length()\","
                + "\"params\":{\"a\":\"em\",\"b\":\"ail\"}}}}]}}",
            "{\"wrapper\":{\"query\":\"" + base64("{\"term\":{\"email\":\"x\"}}") + "\"}}",
            "{\"wrapper\":{\"query\":\"not base64!\"}}",
            "{\"bool\":{\"must\":{\"prefix\":{\"email.keyword\":\"j\"}},"
                + "\"must\":{\"match_all\":{}}}}",
            "{\"match_all\":{}} {\"term\":{\"email\":\"x\"}}",
            "not json")) {
      assertTrue(PrivateFieldReferences.inQueryDsl(dsl), dsl);
    }
    for (String dsl :
        List.of(
            "{\"query\":{\"term\":{\"columns.name.keyword\":\"email\"}}}",
            "{\"term\":{\"tags.tagFQN\":\"PII.Email\"}}",
            "{\"bool\":{\"must\":[{\"term\":{\"isBot\":false}}]}}",
            "{\"query_string\":{\"query\":\"jane\",\"fields\":[\"name\",\"displayName\"]}}",
            "{\"wrapper\":{\"query\":\"" + base64("{\"term\":{\"name\":\"email\"}}") + "\"}}",
            "")) {
      assertFalse(PrivateFieldReferences.inQueryDsl(dsl), dsl);
    }
  }

  private static String base64(String json) {
    return Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
  }
}
