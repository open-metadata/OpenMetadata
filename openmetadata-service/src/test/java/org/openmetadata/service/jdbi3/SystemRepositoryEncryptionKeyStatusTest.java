/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.schema.system.ValidationResponse;
import org.openmetadata.service.fernet.Fernet;

/** The Health Check page reports whether stored secrets use the shipped default Fernet key. */
class SystemRepositoryEncryptionKeyStatusTest {
  private static final String ENCRYPTION_KEY = "Encryption Key";
  private static final String SHIPPED_DEFAULT_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String OWN_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";

  @AfterEach
  void clearKey() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void theStatusFailsWhileTheShippedDefaultIsTheFirstKey() {
    Fernet.getInstance().setFernetKey(SHIPPED_DEFAULT_KEY);

    StepValidation entry = encryptionKeyEntry();

    assertFalse(entry.getPassed());
    assertEquals(Fernet.getInstance().getKeyWarning().orElseThrow(), entry.getMessage());
    assertNotNull(entry.getDescription());
  }

  @Test
  void theStatusPassesWithAnOwnKey() {
    Fernet.getInstance().setFernetKey(OWN_KEY + "," + SHIPPED_DEFAULT_KEY);

    StepValidation entry = encryptionKeyEntry();

    assertTrue(entry.getPassed());
    assertNotNull(entry.getMessage());
  }

  private static StepValidation encryptionKeyEntry() {
    ValidationResponse validation = new ValidationResponse();
    SystemRepository.addEncryptionKeyValidation(validation);
    return assertInstanceOf(
        StepValidation.class, validation.getAdditionalProperties().get(ENCRYPTION_KEY));
  }
}
