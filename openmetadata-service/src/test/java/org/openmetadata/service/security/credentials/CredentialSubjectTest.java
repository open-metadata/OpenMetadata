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

package org.openmetadata.service.security.credentials;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class CredentialSubjectTest {

  @Test
  void differentCasesOfOneNameAreOneSubject() {
    assertEquals(CredentialSubject.of("Alice"), CredentialSubject.of("alice"));
    assertEquals("alice", CredentialSubject.of("Alice").principal());
  }

  @Test
  void blankAndNullNamesAreRejected() {
    assertThrows(IllegalArgumentException.class, () -> CredentialSubject.of(null));
    assertThrows(IllegalArgumentException.class, () -> CredentialSubject.of(""));
    assertThrows(IllegalArgumentException.class, () -> CredentialSubject.of("  "));
  }

  @Test
  void nameHashOfAPlainName() {
    assertEquals(
        "9991e5c34686e26958aad605afc45fc6", CredentialSubject.of("ingestion-bot").nameHash());
  }

  @Test
  void nameHashOfADottedMixedCaseEmailName() {
    assertEquals(
        "a2afb710e7861a646b3bad02ded6f3d1",
        CredentialSubject.of("Jane.Doe@Example.com").nameHash());
  }
}
