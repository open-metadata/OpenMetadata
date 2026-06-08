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

package org.openmetadata.service.fernet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;

import com.macasaet.fernet.Key;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FernetKeyCacheTest {

  private static final String TEST_FERNET_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String ROTATION_KEY = "ZJNP0-FkaNPWmLsuhZq1dpQ5Cr2I8bG7vRlkjJjd25A=";

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(TEST_FERNET_KEY);
  }

  @Test
  void encryptDecrypt_roundTrips() {
    Fernet fernet = Fernet.getInstance();
    String plaintext = "super-secret-value";

    String encrypted = fernet.encrypt(plaintext);

    assertNotNull(encrypted);
    assertNotEquals(plaintext, encrypted);
    assertEquals(plaintext, fernet.decrypt(encrypted));
  }

  @Test
  void multipleFields_reuseCachedKeyList() {
    Fernet fernet = Fernet.getInstance();

    List<Key> keysFirstCall = fernet.getCachedKeys();
    String encryptedFieldOne = fernet.encrypt("field-one");
    String encryptedFieldTwo = fernet.encrypt("field-two");
    fernet.decrypt(encryptedFieldOne);
    fernet.decrypt(encryptedFieldTwo);
    List<Key> keysAfterCalls = fernet.getCachedKeys();

    assertSame(keysFirstCall, keysAfterCalls);
    assertEquals("field-one", fernet.decrypt(encryptedFieldOne));
    assertEquals("field-two", fernet.decrypt(encryptedFieldTwo));
  }

  @Test
  void keyRotation_rebuildsCachedKeyList() {
    Fernet fernet = Fernet.getInstance();
    List<Key> keysBeforeRotation = fernet.getCachedKeys();
    String encryptedWithOldKey = fernet.encrypt("rotated-secret");

    fernet.setFernetKey(ROTATION_KEY + "," + TEST_FERNET_KEY);
    List<Key> keysAfterRotation = fernet.getCachedKeys();

    assertNotSame(keysBeforeRotation, keysAfterRotation);
    assertEquals("rotated-secret", fernet.decrypt(encryptedWithOldKey));
  }
}
