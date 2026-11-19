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

package org.openmetadata.service.fernet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class FernetDefaultKeyTest {

  private static final String SHIPPED_DEFAULT_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String OWN_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";

  @AfterEach
  void clearKey() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void theShippedDefaultAsTheFirstKeyIsReported() {
    Fernet.getInstance().setFernetKey(SHIPPED_DEFAULT_KEY);

    assertTrue(Fernet.getInstance().getKeyWarning().isPresent());
  }

  @Test
  void theShippedDefaultWrittenInBase64UrlIsReported() {
    Fernet.getInstance().setFernetKey("jJ_9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA");

    assertTrue(Fernet.getInstance().getKeyWarning().isPresent());
  }

  @Test
  void theShippedDefaultFirstInAKeyListIsReported() {
    Fernet.getInstance().setFernetKey(SHIPPED_DEFAULT_KEY + "," + OWN_KEY);

    assertTrue(Fernet.getInstance().getKeyWarning().isPresent());
  }

  @Test
  void anOwnKeyIsNotReported() {
    Fernet.getInstance().setFernetKey(OWN_KEY);

    assertFalse(Fernet.getInstance().getKeyWarning().isPresent());
  }

  @Test
  void anOwnKeyAheadOfTheShippedDefaultIsNotReported() {
    Fernet.getInstance().setFernetKey(OWN_KEY + "," + SHIPPED_DEFAULT_KEY);

    assertFalse(Fernet.getInstance().getKeyWarning().isPresent());
  }

  @Test
  void noKeyIsReported() {
    Fernet.getInstance().setFernetKey((String) null);

    assertTrue(Fernet.getInstance().getKeyWarning().isPresent());
  }

  @Test
  void theDefaultKeyWarningTellsHowToKeepStoredSecretsReadable() {
    Fernet.getInstance().setFernetKey(SHIPPED_DEFAULT_KEY);

    assertEquals(
        "The first Fernet key is the default shipped with OpenMetadata. Set FERNET_KEY to a new"
            + " key followed by the current one, FERNET_KEY=<new key>,<current key>, so secrets"
            + " stored with the current key still decrypt.",
        Fernet.getInstance().getKeyWarning().orElseThrow());
  }
}
