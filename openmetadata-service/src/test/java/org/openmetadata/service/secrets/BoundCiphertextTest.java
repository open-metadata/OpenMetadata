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

import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.Opening;

class BoundCiphertextTest {
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
    String ciphertext = BoundCiphertext.encrypt(OWNER, FIELD, "the secret");

    assertTrue(BoundCiphertext.isBound(ciphertext));
    assertTrue(Fernet.isTokenized(ciphertext), "it reads as ciphertext everywhere");
    assertFalse(ciphertext.contains("the secret"));
    assertEquals(Optional.of("the secret"), BoundCiphertext.decrypt(OWNER, FIELD, ciphertext));
    assertNotEquals(ciphertext, BoundCiphertext.encrypt(OWNER, FIELD, "the secret"));
  }

  @Test
  void aSecretOpensForNoOtherOwnerOrField() {
    String ciphertext = BoundCiphertext.encrypt(OWNER, FIELD, "the secret");
    SecretOwner another = SecretOwner.builder("alertdestination").id(UUID.randomUUID()).build();
    SecretOwner anotherKind = new SecretOwner(OWNER.segments().reversed());

    assertEquals(Optional.empty(), BoundCiphertext.decrypt(another, FIELD, ciphertext));
    assertEquals(Optional.empty(), BoundCiphertext.decrypt(anotherKind, FIELD, ciphertext));
    assertEquals(
        Optional.empty(), BoundCiphertext.decrypt(OWNER, "/authType/secretKey", ciphertext));
  }

  @Test
  void ciphertextWrittenAnywhereElseDoesNotOpenAndBoundCiphertextOpensNowhereElse() {
    String elsewhere = Fernet.getInstance().encrypt("a value held elsewhere");
    String owned = BoundCiphertext.encrypt(OWNER, FIELD, "the secret");

    assertFalse(BoundCiphertext.isBound(elsewhere));
    assertEquals(Optional.empty(), BoundCiphertext.decrypt(OWNER, FIELD, elsewhere));
    assertEquals(Optional.empty(), BoundCiphertext.decrypt(OWNER, FIELD, "the secret"));
    assertThrows(RuntimeException.class, () -> Fernet.getInstance().decrypt(owned));
  }

  @Test
  void theKeyDerivationMatchesTheRfc5869TestVectors() {
    HexFormat hex = HexFormat.of();
    byte[] inputKey = hex.parseHex("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b");

    assertEquals(
        "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865",
        hex.formatHex(
            BoundCiphertext.hkdfSha256(
                inputKey,
                hex.parseHex("000102030405060708090a0b0c"),
                hex.parseHex("f0f1f2f3f4f5f6f7f8f9"),
                42)),
        "RFC 5869 A.1");
    assertEquals(
        "8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8",
        hex.formatHex(BoundCiphertext.hkdfSha256(inputKey, new byte[0], new byte[0], 42)),
        "RFC 5869 A.3");
  }

  @Test
  void aSecretWrittenBeforeStillOpens() {
    SecretOwner owner =
        SecretOwner.builder("alertdestination")
            .id(UUID.fromString("3f2b6c1e-8a4d-4f7a-9c2e-5b1d0e7a6c49"))
            .build();
    String writtenBefore =
        "fernet:bound:gAAAAABq7HPuWNUoxTOihin4Se5VdkuFmCts5wKEGGRHpBJc23hSBSUtgURu9LuhX6KwA_jTGG0xpbAl_j5Xolva-wpwh1fDIA==";

    assertEquals(Optional.of("the secret"), BoundCiphertext.decrypt(owner, FIELD, writtenBefore));
  }

  @Test
  void aSecretWrittenWithAnOlderKeyOfTheRotationListStillOpens() {
    Fernet.getInstance().setFernetKey(OLDER_KEY);
    String ciphertext = BoundCiphertext.encrypt(OWNER, FIELD, "the secret");
    Fernet.getInstance().setFernetKey(KEY + "," + OLDER_KEY);

    assertEquals(Optional.of("the secret"), BoundCiphertext.decrypt(OWNER, FIELD, ciphertext));
    assertEquals(Optional.empty(), BoundCiphertext.decryptWithPrimaryKey(OWNER, FIELD, ciphertext));
  }

  @Test
  void openReportsTheKeyIndexAndNoKeyForAnotherOwnerOrField() {
    Fernet.getInstance().setFernetKey(OLDER_KEY);
    String ciphertext = BoundCiphertext.encrypt(OWNER, FIELD, "s3cret");
    KeyRing both = KeyRing.parse(KEY + "," + OLDER_KEY);
    SecretOwner another = SecretOwner.builder("alertdestination").id(UUID.randomUUID()).build();

    assertEquals(
        new Opening.Older(1, "s3cret"), BoundCiphertext.open(both, OWNER, FIELD, ciphertext));
    assertEquals(new Opening.NoKey(), BoundCiphertext.open(both, another, FIELD, ciphertext));
    assertEquals(
        new Opening.NoKey(), BoundCiphertext.open(both, OWNER, "/authType/secretKey", ciphertext));
    assertEquals(new Opening.NoKey(), BoundCiphertext.open(KeyRing.NONE, OWNER, FIELD, ciphertext));
    assertEquals(new Opening.NoKey(), BoundCiphertext.open(both, OWNER, FIELD, "plain text"));
  }

  @Test
  void sealOpensAsPrimaryAndWithTheExistingDecryptPaths() {
    KeyRing both = KeyRing.parse(KEY + "," + OLDER_KEY);

    String sealed = BoundCiphertext.seal(both, OWNER, FIELD, "s3cret");

    assertEquals(new Opening.Primary("s3cret"), BoundCiphertext.open(both, OWNER, FIELD, sealed));
    assertEquals(Optional.of("s3cret"), BoundCiphertext.decrypt(OWNER, FIELD, sealed));
    assertEquals(
        Optional.of("s3cret"), BoundCiphertext.decryptWithPrimaryKey(OWNER, FIELD, sealed));
    assertThrows(
        IllegalStateException.class, () -> BoundCiphertext.seal(KeyRing.NONE, OWNER, FIELD, "x"));
  }

  @Test
  void withoutAKeyEncryptAndDecryptRefuse() {
    Fernet.getInstance().setFernetKey((String) null);

    assertThrows(IllegalStateException.class, () -> BoundCiphertext.encrypt(OWNER, FIELD, "x"));
    assertThrows(IllegalStateException.class, () -> BoundCiphertext.decrypt(OWNER, FIELD, "x"));
  }
}
