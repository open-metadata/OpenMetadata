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

package org.openmetadata.service.fernet.rotation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.macasaet.fernet.Key;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.rotation.FernetKeyRotation.Options;
import org.openmetadata.service.fernet.rotation.FernetKeyRotation.Refused;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Every refusal comes before the database is read, and a refusal of the configured keys also before
 * the operator is asked. The database handle given here is null and {@code NEVER_ASKED} fails when
 * asked, so a refusal that moves later or goes away fails these tests with another exception.
 */
class FernetKeyRotationTest {
  private static final String SHIPPED_DEFAULT_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String NEW = Key.generateKey().serialise();
  private static final String OLD = Key.generateKey().serialise();
  private static final BooleanSupplier NEVER_ASKED =
      () -> {
        throw new AssertionError("the operator was asked to confirm a run that is refused");
      };

  @Test
  void applyWithASingleKeyIsRefusedBeforeTheOperatorIsAsked() {
    Refused refused =
        assertThrows(Refused.class, () -> run(Options.of(true, false, NEVER_ASKED), NEW));

    assertEquals(
        "--apply needs FERNET_KEY to list the new key first and the old key second; only one key"
            + " is configured.",
        refused.getMessage());
  }

  @Test
  void applyWithTheShippedDefaultKeyFirstIsRefusedBeforeTheOperatorIsAsked() {
    Refused refused =
        assertThrows(
            Refused.class,
            () -> run(Options.of(true, true, NEVER_ASKED), SHIPPED_DEFAULT_KEY + "," + OLD));

    assertEquals(
        "The primary key is the default key shipped in openmetadata.yaml; put a new key first.",
        refused.getMessage());
  }

  @Test
  void applyThatTheOperatorDoesNotConfirmIsRefused() {
    Refused refused =
        assertThrows(
            Refused.class, () -> run(Options.of(true, false, () -> false), NEW + "," + OLD));

    assertEquals("The rotation was not confirmed.", refused.getMessage());
  }

  @Test
  void aReportWithoutAnyKeyIsRefused() {
    Refused refused =
        assertThrows(
            Refused.class,
            () ->
                FernetKeyRotation.run(
                    Options.of(false, false, NEVER_ASKED),
                    KeyRing.NONE,
                    null,
                    ConnectionType.MYSQL,
                    null));

    assertEquals(
        "No Fernet key is configured ("
            + Fernet.FERNET_NO_ENCRYPTION
            + "), so there is nothing to rotate.",
        refused.getMessage());
  }

  private static FernetKeyRotation.Report run(Options options, String keys) {
    return FernetKeyRotation.run(options, KeyRing.parse(keys), null, ConnectionType.MYSQL, null);
  }
}
