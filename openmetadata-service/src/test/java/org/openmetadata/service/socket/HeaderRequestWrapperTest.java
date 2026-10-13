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
package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Focused unit tests for {@link HeaderRequestWrapper}'s header-override semantics. The wrapper is
 * used by {@link SocketAddressFilter} to overlay JWT/session-validated {@code UserId}/{@code
 * SessionId} on top of any client-supplied values; engine.io polling builds the socket's initial
 * headers from the multi-value {@link HttpServletRequest#getHeaders(String)} accessor and {@link
 * WebSocketManager} takes element 0 as the socket identity, so the override must win and must not
 * be preceded by client values. These guard the exact singular/multi accessor divergence that let
 * the spoofing bug go undetected (only the singular accessor was exercised).
 */
class HeaderRequestWrapperTest {

  @Test
  void getHeaders_returnsOnlyValidatedValueWhenHeaderOverridden() {
    HttpServletRequest underlying = mock(HttpServletRequest.class);
    when(underlying.getHeaders("UserId"))
        .thenReturn(enumeration("victim-uuid")); // spoofed client value must be shadowed
    HeaderRequestWrapper wrapper = new HeaderRequestWrapper(underlying);
    wrapper.addHeader("UserId", "attacker-uuid");

    List<String> values = Collections.list(wrapper.getHeaders("UserId"));

    assertEquals(List.of("attacker-uuid"), values);
    // The authoritative path must not consult the client-supplied values at all for an overridden
    // header, so a spoofed value cannot leak via super.getHeaders.
    verify(underlying, never()).getHeaders("UserId");
  }

  @Test
  void getHeaders_emptyClientSessionIdDoesNotShadowValidatedValue() {
    // Regression guard for the revalidation-bypass: client sends "SessionId:" (empty value) so
    // WebSocketManager's `sessionIdHeaders.get(0)` is "" and socketSessionIds.put is skipped. The
    // wrapper must surface only the validated non-empty session id as element 0.
    HttpServletRequest underlying = mock(HttpServletRequest.class);
    when(underlying.getHeaders("SessionId")).thenReturn(enumeration(""));
    HeaderRequestWrapper wrapper = new HeaderRequestWrapper(underlying);
    wrapper.addHeader("SessionId", "attacker-session-id");

    List<String> values = Collections.list(wrapper.getHeaders("SessionId"));

    assertEquals(List.of("attacker-session-id"), values);
    assertFalse(values.contains(""));
  }

  @Test
  void getHeaders_DelegatesToSuperWhenHeaderNotOverridden() {
    HttpServletRequest underlying = mock(HttpServletRequest.class);
    when(underlying.getHeaders("X-Unmodified")).thenReturn(enumeration("a", "b"));
    HeaderRequestWrapper wrapper = new HeaderRequestWrapper(underlying);

    List<String> values = Collections.list(wrapper.getHeaders("X-Unmodified"));

    assertEquals(List.of("a", "b"), values);
  }

  @Test
  void getHeaders_singularAndMultiAccessorsAgreeOnOverriddenValue() {
    // The bug went undetected because getHeader (singular) returned the validated value while
    // getHeaders (multi) returned the client value first. Both accessors must agree.
    HttpServletRequest underlying = mock(HttpServletRequest.class);
    when(underlying.getHeader("UserId")).thenReturn("victim-uuid");
    when(underlying.getHeaders("UserId")).thenReturn(enumeration("victim-uuid"));
    HeaderRequestWrapper wrapper = new HeaderRequestWrapper(underlying);
    wrapper.addHeader("UserId", "attacker-uuid");

    assertEquals("attacker-uuid", wrapper.getHeader("UserId"));
    assertEquals("attacker-uuid", wrapper.getHeaders("UserId").nextElement());
  }

  private Enumeration<String> enumeration(String... values) {
    return Collections.enumeration(List.of(values));
  }
}
