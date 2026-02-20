/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
class RestUtilTest extends OpenMetadataApplicationTest {
  @Test
  void hrefTests() throws URISyntaxException {
    OpenMetadataBaseUrlConfiguration urlConfiguration =
        SettingsCache.getSetting(
            SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION,
            OpenMetadataBaseUrlConfiguration.class);

    UriInfo uriInfo = mockUriInfo(urlConfiguration.getOpenMetadataUrl());
    OpenMetadataApplicationConfig config = OpenMetadataApplicationConfigHolder.getInstance();
    String apiPath = config.getApiRootPath();
    apiPath =
        apiPath != null && apiPath.endsWith("/")
            ? apiPath.substring(0, apiPath.length() - 1)
            : apiPath;
    String omUrl = urlConfiguration.getOpenMetadataUrl();
    omUrl = omUrl != null && omUrl.endsWith("/") ? omUrl.substring(0, omUrl.length() - 1) : omUrl;
    String baseUrl = omUrl + apiPath;

    assertEquals(
        URI.create(String.format("%s/%s", baseUrl, "collection")),
        RestUtil.getHref(uriInfo, "collection"));
    assertEquals(
        URI.create(String.format("%s/%s", baseUrl, "collection")),
        RestUtil.getHref(uriInfo, "/collection"));
    assertEquals(
        URI.create(String.format("%s/%s", baseUrl, "collection")),
        RestUtil.getHref(uriInfo, "collection/"));
    assertEquals(
        URI.create(String.format("%s/%s", baseUrl, "collection")),
        RestUtil.getHref(uriInfo, "/collection/"));

    UUID id = UUID.randomUUID();
    assertEquals(
        URI.create(String.format("%s/%s/%s", baseUrl, "collection", id)),
        RestUtil.getHref(uriInfo, "collection", id));
    assertEquals(
        URI.create(String.format("%s/%s/%s", baseUrl, "collection", id)),
        RestUtil.getHref(uriInfo, "/collection", id));
    assertEquals(
        URI.create(String.format("%s/%s/%s", baseUrl, "collection", id)),
        RestUtil.getHref(uriInfo, "collection/", id));
    assertEquals(
        URI.create(String.format("%s/%s/%s", baseUrl, "collection", id)),
        RestUtil.getHref(uriInfo, "/collection/", id));
  }

  private UriInfo mockUriInfo(String uri) throws URISyntaxException {
    UriInfo uriInfo = Mockito.mock(UriInfo.class);
    URI uriObject = new URI(uri);
    Mockito.when(uriInfo.getBaseUri()).thenReturn(uriObject);
    return uriInfo;
  }

  @Test
  void testNormalizeQuotes_leftDoubleQuote() {
    String input = "\u201ctest";
    assertEquals("\"test", RestUtil.normalizeQuotes(input));
  }

  @Test
  void testNormalizeQuotes_rightDoubleQuote() {
    String input = "test\u201d";
    assertEquals("test\"", RestUtil.normalizeQuotes(input));
  }

  @Test
  void testNormalizeQuotes_leftSingleQuote() {
    String input = "\u2018test";
    assertEquals("'test", RestUtil.normalizeQuotes(input));
  }

  @Test
  void testNormalizeQuotes_rightSingleQuote() {
    String input = "test\u2019";
    assertEquals("test'", RestUtil.normalizeQuotes(input));
  }

  @Test
  void testNormalizeQuotes_mixedQuotes() {
    String input = "\u201cHello\u201d and \u2018World\u2019";
    assertEquals("\"Hello\" and 'World'", RestUtil.normalizeQuotes(input));
  }

  @Test
  void testNormalizeQuotes_jsonWithSmartQuotes() {
    String input = "{\u201cname\u201d:\u201ccolumnCount\u201d,\u201cvalue\u201d:\u201c5\u201d}";
    assertEquals("{\"name\":\"columnCount\",\"value\":\"5\"}", RestUtil.normalizeQuotes(input));
  }

  @Test
  void testNormalizeQuotes_noQuotes() {
    String input = "plain text without quotes";
    assertEquals("plain text without quotes", RestUtil.normalizeQuotes(input));
  }

  @Test
  void testNormalizeQuotes_emptyString() {
    assertEquals("", RestUtil.normalizeQuotes(""));
  }

  @Test
  void testNormalizeQuotes_alreadyNormalQuotes() {
    String input = "{\"name\":\"value\"}";
    assertEquals("{\"name\":\"value\"}", RestUtil.normalizeQuotes(input));
  }

  @Test
  void testFindMatchingBrace_simpleObject() {
    String input = "{\"name\":\"value\"}";
    assertEquals(15, RestUtil.findMatchingBrace(input, 0));
  }

  @Test
  void testFindMatchingBrace_nestedObject() {
    String input = "{\"outer\":{\"inner\":\"value\"}}";
    assertEquals(26, RestUtil.findMatchingBrace(input, 0));
  }

  @Test
  void testFindMatchingBrace_bracesInsideString() {
    String input = "{\"value\":\"contains { and } braces\"}";
    assertEquals(34, RestUtil.findMatchingBrace(input, 0));
  }

  @Test
  void testFindMatchingBrace_escapedQuotesInString() {
    String input = "{\"value\":\"has \\\"escaped\\\" quotes\"}";
    assertEquals(33, RestUtil.findMatchingBrace(input, 0));
  }

  @Test
  void testFindMatchingBrace_noClosingBrace() {
    String input = "{\"incomplete\":\"object\"";
    assertEquals(-1, RestUtil.findMatchingBrace(input, 0));
  }

  @Test
  void testFindMatchingBrace_startFromMiddle() {
    String input = "prefix{\"name\":\"value\"}suffix";
    assertEquals(21, RestUtil.findMatchingBrace(input, 6));
  }

  @Test
  void testExtractJsonObjects_singleObject() {
    String input = "{\"name\":\"value\"}";
    List<String> result = RestUtil.extractJsonObjects(input);
    assertEquals(1, result.size());
    assertEquals("{\"name\":\"value\"}", result.get(0));
  }

  @Test
  void testExtractJsonObjects_multipleObjectsCommaDelimited() {
    String input = "{\"name\":\"a\"},{\"name\":\"b\"}";
    List<String> result = RestUtil.extractJsonObjects(input);
    assertEquals(2, result.size());
    assertEquals("{\"name\":\"a\"}", result.get(0));
    assertEquals("{\"name\":\"b\"}", result.get(1));
  }

  @Test
  void testExtractJsonObjects_multipleObjectsSemicolonDelimited() {
    String input = "{\"name\":\"a\"};{\"name\":\"b\"}";
    List<String> result = RestUtil.extractJsonObjects(input);
    assertEquals(2, result.size());
    assertEquals("{\"name\":\"a\"}", result.get(0));
    assertEquals("{\"name\":\"b\"}", result.get(1));
  }

  @Test
  void testExtractJsonObjects_valueContainsSemicolon() {
    String input = "{\"sql\":\"SELECT * FROM t WHERE x > 0;\"},{\"name\":\"b\"}";
    List<String> result = RestUtil.extractJsonObjects(input);
    assertEquals(2, result.size());
    assertEquals("{\"sql\":\"SELECT * FROM t WHERE x > 0;\"}", result.get(0));
    assertEquals("{\"name\":\"b\"}", result.get(1));
  }

  @Test
  void testExtractJsonObjects_valueContainsNewlines() {
    String input = "{\"sql\":\"SELECT\\ncustomer_id\\nFROM DUAL\"},{\"name\":\"b\"}";
    List<String> result = RestUtil.extractJsonObjects(input);
    assertEquals(2, result.size());
    assertEquals("{\"sql\":\"SELECT\\ncustomer_id\\nFROM DUAL\"}", result.get(0));
    assertEquals("{\"name\":\"b\"}", result.get(1));
  }

  @Test
  void testExtractJsonObjects_valueContainsBraces() {
    String input = "{\"value\":\"contains { and } braces\"},{\"name\":\"b\"}";
    List<String> result = RestUtil.extractJsonObjects(input);
    assertEquals(2, result.size());
    assertEquals("{\"value\":\"contains { and } braces\"}", result.get(0));
    assertEquals("{\"name\":\"b\"}", result.get(1));
  }

  @Test
  void testExtractJsonObjects_emptyString() {
    List<String> result = RestUtil.extractJsonObjects("");
    assertTrue(result.isEmpty());
  }

  @Test
  void testExtractJsonObjects_noJsonObjects() {
    List<String> result = RestUtil.extractJsonObjects("plain text");
    assertTrue(result.isEmpty());
  }

  @Test
  void testExtractJsonObjects_prefixAndSuffix() {
    String input = "prefix {\"name\":\"value\"} suffix";
    List<String> result = RestUtil.extractJsonObjects(input);
    assertEquals(1, result.size());
    assertEquals("{\"name\":\"value\"}", result.get(0));
  }

  @Test
  void testExtractJsonObjects_nestedObjects() {
    String input = "{\"outer\":{\"inner\":\"value\"}},{\"name\":\"b\"}";
    List<String> result = RestUtil.extractJsonObjects(input);
    assertEquals(2, result.size());
    assertEquals("{\"outer\":{\"inner\":\"value\"}}", result.get(0));
    assertEquals("{\"name\":\"b\"}", result.get(1));
  }

  @Test
  void testExtractJsonObjects_realWorldSqlExample() {
    String input =
        "{\"name\":\"sqlExpression\",\"value\":\"SELECT customer_id FROM DUAL WHERE lifetime_value < 0;\"},"
            + "{\"name\":\"threshold\",\"value\":\"10\"}";
    List<String> result = RestUtil.extractJsonObjects(input);
    assertEquals(2, result.size());
    assertEquals(
        "{\"name\":\"sqlExpression\",\"value\":\"SELECT customer_id FROM DUAL WHERE lifetime_value < 0;\"}",
        result.get(0));
    assertEquals("{\"name\":\"threshold\",\"value\":\"10\"}", result.get(1));
  }
}
