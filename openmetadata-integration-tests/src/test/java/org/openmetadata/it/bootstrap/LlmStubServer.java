/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.bootstrap;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * In-JVM stub of an OpenAI-compatible {@code /v1/chat/completions} endpoint, used by the embedded
 * integration-test suite to drive the Company Context knowledge-pill pipeline deterministically
 * without a real LLM provider or network egress. {@code OpenAICompletionClient} parses the stub's
 * reply exactly as it would a real OpenAI response, so the upload &rarr; text-extraction &rarr;
 * completion &rarr; pill-persistence &rarr; linking path is exercised end to end.
 *
 * <p>To keep other suite tests that process Context Center files unaffected, the stub returns the
 * canned {@link #EXPECTED_PILLS} only when the request body contains {@link #PILL_TRIGGER}; every
 * other completion request gets an empty array and therefore creates no memories.
 */
public final class LlmStubServer {
  private static final Logger LOG = LoggerFactory.getLogger(LlmStubServer.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
  private static final String CONTENT_TYPE = "Content-Type";
  private static final String APPLICATION_JSON = "application/json";

  /** Sentinel a test embeds in its uploaded file content to opt into pill generation. */
  public static final String PILL_TRIGGER = "OM-PILL-STUB-TRIGGER";

  /** A knowledge pill the stub returns, matching the server-side {@code KnowledgePill} contract. */
  public record ExpectedPill(
      String title, String question, String answer, String summary, String memoryType) {}

  public static final List<ExpectedPill> EXPECTED_PILLS =
      List.of(
          new ExpectedPill(
              "Refund Policy",
              "What is the refund policy?",
              "Customers can return any product within 30 days for a full refund.",
              "30-day full-refund window.",
              "Faq"),
          new ExpectedPill(
              "Primary Data Warehouse",
              "What is the primary data warehouse?",
              "Google BigQuery is the primary data warehouse.",
              "Primary warehouse is BigQuery.",
              "Note"),
          new ExpectedPill(
              "Support SLA",
              "What is the support team SLA?",
              "The support team responds to all tickets within 24 hours.",
              "24-hour ticket response SLA.",
              "Runbook"));

  private final HttpServer server;
  private final int port;

  private LlmStubServer(HttpServer server, int port) {
    this.server = server;
    this.port = port;
  }

  public static LlmStubServer start() {
    LlmStubServer result;
    try {
      HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
      LlmStubServer stub = new LlmStubServer(server, server.getAddress().getPort());
      server.createContext(CHAT_COMPLETIONS_PATH, stub::handleCompletion);
      server.start();
      LOG.info("LLM stub server started on {}", stub.baseUrl());
      result = stub;
    } catch (IOException e) {
      throw new IllegalStateException("Failed to start LLM stub server", e);
    }
    return result;
  }

  /** OpenAI-compatible base URL; {@code OpenAICompletionClient} appends {@code /chat/completions}. */
  public String baseUrl() {
    return "http://localhost:" + port + "/v1";
  }

  public void stop() {
    server.stop(0);
    LOG.info("LLM stub server stopped");
  }

  private void handleCompletion(HttpExchange exchange) throws IOException {
    boolean includePills = readRequest(exchange).contains(PILL_TRIGGER);
    byte[] body = completionResponse(includePills).getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add(CONTENT_TYPE, APPLICATION_JSON);
    exchange.sendResponseHeaders(200, body.length);
    try (OutputStream os = exchange.getResponseBody()) {
      os.write(body);
    }
  }

  private String readRequest(HttpExchange exchange) throws IOException {
    return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
  }

  private String completionResponse(boolean includePills) {
    String result;
    try {
      ArrayNode pills = includePills ? pillsArray() : MAPPER.createArrayNode();
      ObjectNode message = MAPPER.createObjectNode();
      message.put("role", "assistant");
      message.put("content", MAPPER.writeValueAsString(pills));
      ObjectNode envelope = MAPPER.createObjectNode();
      envelope.putArray("choices").addObject().set("message", message);
      result = MAPPER.writeValueAsString(envelope);
    } catch (IOException e) {
      throw new IllegalStateException("Failed to build LLM stub response", e);
    }
    return result;
  }

  private ArrayNode pillsArray() {
    ArrayNode pills = MAPPER.createArrayNode();
    for (ExpectedPill pill : EXPECTED_PILLS) {
      ObjectNode node = pills.addObject();
      node.put("title", pill.title());
      node.put("question", pill.question());
      node.put("answer", pill.answer());
      node.put("summary", pill.summary());
      node.put("memoryType", pill.memoryType());
    }
    return pills;
  }
}
