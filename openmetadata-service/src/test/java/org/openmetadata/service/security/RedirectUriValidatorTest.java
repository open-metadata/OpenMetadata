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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RedirectUriValidatorTest {

  private static final String TRUSTED = "https://openmetadata.example.com";
  private static final String TRUSTED_WITH_PORT = "https://openmetadata.example.com:8585";

  @Test
  void nullAndEmptyAreRejected() {
    assertFalse(RedirectUriValidator.isSafe(null, TRUSTED));
    assertFalse(RedirectUriValidator.isSafe("", TRUSTED));
  }

  @Test
  void siteRelativePathsAreAccepted() {
    assertTrue(RedirectUriValidator.isSafe("/auth/callback", TRUSTED));
    assertTrue(RedirectUriValidator.isSafe("/", TRUSTED));
  }

  @Test
  void protocolRelativeUriIsRejected() {
    assertFalse(RedirectUriValidator.isSafe("//evil.example.com/callback", TRUSTED));
  }

  @Test
  void absoluteSameOriginIsAccepted() {
    assertTrue(RedirectUriValidator.isSafe(TRUSTED + "/auth/callback", TRUSTED));
  }

  @Test
  void absoluteDifferentHostIsRejected() {
    assertFalse(RedirectUriValidator.isSafe("https://evil.example.com/cb", TRUSTED));
  }

  @Test
  void schemeMismatchIsRejected() {
    assertFalse(RedirectUriValidator.isSafe("http://openmetadata.example.com/cb", TRUSTED));
  }

  @Test
  void defaultPortMatchesOmittedPort() {
    // https default 443 equals the omitted-port form.
    assertTrue(RedirectUriValidator.isSafe("https://openmetadata.example.com:443/cb", TRUSTED));
    assertTrue(
        RedirectUriValidator.isSafe(
            "https://openmetadata.example.com/cb", "https://openmetadata.example.com:443"));
  }

  @Test
  void nonDefaultPortMismatchIsRejected() {
    assertFalse(RedirectUriValidator.isSafe("https://openmetadata.example.com:9999/cb", TRUSTED));
    assertFalse(
        RedirectUriValidator.isSafe("https://openmetadata.example.com/cb", TRUSTED_WITH_PORT));
  }

  @Test
  void javaScriptSchemeIsRejected() {
    assertFalse(RedirectUriValidator.isSafe("javascript:alert(1)", TRUSTED));
  }

  @Test
  void dataSchemeIsRejected() {
    assertFalse(RedirectUriValidator.isSafe("data:text/html,<script>alert(1)</script>", TRUSTED));
  }

  @Test
  void malformedUriIsRejected() {
    assertFalse(RedirectUriValidator.isSafe("https://:::evil", TRUSTED));
  }

  @Test
  void userInfoSpoofingIsRejected() {
    // `user@evil.com` in URI — the host is evil.com, not trusted host.
    assertFalse(
        RedirectUriValidator.isSafe("https://openmetadata.example.com@evil.com/cb", TRUSTED));
  }

  @Test
  void nullAllowlistRejectsAbsoluteUri() {
    assertFalse(RedirectUriValidator.isSafe("https://anything.example.com/cb", (String[]) null));
  }

  @Test
  void nullAllowlistStillAcceptsRelativePaths() {
    assertTrue(RedirectUriValidator.isSafe("/cb", (String[]) null));
  }

  @Test
  void emptyAllowlistRejectsAbsoluteUri() {
    assertFalse(RedirectUriValidator.isSafe("https://anything.example.com/cb", new String[0]));
  }

  @Test
  void nullEntriesInAllowlistAreIgnored() {
    assertTrue(RedirectUriValidator.isSafe(TRUSTED + "/cb", null, TRUSTED, null));
  }

  @Test
  void caseInsensitiveHostMatch() {
    assertTrue(RedirectUriValidator.isSafe("https://OpenMetadata.Example.COM/cb", TRUSTED));
  }

  @Test
  void multipleAllowedBaseUrls() {
    String frontend = "https://app.example.com";
    assertTrue(RedirectUriValidator.isSafe(frontend + "/cb", TRUSTED, frontend));
    assertTrue(RedirectUriValidator.isSafe(TRUSTED + "/cb", TRUSTED, frontend));
    assertFalse(RedirectUriValidator.isSafe("https://evil.example.com/cb", TRUSTED, frontend));
  }
}
