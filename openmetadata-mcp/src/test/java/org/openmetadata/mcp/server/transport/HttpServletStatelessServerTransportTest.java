/*
 *  Copyright 2025 Collate
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
package org.openmetadata.mcp.server.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.StringWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HttpServletStatelessServerTransportTest {

  private static final String JSON_RESPONSE = "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}";

  private HttpServletResponse response;
  private StringWriter body;

  @BeforeEach
  void setUp() throws Exception {
    response = mock(HttpServletResponse.class);
    body = new StringWriter();
    when(response.getWriter()).thenReturn(new PrintWriter(body));
  }

  @Test
  void writeJsonResponse_setsContentTypeAndStatus() throws Exception {
    HttpServletStatelessServerTransport.writeJsonResponse(response, JSON_RESPONSE);

    verify(response).setContentType(HttpServletStatelessServerTransport.APPLICATION_JSON);
    verify(response).setCharacterEncoding(HttpServletStatelessServerTransport.UTF_8);
    verify(response).setStatus(HttpServletResponse.SC_OK);
    assertThat(body.toString()).isEqualTo(JSON_RESPONSE);
  }

  @Test
  void writeSseResponse_emitsSingleSseEvent() throws Exception {
    HttpServletStatelessServerTransport.writeSseResponse(response, JSON_RESPONSE);

    verify(response).setContentType(HttpServletStatelessServerTransport.TEXT_EVENT_STREAM);
    verify(response).setCharacterEncoding(HttpServletStatelessServerTransport.UTF_8);
    verify(response).setStatus(HttpServletResponse.SC_OK);
    assertThat(body.toString()).isEqualTo("data: " + JSON_RESPONSE + "\n\n");
  }

  @Test
  void writeSseResponse_setsStreamingHeaders() throws Exception {
    HttpServletStatelessServerTransport.writeSseResponse(response, JSON_RESPONSE);

    verify(response)
        .setHeader(
            HttpServletStatelessServerTransport.HEADER_CACHE_CONTROL,
            HttpServletStatelessServerTransport.CACHE_CONTROL_NO_CACHE);
    verify(response)
        .setHeader(
            HttpServletStatelessServerTransport.HEADER_CONNECTION,
            HttpServletStatelessServerTransport.CONNECTION_KEEP_ALIVE);
    verify(response)
        .setHeader(
            HttpServletStatelessServerTransport.HEADER_X_ACCEL_BUFFERING,
            HttpServletStatelessServerTransport.X_ACCEL_BUFFERING_NO);
  }

  @Test
  void writeSseResponse_payloadWithNewlines_prefixesEachLine() throws Exception {
    String multiLineJson = "{\n  \"jsonrpc\": \"2.0\"\n}";

    HttpServletStatelessServerTransport.writeSseResponse(response, multiLineJson);

    assertThat(body.toString()).isEqualTo("data: {\ndata:   \"jsonrpc\": \"2.0\"\ndata: }\n\n");
  }

  @Test
  void writeSseResponse_payloadWithCarriageReturnLineFeed_prefixesEachLine() throws Exception {
    String windowsJson = "{\r\n  \"x\": 1\r\n}";

    HttpServletStatelessServerTransport.writeSseResponse(response, windowsJson);

    assertThat(body.toString()).isEqualTo("data: {\ndata:   \"x\": 1\ndata: }\n\n");
  }

  @Test
  void writeJsonResponse_doesNotSetStreamingHeaders() throws Exception {
    HttpServletStatelessServerTransport.writeJsonResponse(response, JSON_RESPONSE);

    verify(response, org.mockito.Mockito.never()).setHeader(anyString(), anyString());
  }

  @Test
  void writeSseResponse_doesNotCallSendError() throws Exception {
    HttpServletStatelessServerTransport.writeSseResponse(response, JSON_RESPONSE);

    verify(response, org.mockito.Mockito.never()).sendError(anyInt());
    verify(response, org.mockito.Mockito.never()).sendError(anyInt(), anyString());
  }

  @Test
  void writeSseResponse_payloadStartsWithDataPrefix_perSseSpec() throws Exception {
    HttpServletStatelessServerTransport.writeSseResponse(response, JSON_RESPONSE);

    String written = body.toString();
    assertThat(written).startsWith("data: ");
    assertThat(written).endsWith("\n\n");
  }

  @Test
  void responseFlush_writerOnly() {
    verifyNoInteractions(response);
  }

  @Test
  void shouldEmitSse_acceptsBoth_prefersJson() {
    assertThat(HttpServletStatelessServerTransport.shouldEmitSse(true, true)).isFalse();
  }

  @Test
  void shouldEmitSse_acceptsJsonOnly_emitsJson() {
    assertThat(HttpServletStatelessServerTransport.shouldEmitSse(true, false)).isFalse();
  }

  @Test
  void shouldEmitSse_acceptsSseOnly_emitsSse() {
    assertThat(HttpServletStatelessServerTransport.shouldEmitSse(false, true)).isTrue();
  }
}
