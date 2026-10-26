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

package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;

class MaskedFieldsTest {

  @Test
  void aUsersAuthenticationMechanismIsSecretAsAWhole() {
    assertEquals(List.of("authenticationMechanism"), MaskedFields.wholeFieldsOf(User.class));
  }

  // A service keeps its connection in history: its resource masks the secrets inside per caller.
  @Test
  void aServiceConnectionOnlyHoldsSecretsInside() {
    assertEquals(List.of(), MaskedFields.wholeFieldsOf(DatabaseService.class));
    assertTrue(MaskedFields.anyIn(DatabaseService.class));
  }

  @Test
  void anEntityWithoutSecretsHasNone() {
    assertFalse(MaskedFields.anyIn(Table.class));
    assertEquals(List.of(), MaskedFields.wholeFieldsOf(Table.class));
  }
}
