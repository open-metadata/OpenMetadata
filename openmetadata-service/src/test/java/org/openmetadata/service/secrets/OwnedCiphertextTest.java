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

package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.fernet.Fernet;

class OwnedCiphertextTest {
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String OLDER_KEY = "H6On0AYpnwpBTk2AENa4KSe6XvHBVGmvHABgeQCMaaE=";
  private static final String FIELD = "/authType/clientSecret";
  private static final SecretOwner OWNER =
      SecretOwner.builder("alertdestination").id(UUID.randomUUID()).build();

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
  }

  @AfterEach
  void tearDown() {
    Fernet.getInstance().setFernetKey(KEY);
  }

  @Test
  void aSecretOpensForTheOwnerAndFieldItWasWrittenFor() {
    String ciphertext = OwnedCiphertext.encrypt(OWNER, FIELD, "the secret");

    assertTrue(OwnedCiphertext.isOwned(ciphertext));
    assertTrue(Fernet.isTokenized(ciphertext), "it reads as ciphertext everywhere");
    assertFalse(ciphertext.contains("the secret"));
    assertEquals(Optional.of("the secret"), OwnedCiphertext.decrypt(OWNER, FIELD, ciphertext));
    assertNotEquals(ciphertext, OwnedCiphertext.encrypt(OWNER, FIELD, "the secret"));
  }

  @Test
  void aSecretOpensForNoOtherOwnerOrField() {
    String ciphertext = OwnedCiphertext.encrypt(OWNER, FIELD, "the secret");
    SecretOwner another = SecretOwner.builder("alertdestination").id(UUID.randomUUID()).build();
    SecretOwner anotherKind = new SecretOwner(OWNER.segments().reversed());

    assertEquals(Optional.empty(), OwnedCiphertext.decrypt(another, FIELD, ciphertext));
    assertEquals(Optional.empty(), OwnedCiphertext.decrypt(anotherKind, FIELD, ciphertext));
    assertEquals(
        Optional.empty(), OwnedCiphertext.decrypt(OWNER, "/authType/secretKey", ciphertext));
  }

  @Test
  void ciphertextWrittenAnywhereElseDoesNotOpenAndOwnedCiphertextOpensNowhereElse() {
    String elsewhere = Fernet.getInstance().encrypt("a value held elsewhere");
    String owned = OwnedCiphertext.encrypt(OWNER, FIELD, "the secret");

    assertFalse(OwnedCiphertext.isOwned(elsewhere));
    assertEquals(Optional.empty(), OwnedCiphertext.decrypt(OWNER, FIELD, elsewhere));
    assertEquals(Optional.empty(), OwnedCiphertext.decrypt(OWNER, FIELD, "the secret"));
    assertThrows(RuntimeException.class, () -> Fernet.getInstance().decrypt(owned));
  }

  @Test
  void aSecretWrittenWithAnOlderKeyOfTheRotationListStillOpens() {
    Fernet.getInstance().setFernetKey(OLDER_KEY);
    String ciphertext = OwnedCiphertext.encrypt(OWNER, FIELD, "the secret");
    Fernet.getInstance().setFernetKey(KEY + "," + OLDER_KEY);

    assertEquals(Optional.of("the secret"), OwnedCiphertext.decrypt(OWNER, FIELD, ciphertext));
    assertEquals(Optional.empty(), OwnedCiphertext.decryptWithPrimaryKey(OWNER, FIELD, ciphertext));
  }
}
