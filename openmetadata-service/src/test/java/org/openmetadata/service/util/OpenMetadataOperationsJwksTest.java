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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class OpenMetadataOperationsJwksTest {
  // A 512-bit modulus with the high bit set, so BigInteger.toByteArray prepends 0x00 as the
  // server's JWKS does.
  private static final BigInteger MODULUS =
      new BigInteger(
          "c0070e151c232a31383f464d545b626970777e858c939aa1a8afb6bdc4cbd2d9e0e7eef5fc030a11181f262d343b424950575e656c737a81888f969da4abb2b9",
          16);
  private static final BigInteger EXPONENT = BigInteger.valueOf(65537);
  private static final String JWKS =
      """
      {"keys":[{"kty":"RSA","kid":"new-key","n":"AMAHDhUcIyoxOD9GTVRbYmlwd36FjJOaoaivtr3Ey9LZ4Ofu9fwDChEYHyYtNDtCSVBXXmVsc3qBiI-WnaSrsrk=","e":"AQAB","alg":"RS256","use":"sig"}]}
      """;

  private static RSAPublicKey key(BigInteger modulus) throws Exception {
    return (RSAPublicKey)
        KeyFactory.getInstance("RSA").generatePublic(new RSAPublicKeySpec(modulus, EXPONENT));
  }

  @Test
  void jwksListingTheKidWithTheSameModulusAndExponentMatches() throws Exception {
    assertTrue(OpenMetadataOperations.jwksListsKey(JWKS, "new-key", key(MODULUS)));
  }

  @Test
  void jwksWithAnUnpaddedModulusWithoutALeadingZeroByteMatches() throws Exception {
    BigInteger modulus = new BigInteger("c0".repeat(256), 16);
    String n = Base64.getUrlEncoder().withoutPadding().encodeToString(unsignedBytes(modulus));
    String jwks =
        "{\"keys\":[{\"kty\":\"RSA\",\"kid\":\"new-key\",\"n\":\"" + n + "\",\"e\":\"AQAB\"}]}";

    assertTrue(OpenMetadataOperations.jwksListsKey(jwks, "new-key", key(modulus)));
  }

  private static byte[] unsignedBytes(BigInteger value) {
    byte[] bytes = value.toByteArray();
    return bytes[0] == 0 ? Arrays.copyOfRange(bytes, 1, bytes.length) : bytes;
  }

  @Test
  void jwksWithAnotherKidDoesNotMatch() throws Exception {
    assertFalse(OpenMetadataOperations.jwksListsKey(JWKS, "old-key", key(MODULUS)));
  }

  @Test
  void jwksWithAnotherModulusDoesNotMatch() throws Exception {
    assertFalse(
        OpenMetadataOperations.jwksListsKey(JWKS, "new-key", key(MODULUS.add(BigInteger.TWO))));
  }

  @Test
  void jwksWithoutKeysDoesNotMatch() throws Exception {
    assertFalse(OpenMetadataOperations.jwksListsKey("{\"keys\":[]}", "new-key", key(MODULUS)));
  }
}
