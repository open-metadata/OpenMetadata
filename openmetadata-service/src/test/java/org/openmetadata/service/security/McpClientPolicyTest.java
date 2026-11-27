/*
 *  Copyright 2026 Collate
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.configuration.MCPConfiguration;

class McpClientPolicyTest {
  @Test
  void registrationIsCompatibleByDefaultAndCanBeDisabled() {
    assertThat(new McpClientPolicy(null).registrationEnabled()).isTrue();
    assertThat(
            new McpClientPolicy(new MCPConfiguration().withDynamicClientRegistrationEnabled(false))
                .registrationEnabled())
        .isFalse();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "https://client.example/cb",
        "http://localhost:8765/cb",
        "http://127.0.0.1/cb",
        "http://[::1]:123/cb",
        "cursor://callback"
      })
  void preservesSupportedClients(String uri) {
    assertThatCode(() -> new McpClientPolicy(null).validateRedirect(URI.create(uri)))
        .doesNotThrowAnyException();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "ftp://example.com/cb",
        "https://user@example.com/cb",
        "https:/missing-host",
        "http://example.com/cb",
        "https://example.com/cb#fragment",
        "javascript:alert(1)",
        "https://example.com:99999/cb",
        "https://example.com:0/cb"
      })
  void rejectsUnsafeUris(String uri) {
    assertThatThrownBy(() -> new McpClientPolicy(null).validateRedirect(URI.create(uri)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void boundsInputAndRejectsNull() {
    assertThatThrownBy(() -> new McpClientPolicy(null).validateRedirect(null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () ->
                new McpClientPolicy(null)
                    .validateRedirect(URI.create("https://example.com/" + "x".repeat(2048))))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void hostPolicyUsesExactCaseInsensitiveMatching() {
    McpClientPolicy policy =
        new McpClientPolicy(
            new MCPConfiguration().withAllowedRedirectHosts(Set.of("CLIENT.example")));
    policy.validateRedirect(URI.create("https://client.example/cb"));
    for (String uri :
        List.of(
            "https://client.example.evil.test/cb",
            "https://sub.client.example/cb",
            "https://client.example./cb")) {
      assertThatThrownBy(() -> policy.validateRedirect(URI.create(uri)))
          .isInstanceOf(IllegalArgumentException.class);
    }
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "https://127.0.0.2/cb",
        "https://[0:0:0:0:0:0:0:1]/cb",
        "https://localhost./cb",
        "https://app.localhost/cb",
        "https://2130706433/cb",
        "https://0x7f000001/cb",
        "https://0177.0.0.1/cb"
      })
  void alternateLoopbackSpellingsCannotBypassPolicy(String uri) {
    var policy = new McpClientPolicy(new MCPConfiguration().withAllowLoopbackRedirects(false));
    assertThatThrownBy(() -> policy.validateRedirect(URI.create(uri)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void loopbackAndNativeAreExplicitIndependentChoices() {
    McpClientPolicy policy =
        new McpClientPolicy(
            new MCPConfiguration()
                .withAllowLoopbackRedirects(false)
                .withAllowNativeRedirects(false));
    for (String uri : List.of("http://localhost/cb", "https://localhost/cb", "cursor://callback")) {
      assertThatThrownBy(() -> policy.validateRedirect(URI.create(uri)))
          .isInstanceOf(IllegalArgumentException.class);
    }
  }
}
