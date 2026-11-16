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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.macasaet.fernet.Key;
import java.util.List;
import org.junit.jupiter.api.Test;

class KeyRingTest {
  private static final String NEW = Key.generateKey().serialise();
  private static final String OLD = Key.generateKey().serialise();
  private static final String THIRD = Key.generateKey().serialise();

  @Test
  void parseNormalizesBase64LikeTheFernetSingletonAlways() {
    String base64 = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
    String base64url = "jJ_9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA";

    assertEquals(KeyRing.parse(base64url).fingerprints(), KeyRing.parse(base64).fingerprints());
    assertEquals(12, KeyRing.parse(base64).fingerprints().getFirst().length());
    assertTrue(KeyRing.parse(base64).fingerprints().getFirst().matches("[0-9a-f]{12}"));
  }

  @Test
  void parseRejectsBlankMarkerAndInvalidKeysWithoutLeakingTheKey() {
    assertThrows(IllegalArgumentException.class, () -> KeyRing.parse(null));
    assertThrows(IllegalArgumentException.class, () -> KeyRing.parse("  "));
    assertThrows(IllegalArgumentException.class, () -> KeyRing.parse(Fernet.FERNET_NO_ENCRYPTION));
    IllegalArgumentException invalid =
        assertThrows(IllegalArgumentException.class, () -> KeyRing.parse(NEW + ",not-a-key-zzz"));
    assertFalse(invalid.getMessage().contains(NEW));
    assertFalse(invalid.getMessage().contains("not-a-key-zzz"));
  }

  @Test
  void openReportsWhichKeyOpenedTheToken() {
    KeyRing ring = KeyRing.parse(NEW + "," + OLD);

    assertEquals(new Opening.Primary("s3cret"), ring.open(KeyRing.parse(NEW).seal("s3cret")));
    assertEquals(new Opening.Older(1, "s3cret"), ring.open(KeyRing.parse(OLD).seal("s3cret")));
    assertEquals(new Opening.NoKey(), ring.open(KeyRing.parse(THIRD).seal("s3cret")));
  }

  @Test
  void openGivesNoKeyForAnythingThatIsNotAPlainToken() {
    KeyRing ring = KeyRing.parse(NEW);

    assertEquals(new Opening.NoKey(), ring.open(null));
    assertEquals(new Opening.NoKey(), ring.open("fernet:see docs"));
    assertEquals(new Opening.NoKey(), ring.open("plain text"));
    assertEquals(new Opening.NoKey(), ring.open("fernet:bound:gAAAAAB"));
    assertEquals(new Opening.NoKey(), KeyRing.NONE.open(ring.seal("s3cret")));
  }

  @Test
  void rekeyIfOlderReturnsATokenThatOpensUnderTheNewKeyAlone() {
    KeyRing both = KeyRing.parse(NEW + "," + OLD);
    String oldToken = KeyRing.parse(OLD).seal("s3cret");

    String rekeyed = both.rekeyIfOlder(oldToken);

    assertNotEquals(oldToken, rekeyed);
    assertEquals(new Opening.Primary("s3cret"), KeyRing.parse(NEW).open(rekeyed));
  }

  @Test
  void rekeyIfOlderReturnsTheSameReferenceForEverythingElse() {
    KeyRing both = KeyRing.parse(NEW + "," + OLD);
    String primary = both.seal("s3cret");
    String third = KeyRing.parse(THIRD).seal("s3cret");
    String text = "fernet:see docs";

    assertSame(primary, both.rekeyIfOlder(primary));
    assertSame(third, both.rekeyIfOlder(third));
    assertSame(text, both.rekeyIfOlder(text));
    assertEquals(null, both.rekeyIfOlder(null));
  }

  @Test
  void sealOnAnEmptyRingFails() {
    assertEquals(0, KeyRing.NONE.size());
    assertThrows(IllegalStateException.class, () -> KeyRing.NONE.seal("s3cret"));
  }

  @Test
  void describeMarksThePrimaryAndKeysAreImmutable() {
    KeyRing ring = KeyRing.parse(NEW + "," + OLD);
    List<String> fingerprints = ring.fingerprints();

    assertEquals(fingerprints.get(0) + " (primary), " + fingerprints.get(1), ring.describe());
    assertThrows(UnsupportedOperationException.class, () -> ring.keys().clear());
    assertFalse(ring.describe().contains(NEW));
  }

  @Test
  void theShippedDefaultKeyIsRecognisedAsPrimaryOnly() {
    String shipped = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";

    assertTrue(KeyRing.parse(shipped + "," + OLD).isPrimaryTheShippedDefault());
    assertFalse(KeyRing.parse(NEW + "," + shipped).isPrimaryTheShippedDefault());
    assertFalse(KeyRing.NONE.isPrimaryTheShippedDefault());
  }

  @Test
  void currentFollowsTheFernetSingleton() {
    KeyRing original = KeyRing.current();
    try {
      Fernet.getInstance().setFernetKey(NEW + "," + OLD);
      assertEquals(KeyRing.parse(NEW + "," + OLD).fingerprints(), KeyRing.current().fingerprints());
      Fernet.getInstance().setFernetKey((String) null);
      assertSame(KeyRing.NONE, KeyRing.current());
    } finally {
      Fernet.getInstance().setFernetKey(original.size() == 0 ? (String) null : joined(original));
    }
  }

  @Test
  void openingNeverPrintsThePlaintext() {
    assertFalse(new Opening.Primary("s3cret").toString().contains("s3cret"));
    assertFalse(new Opening.Older(1, "s3cret").toString().contains("s3cret"));
  }

  private static String joined(KeyRing ring) {
    return String.join(",", ring.keys().stream().map(Key::serialise).toList());
  }
}
