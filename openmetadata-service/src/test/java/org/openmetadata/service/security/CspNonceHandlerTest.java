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
  private CspNonceHandler handler;
  private Request mockRequest;
  private Response mockResponse;
  private HttpFields.Mutable mockHeaders;
  private Callback mockCallback;
  private Handler mockWrappedHandler;

  @BeforeEach
  void setUp() {
    handler = new CspNonceHandler();
    mockRequest = mock(Request.class);
    mockResponse = mock(Response.class);
    mockHeaders = HttpFields.build();
    mockCallback = mock(Callback.class);
    mockWrappedHandler = mock(Handler.class);

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
    mockHeaders.put("Content-Security-Policy", "script-src 'self' 'nonce-__CSP_NONCE__'");

    ArgumentCaptor<Callback> callbackCaptor = ArgumentCaptor.forClass(Callback.class);
    when(mockWrappedHandler.handle(any(), any(), callbackCaptor.capture())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Callback interceptedCallback = callbackCaptor.getValue();
    interceptedCallback.succeeded();

    String cspHeader = mockHeaders.get("Content-Security-Policy");
    assertNotNull(cspHeader, "CSP header should be present");
    assertFalse(
        cspHeader.contains("__CSP_NONCE__"),
        "CSP header should not contain placeholder after replacement");
    assertTrue(
        cspHeader.matches("script-src 'self' 'nonce-[A-Za-z0-9+/=]+'"),
        "CSP header should contain valid base64 nonce");
  }

  @Test
  void testCspReportOnlyHeaderReplacementOnSuccess() throws Exception {
    mockHeaders.put(
        "Content-Security-Policy-Report-Only", "script-src 'self' 'nonce-__CSP_NONCE__'");

    ArgumentCaptor<Callback> callbackCaptor = ArgumentCaptor.forClass(Callback.class);
    when(mockWrappedHandler.handle(any(), any(), callbackCaptor.capture())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Callback interceptedCallback = callbackCaptor.getValue();
    interceptedCallback.succeeded();

    String cspReportOnlyHeader = mockHeaders.get("Content-Security-Policy-Report-Only");
    assertNotNull(cspReportOnlyHeader, "CSP-Report-Only header should be present");
    assertFalse(
        cspReportOnlyHeader.contains("__CSP_NONCE__"),
        "CSP-Report-Only header should not contain placeholder");
    assertTrue(
        cspReportOnlyHeader.matches("script-src 'self' 'nonce-[A-Za-z0-9+/=]+'"),
        "CSP-Report-Only header should contain valid base64 nonce");
  }

  @Test
  void testBothCspHeadersReplacement() throws Exception {
    mockHeaders.put("Content-Security-Policy", "script-src 'self' 'nonce-__CSP_NONCE__'");
    mockHeaders.put(
        "Content-Security-Policy-Report-Only", "default-src 'self' 'nonce-__CSP_NONCE__'");

    ArgumentCaptor<Callback> callbackCaptor = ArgumentCaptor.forClass(Callback.class);
    when(mockWrappedHandler.handle(any(), any(), callbackCaptor.capture())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Callback interceptedCallback = callbackCaptor.getValue();
    interceptedCallback.succeeded();

    String cspHeader = mockHeaders.get("Content-Security-Policy");
    String cspReportOnlyHeader = mockHeaders.get("Content-Security-Policy-Report-Only");

    assertNotNull(cspHeader);
    assertNotNull(cspReportOnlyHeader);
    assertFalse(cspHeader.contains("__CSP_NONCE__"));
    assertFalse(cspReportOnlyHeader.contains("__CSP_NONCE__"));

    String noncePattern = "'nonce-([A-Za-z0-9+/=]+)'";
    assertTrue(cspHeader.matches(".*" + noncePattern + ".*"));
    assertTrue(cspReportOnlyHeader.matches(".*" + noncePattern + ".*"));

    String nonce1 = cspHeader.replaceAll(".*'nonce-([A-Za-z0-9+/=]+)'.*", "$1");
    String nonce2 = cspReportOnlyHeader.replaceAll(".*'nonce-([A-Za-z0-9+/=]+)'.*", "$1");
    assertEquals(nonce1, nonce2, "Both CSP headers should contain the same nonce");
  }

  @Test
  void testCspHeaderReplacementOnFailure() throws Exception {
    mockHeaders.put("Content-Security-Policy", "script-src 'self' 'nonce-__CSP_NONCE__'");

    ArgumentCaptor<Callback> callbackCaptor = ArgumentCaptor.forClass(Callback.class);
    when(mockWrappedHandler.handle(any(), any(), callbackCaptor.capture())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Callback interceptedCallback = callbackCaptor.getValue();
    interceptedCallback.failed(new RuntimeException("Test failure"));

    String cspHeader = mockHeaders.get("Content-Security-Policy");
    assertNotNull(cspHeader);
    assertFalse(
        cspHeader.contains("__CSP_NONCE__"), "CSP header should be replaced even on failure");
  }

  @Test
  void testNoCspHeader() throws Exception {
    ArgumentCaptor<Callback> callbackCaptor = ArgumentCaptor.forClass(Callback.class);
    when(mockWrappedHandler.handle(any(), any(), callbackCaptor.capture())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Callback interceptedCallback = callbackCaptor.getValue();
    interceptedCallback.succeeded();

    assertEquals(0, mockHeaders.size(), "No headers should be added if CSP header is not present");
  }

  @Test
  void testCspHeaderWithoutPlaceholder() throws Exception {
    mockHeaders.put("Content-Security-Policy", "script-src 'self'");

    ArgumentCaptor<Callback> callbackCaptor = ArgumentCaptor.forClass(Callback.class);
    when(mockWrappedHandler.handle(any(), any(), callbackCaptor.capture())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Callback interceptedCallback = callbackCaptor.getValue();
    interceptedCallback.succeeded();

    String cspHeader = mockHeaders.get("Content-Security-Policy");
    assertEquals(
        "script-src 'self'", cspHeader, "CSP header without placeholder should remain unchanged");
  }

  @Test
  void testMultiplePlaceholdersInSameHeader() throws Exception {
    mockHeaders.put(
        "Content-Security-Policy",
        "script-src 'self' 'nonce-__CSP_NONCE__'; style-src 'self' 'nonce-__CSP_NONCE__'");

    ArgumentCaptor<Callback> callbackCaptor = ArgumentCaptor.forClass(Callback.class);
    when(mockWrappedHandler.handle(any(), any(), callbackCaptor.capture())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Callback interceptedCallback = callbackCaptor.getValue();
    interceptedCallback.succeeded();

    String cspHeader = mockHeaders.get("Content-Security-Policy");
    assertNotNull(cspHeader);
    assertFalse(cspHeader.contains("__CSP_NONCE__"), "All placeholders should be replaced");

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
    ArgumentCaptor<Callback> callbackCaptor = ArgumentCaptor.forClass(Callback.class);
    when(mockWrappedHandler.handle(any(), any(), callbackCaptor.capture())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Callback interceptedCallback = callbackCaptor.getValue();
    interceptedCallback.succeeded();

    verify(mockCallback).succeeded();
  }

  @Test
  void testCallbackForwardingOnFailure() throws Exception {
    RuntimeException testException = new RuntimeException("Test failure");

    ArgumentCaptor<Callback> callbackCaptor = ArgumentCaptor.forClass(Callback.class);
    when(mockWrappedHandler.handle(any(), any(), callbackCaptor.capture())).thenReturn(true);

    handler.handle(mockRequest, mockResponse, mockCallback);

    Callback interceptedCallback = callbackCaptor.getValue();
    interceptedCallback.failed(testException);

    verify(mockCallback).failed(testException);
  }
}
