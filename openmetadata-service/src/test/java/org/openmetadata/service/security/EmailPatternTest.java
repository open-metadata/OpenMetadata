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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.regex.Pattern;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.teams.CreateUser;

/** The email pattern was rewritten to match in linear time; it accepts the same addresses. */
class EmailPatternTest {
  private static final Pattern EARLIER_SCHEMA_PATTERN =
      Pattern.compile("^[\\S.!#$%&’*+/=?^_`{|}~-]+@\\S+\\.\\S+$");

  @ParameterizedTest
  @ValueSource(
      strings = {
        "jane@example.com",
        "jane.doe+tag@sub.example.co.uk",
        "o'brien@example.ie",
        "zoë@example.de",
        "admin/x@example.com",
        "a@b@c.d",
        "@@x.y",
        "a@b.c.d",
        "jane",
        "jane@example",
        "jane@.com",
        "@example.com",
        "jane@example.",
        " jane@example.com",
        "jane@exa mple.com",
        "jane @example.com",
        "jane@example.com "
      })
  void theSchemaPatternAndIsValidEmailAcceptWhatTheEarlierPatternAccepted(String candidate)
      throws Exception {
    boolean earlier = EARLIER_SCHEMA_PATTERN.matcher(candidate).matches();

    assertEquals(earlier, Pattern.compile(schemaPattern()).matcher(candidate).matches(), candidate);
    assertEquals(earlier, SecurityUtil.isValidEmail(candidate), candidate);
  }

  private static String schemaPattern() throws NoSuchFieldException {
    return CreateUser.class
        .getDeclaredField("email")
        .getAnnotation(jakarta.validation.constraints.Pattern.class)
        .regexp();
  }
}
