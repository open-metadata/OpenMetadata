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

package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import io.modelcontextprotocol.spec.McpSchema;
import java.security.Principal;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.entity.app.mcp.McpToolCallUsage;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Direct coverage for {@link DefaultToolContext}'s Phase 3 outcome construction. The recorder side
 * of the pipeline is covered by {@code McpUsageRecorderTest}; this file pins the classification
 * logic so a change in exception → category mapping is caught at unit-test time rather than
 * silently warping the dashboard tiles.
 */
class DefaultToolContextTest {

  @Test
  void unknownToolReturnsValidationCategory() {
    DefaultToolContext.CallToolOutcome outcome = invokeWithToolName("not_a_real_tool");

    assertThat(outcome.result().isError()).isTrue();
    assertThat(outcome.errorCategory()).isEqualTo(McpToolCallUsage.ErrorCategory.VALIDATION);
    assertThat(outcome.latencyMs()).isGreaterThanOrEqualTo(0L);
  }

  @Test
  void classifyAuthorizationExceptionAsAuth() {
    assertThat(DefaultToolContext.classifyException(new AuthorizationException("forbidden")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.AUTH);
  }

  @Test
  void classifyWrappedAuthorizationExceptionAsAuth() {
    RuntimeException wrapped =
        new RuntimeException("tool failed", new AuthorizationException("forbidden"));

    assertThat(DefaultToolContext.classifyException(wrapped))
        .isEqualTo(McpToolCallUsage.ErrorCategory.AUTH);
  }

  @Test
  void classifyAuthMessagePatternsAsAuth() {
    assertThat(DefaultToolContext.classifyException(new RuntimeException("Permission denied")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.AUTH);
    assertThat(DefaultToolContext.classifyException(new RuntimeException("Unauthorized access")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.AUTH);
    assertThat(DefaultToolContext.classifyException(new RuntimeException("Access denied for user")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.AUTH);
  }

  @Test
  void classifyValidationException() {
    assertThat(DefaultToolContext.classifyException(new IllegalArgumentException("bad arg")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.VALIDATION);
    assertThat(DefaultToolContext.classifyException(new RuntimeException("invalid argument: foo")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.VALIDATION);
  }

  @Test
  void classifyTimeoutException() {
    assertThat(DefaultToolContext.classifyException(new RuntimeException("connection timed out")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.TIMEOUT);
    assertThat(DefaultToolContext.classifyException(new RuntimeException("request timeout")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.TIMEOUT);
  }

  @Test
  void classifyRateLimitException() {
    assertThat(DefaultToolContext.classifyException(new RuntimeException("rate limit exceeded")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.RATE_LIMIT);
  }

  @Test
  void classifyFallsBackToInternalForUnknownException() {
    assertThat(DefaultToolContext.classifyException(new RuntimeException("kaboom")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.INTERNAL);
  }

  @Test
  void classifyWalksCauseChain() {
    RuntimeException root = new RuntimeException("connection timed out");
    RuntimeException wrapped = new RuntimeException("upstream failure", root);
    RuntimeException outermost = new RuntimeException("tool wrapper failed", wrapped);

    assertThat(DefaultToolContext.classifyException(outermost))
        .isEqualTo(McpToolCallUsage.ErrorCategory.TIMEOUT);
  }

  @Test
  void classifyHandlesNullMessageOnIntermediateCause() {
    RuntimeException root = new RuntimeException("rate limit hit");
    RuntimeException middle = new RuntimeException((String) null, root);

    assertThat(DefaultToolContext.classifyException(middle))
        .isEqualTo(McpToolCallUsage.ErrorCategory.RATE_LIMIT);
  }

  @Test
  void resolveStatusCodeMapsNotFoundTo404() {
    assertThat(
            DefaultToolContext.resolveStatusCode(new RuntimeException("Entity not found: table x")))
        .isEqualTo(404);
  }

  @Test
  void resolveStatusCodeMapsValidationTo400() {
    assertThat(DefaultToolContext.resolveStatusCode(new IllegalArgumentException("bad arg")))
        .isEqualTo(400);
  }

  @Test
  void validationExceptionWithNotFoundMessageStaysA400() {
    assertThat(
            DefaultToolContext.resolveStatusCode(
                new IllegalArgumentException("parameter not found")))
        .isEqualTo(400);
    assertThat(
            DefaultToolContext.classifyException(new IllegalArgumentException("field not found")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.VALIDATION);
  }

  @Test
  void resolveStatusCodeMapsAuthTo403() {
    assertThat(DefaultToolContext.resolveStatusCode(new AuthorizationException("forbidden")))
        .isEqualTo(403);
  }

  @Test
  void resolveStatusCodeMapsRateLimitTo429() {
    assertThat(DefaultToolContext.resolveStatusCode(new RuntimeException("rate limit exceeded")))
        .isEqualTo(429);
  }

  @Test
  void resolveStatusCodeMapsTimeoutTo504() {
    assertThat(DefaultToolContext.resolveStatusCode(new RuntimeException("connection timed out")))
        .isEqualTo(504);
  }

  @Test
  void resolveStatusCodeFallsBackTo500() {
    assertThat(DefaultToolContext.resolveStatusCode(new RuntimeException("kaboom"))).isEqualTo(500);
  }

  @Test
  void resolveStatusCodeWalksCauseChain() {
    RuntimeException root = new RuntimeException("Entity not found: table x");
    RuntimeException wrapped = new RuntimeException("tool wrapper failed", root);

    assertThat(DefaultToolContext.resolveStatusCode(wrapped)).isEqualTo(404);
  }

  @Test
  void resolveStatusCodeTerminatesOnCyclicCauseChain() {
    RuntimeException a = new RuntimeException("kaboom");
    RuntimeException b = new RuntimeException("boom", a);
    a.initCause(b);

    assertThat(DefaultToolContext.resolveStatusCode(a)).isEqualTo(500);
    assertThat(DefaultToolContext.classifyException(a))
        .isEqualTo(McpToolCallUsage.ErrorCategory.INTERNAL);
  }

  @Test
  void notFoundStillBucketsAsValidationCategory() {
    assertThat(DefaultToolContext.classifyException(new RuntimeException("Entity not found: x")))
        .isEqualTo(McpToolCallUsage.ErrorCategory.VALIDATION);
  }

  @Test
  void serializeWithinBudgetPassesSmallResultThrough() {
    Map<String, Object> result = Map.of("fqn", "svc.db.orders", "status", "success");

    String serialized = DefaultToolContext.serializeWithinBudget(result, "root_cause_analysis");

    assertThat(serialized).contains("svc.db.orders").doesNotContain("truncated");
  }

  @Test
  void serializeWithinBudgetReplacesOversizedResultWithEnvelope() {
    Map<String, Object> result =
        Map.of("blob", "z".repeat(McpResponseTrim.MAX_RESPONSE_CHARS + 1), "tool", "ignored");

    String serialized = DefaultToolContext.serializeWithinBudget(result, "get_entity_details");

    assertThat(serialized)
        .contains("\"truncated\":true")
        .contains("\"tool\":\"get_entity_details\"")
        .contains("\"maxResponseChars\":" + McpResponseTrim.MAX_RESPONSE_CHARS)
        .doesNotContain("zzzz");
  }

  private static DefaultToolContext.CallToolOutcome invokeWithToolName(String toolName) {
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    Principal principal = mock(Principal.class);
    org.mockito.Mockito.when(principal.getName()).thenReturn("alice");
    org.mockito.Mockito.when(securityContext.getUserPrincipal()).thenReturn(principal);

    McpSchema.CallToolRequest request = mock(McpSchema.CallToolRequest.class);
    org.mockito.Mockito.when(request.arguments()).thenReturn(Map.of());

    return new DefaultToolContext()
        .callToolWithMetadata(
            mock(Authorizer.class), mock(Limits.class), toolName, securityContext, request);
  }
}
