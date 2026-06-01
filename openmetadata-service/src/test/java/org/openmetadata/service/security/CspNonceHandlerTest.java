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

package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Base64;
import org.eclipse.jetty.http.HttpFields;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CspNonceHandlerTest {
  private static final String CSP_HEADER = "Content-Security-Policy";
  private static final String CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";
  private static final String CSP_PLACEHOLDER = "__CSP_NONCE__";
  private static final String CSP_POLICY_WITH_NONCE = "script-src 'self' 'nonce-__CSP_NONCE__'";

  private CspNonceHandler handler;
  private Request mockRequest;
  private Response mockResponse;
  private Callback mockCallback;
  private Handler mockWrappedHandler;

  @BeforeEach
  void setUp() {
    handler = new CspNonceHandler();
    mockRequest = mock(Request.class);
    mockResponse = mock(Response.class);
    mockCallback = mock(Callback.class);
    mockWrappedHandler = mock(Handler.class);

    HttpFields.Mutable mockHeaders = HttpFields.build();
    when(mockResponse.getHeaders()).thenReturn(mockHeaders);
    handler.setHandler(mockWrappedHandler);
  }

  @Test
  void testNonceGeneration() throws Exception {
    handler.handle(mockRequest, mockResponse, mockCallback);

    ArgumentCaptor<String> nonceCaptor = ArgumentCaptor.forClass(String.class);
    verify(mockRequest)
        .setAttribute(
            org.mockito.ArgumentMatchers.eq(CspNonceHandler.CSP_NONCE_ATTRIBUTE),
            nonceCaptor.capture());

    String nonce = nonceCaptor.getValue();
    assertNotNull(nonce, "Nonce should not be null");
    assertFalse(nonce.isEmpty(), "Nonce should not be empty");

    byte[] decoded = Base64.getDecoder().decode(nonce);
    assertEquals(16, decoded.length, "Nonce should be 16 bytes when decoded");
  }

  @Test
  void testNonceUniqueness() throws Exception {
    ArgumentCaptor<String> nonce1Captor = ArgumentCaptor.forClass(String.class);
    handler.handle(mockRequest, mockResponse, mockCallback);
    verify(mockRequest).setAttribute(any(), nonce1Captor.capture());
    String nonce1 = nonce1Captor.getValue();

    Request mockRequest2 = mock(Request.class);
    Response mockResponse2 = mock(Response.class);
    HttpFields.Mutable mockHeaders2 = HttpFields.build();
    when(mockResponse2.getHeaders()).thenReturn(mockHeaders2);
    Callback mockCallback2 = mock(Callback.class);

    ArgumentCaptor<String> nonce2Captor = ArgumentCaptor.forClass(String.class);
    handler.handle(mockRequest2, mockResponse2, mockCallback2);
    verify(mockRequest2).setAttribute(any(), nonce2Captor.capture());
    String nonce2 = nonce2Captor.getValue();

    assertFalse(
        nonce1.equals(nonce2), "Each request should generate a unique nonce (extremely unlikely)");
  }

  @Test
  void testCspHeaderReplacementOnSuccess() throws Exception {
    ArgumentCaptor<Response> responseCaptor = ArgumentCaptor.forClass(Response.class);
    when(mockWrappedHandler.handle(any(), responseCaptor.capture(), any()))
        .thenAnswer(
            invocation -> {
              Response wrappedResponse = responseCaptor.getValue();
              wrappedResponse.getHeaders().put(CSP_HEADER, CSP_POLICY_WITH_NONCE);
              return true;
            });

    handler.handle(mockRequest, mockResponse, mockCallback);

    Response wrappedResponse = responseCaptor.getValue();
    String cspHeader = wrappedResponse.getHeaders().get(CSP_HEADER);
    assertNotNull(cspHeader, "CSP header should be present");
    assertFalse(
        cspHeader.contains(CSP_PLACEHOLDER),
        "CSP header should not contain placeholder after replacement");
    assertTrue(
        cspHeader.matches("script-src 'self' 'nonce-[A-Za-z0-9+/=]+'"),
        "CSP header should contain valid base64 nonce");
  }

  @Test
  void testCspReportOnlyHeaderReplacementOnSuccess() throws Exception {
    ArgumentCaptor<Response> responseCaptor = ArgumentCaptor.forClass(Response.class);
    when(mockWrappedHandler.handle(any(), responseCaptor.capture(), any()))
        .thenAnswer(
            invocation -> {
              Response wrappedResponse = responseCaptor.getValue();
              wrappedResponse.getHeaders().put(CSP_REPORT_ONLY_HEADER, CSP_POLICY_WITH_NONCE);
              return true;
            });

    handler.handle(mockRequest, mockResponse, mockCallback);

    Response wrappedResponse = responseCaptor.getValue();
    String cspReportOnlyHeader = wrappedResponse.getHeaders().get(CSP_REPORT_ONLY_HEADER);
    assertNotNull(cspReportOnlyHeader, "CSP-Report-Only header should be present");
    assertFalse(
        cspReportOnlyHeader.contains(CSP_PLACEHOLDER),
        "CSP-Report-Only header should not contain placeholder");
    assertTrue(
        cspReportOnlyHeader.matches("script-src 'self' 'nonce-[A-Za-z0-9+/=]+'"),
        "CSP-Report-Only header should contain valid base64 nonce");
  }

  @Test
  void testBothCspHeadersReplacement() throws Exception {
    ArgumentCaptor<Response> responseCaptor = ArgumentCaptor.forClass(Response.class);
    when(mockWrappedHandler.handle(any(), responseCaptor.capture(), any()))
        .thenAnswer(
            invocation -> {
              Response wrappedResponse = responseCaptor.getValue();
              wrappedResponse.getHeaders().put(CSP_HEADER, CSP_POLICY_WITH_NONCE);
              wrappedResponse
                  .getHeaders()
                  .put(
                      CSP_REPORT_ONLY_HEADER, "default-src 'self' 'nonce-" + CSP_PLACEHOLDER + "'");
              return true;
            });

    handler.handle(mockRequest, mockResponse, mockCallback);

    Response wrappedResponse = responseCaptor.getValue();
    String cspHeader = wrappedResponse.getHeaders().get(CSP_HEADER);
    String cspReportOnlyHeader = wrappedResponse.getHeaders().get(CSP_REPORT_ONLY_HEADER);

    assertNotNull(cspHeader);
    assertNotNull(cspReportOnlyHeader);
    assertFalse(cspHeader.contains(CSP_PLACEHOLDER));
    assertFalse(cspReportOnlyHeader.contains(CSP_PLACEHOLDER));

    String noncePattern = "'nonce-([A-Za-z0-9+/=]+)'";
    assertTrue(cspHeader.matches(".*" + noncePattern + ".*"));
    assertTrue(cspReportOnlyHeader.matches(".*" + noncePattern + ".*"));

    String nonce1 = cspHeader.replaceAll(".*'nonce-([A-Za-z0-9+/=]+)'.*", "$1");
    String nonce2 = cspReportOnlyHeader.replaceAll(".*'nonce-([A-Za-z0-9+/=]+)'.*", "$1");
    assertEquals(nonce1, nonce2, "Both CSP headers should contain the same nonce");
  }

  @Test
  void testCspHeaderReplacedWhenHandlerSucceeds() throws Exception {
    ArgumentCaptor<Response> responseCaptor = ArgumentCaptor.forClass(Response.class);
    when(mockWrappedHandler.handle(any(), responseCaptor.capture(), any()))
        .thenAnswer(
            invocation -> {
              Response wrappedResponse = responseCaptor.getValue();
              wrappedResponse.getHeaders().put(CSP_HEADER, CSP_POLICY_WITH_NONCE);
              return true;
            });

    handler.handle(mockRequest, mockResponse, mockCallback);

    Response wrappedResponse = responseCaptor.getValue();
    String cspHeader = wrappedResponse.getHeaders().get(CSP_HEADER);
    assertNotNull(cspHeader);
    assertFalse(cspHeader.contains(CSP_PLACEHOLDER), "CSP placeholder should be replaced");
  }

  @Test
  void testNoCspHeader() throws Exception {
    ArgumentCaptor<Response> responseCaptor = ArgumentCaptor.forClass(Response.class);
    when(mockWrappedHandler.handle(any(), responseCaptor.capture(), any())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Response wrappedResponse = responseCaptor.getValue();
    assertEquals(
        0,
        wrappedResponse.getHeaders().size(),
        "No headers should be added if CSP header is not present");
  }

  @Test
  void testCspHeaderWithoutPlaceholder() throws Exception {
    final String cspWithoutNonce = "script-src 'self'";
    ArgumentCaptor<Response> responseCaptor = ArgumentCaptor.forClass(Response.class);
    when(mockWrappedHandler.handle(any(), responseCaptor.capture(), any()))
        .thenAnswer(
            invocation -> {
              Response wrappedResponse = responseCaptor.getValue();
              wrappedResponse.getHeaders().put(CSP_HEADER, cspWithoutNonce);
              return true;
            });

    handler.handle(mockRequest, mockResponse, mockCallback);

    Response wrappedResponse = responseCaptor.getValue();
    String cspHeader = wrappedResponse.getHeaders().get(CSP_HEADER);
    assertEquals(
        cspWithoutNonce, cspHeader, "CSP header without placeholder should remain unchanged");
  }

  @Test
  void testMultiplePlaceholdersInSameHeader() throws Exception {
    final String cspWithMultipleNonces =
        "script-src 'self' 'nonce-"
            + CSP_PLACEHOLDER
            + "'; style-src 'self' 'nonce-"
            + CSP_PLACEHOLDER
            + "'";
    ArgumentCaptor<Response> responseCaptor = ArgumentCaptor.forClass(Response.class);
    when(mockWrappedHandler.handle(any(), responseCaptor.capture(), any()))
        .thenAnswer(
            invocation -> {
              Response wrappedResponse = responseCaptor.getValue();
              wrappedResponse.getHeaders().put(CSP_HEADER, cspWithMultipleNonces);
              return true;
            });

    handler.handle(mockRequest, mockResponse, mockCallback);

    Response wrappedResponse = responseCaptor.getValue();
    String cspHeader = wrappedResponse.getHeaders().get(CSP_HEADER);
    assertNotNull(cspHeader);
    assertFalse(cspHeader.contains(CSP_PLACEHOLDER), "All placeholders should be replaced");

    long nonceCount = cspHeader.chars().filter(ch -> ch == '\'').count() / 2;
    assertEquals(
        4,
        nonceCount,
        "Should have 2 nonce values (script-src and style-src), each with opening and closing quotes");

    String nonce1Pattern = "'nonce-([A-Za-z0-9+/=]+)'";
    String nonce1 =
        cspHeader
            .substring(0, cspHeader.indexOf("style-src"))
            .replaceAll(".*" + nonce1Pattern + ".*", "$1");
    String nonce2 =
        cspHeader
            .substring(cspHeader.indexOf("style-src"))
            .replaceAll(".*" + nonce1Pattern + ".*", "$1");

    assertEquals(nonce1, nonce2, "Both placeholders should be replaced with the same nonce");
  }

  @Test
  void testCallbackForwardingOnSuccess() throws Exception {
    when(mockWrappedHandler.handle(any(), any(), any())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    verify(mockWrappedHandler).handle(any(), any(), any());
  }

  @Test
  void testCallbackForwardingOnFailure() throws Exception {
    RuntimeException testException = new RuntimeException("Test failure");
    when(mockWrappedHandler.handle(any(), any(), any())).thenThrow(testException);

    RuntimeException thrown =
        assertThrows(
            RuntimeException.class, () -> handler.handle(mockRequest, mockResponse, mockCallback));
    assertEquals(testException, thrown);
  }
}
