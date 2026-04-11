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

package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.CspNonceHandler;

class IndexResourceTest {
  private IndexResource resource;
  private OpenMetadataApplicationConfig config;

  @BeforeEach
  void setUp() {
    resource = new IndexResource();
    config = mock(OpenMetadataApplicationConfig.class);
    when(config.getBasePath()).thenReturn("/");
  }

  @Test
  void testStaticGetIndexFileWithBasePath() {
    String html = IndexResource.getIndexFile("/custom-base/");
    assertNotNull(html, "HTML should not be null");
    assertTrue(
        html.contains("window.BASE_PATH = '/custom-base/'"),
        "HTML should contain custom base path");
    assertTrue(
        html.contains("${cspNonce}"), "Static method should not replace cspNonce placeholder");
  }

  @Test
  void testStaticGetIndexFileWithNonce() {
    String testNonce = "testNonce123ABC==";
    String html = IndexResource.getIndexFile("/", testNonce);

    assertNotNull(html, "HTML should not be null");
    assertFalse(html.contains("${cspNonce}"), "HTML should not contain cspNonce placeholder");
    assertTrue(
        html.contains("nonce=\"" + testNonce + "\""), "HTML should contain actual nonce value");

    Pattern noncePattern = Pattern.compile("nonce=\"([^\"]+)\"");
    Matcher matcher = noncePattern.matcher(html);

    int nonceCount = 0;
    while (matcher.find()) {
      assertEquals(testNonce, matcher.group(1), "All nonce attributes should have the same value");
      nonceCount++;
    }

    assertTrue(nonceCount >= 3, "HTML should have at least 3 inline scripts with nonce attributes");
  }

  @Test
  void testGetIndexWithRequest() {
    resource.initialize(config);

    HttpServletRequest mockRequest = mock(HttpServletRequest.class);
    String testNonce = Base64.getEncoder().encodeToString("test-nonce-bytes".getBytes());
    when(mockRequest.getAttribute(CspNonceHandler.CSP_NONCE_ATTRIBUTE)).thenReturn(testNonce);

    Response response = resource.getIndex(mockRequest);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be 200");

    String html = (String) response.getEntity();
    assertNotNull(html, "HTML content should not be null");
    assertFalse(html.contains("${cspNonce}"), "HTML should not contain placeholder");
    assertTrue(
        html.contains("nonce=\"" + testNonce + "\""), "HTML should contain nonce from request");
    assertTrue(html.contains("window.BASE_PATH = '/'"), "HTML should contain configured base path");
  }

  @Test
  void testGetIndexWithNullNonce() {
    resource.initialize(config);

    HttpServletRequest mockRequest = mock(HttpServletRequest.class);
    when(mockRequest.getAttribute(CspNonceHandler.CSP_NONCE_ATTRIBUTE)).thenReturn(null);

    Response response = resource.getIndex(mockRequest);

    String html = (String) response.getEntity();
    assertNotNull(html);
    assertTrue(html.contains("${cspNonce}"), "HTML should keep placeholder when nonce is null");
  }

  @Test
  void testGetIndexWithEmptyNonce() {
    resource.initialize(config);

    HttpServletRequest mockRequest = mock(HttpServletRequest.class);
    when(mockRequest.getAttribute(CspNonceHandler.CSP_NONCE_ATTRIBUTE)).thenReturn("");

    Response response = resource.getIndex(mockRequest);

    String html = (String) response.getEntity();
    assertNotNull(html);
    assertTrue(html.contains("${cspNonce}"), "HTML should keep placeholder when nonce is empty");
  }

  @Test
  void testNonceReplacementInAllScriptTags() {
    String testNonce = "ABC123xyz/+==";
    String html = IndexResource.getIndexFile("/", testNonce);

    assertTrue(
        html.contains("<script nonce=\"" + testNonce + "\">"), "Inline scripts should have nonce");

    assertTrue(
        html.contains("gtmScript.setAttribute('nonce', '" + testNonce + "')"),
        "Dynamically created scripts should set nonce attribute with actual value");

    assertFalse(html.contains("${cspNonce}"), "No placeholder should remain");
    assertFalse(html.contains("nonce=\"${cspNonce}\""), "No unreplaced nonce attributes");
  }

  @Test
  void testBasePathReplacement() {
    String customBasePath = "/api/v1/";
    String html = IndexResource.getIndexFile(customBasePath);

    assertTrue(html.contains("window.BASE_PATH = '" + customBasePath + "'"));
    assertTrue(html.contains("href=\"" + customBasePath + "favicon.png\""));
    assertTrue(html.contains("href=\"" + customBasePath + "favicons/"));
    assertTrue(html.contains("href=\"" + customBasePath + "manifest.json\""));
    assertTrue(html.contains("'" + customBasePath + "images/governance.png'"));

    assertFalse(html.contains("${basePath}"), "No basePath placeholder should remain");
  }

  @Test
  void testCachedHtmlPerformance() {
    String html1 = IndexResource.getIndexFile("/");
    String html2 = IndexResource.getIndexFile("/");

    assertEquals(html1, html2, "Multiple calls should return the same HTML content");
    assertNotNull(html1);
    assertFalse(html1.isEmpty(), "HTML should not be empty");
  }
}
