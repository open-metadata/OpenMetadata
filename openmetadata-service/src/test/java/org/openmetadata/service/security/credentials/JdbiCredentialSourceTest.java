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
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiFunction;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType;
import org.openmetadata.service.security.credentials.CredentialRecord.MechanismVersion;
import org.openmetadata.service.security.credentials.CredentialSourceDAO.FullRow;

class JdbiCredentialSourceTest {

  private static final String JWT_USER =
      "{\"name\":\"ingestion-bot\",\"authenticationMechanism\":{\"authType\":\"JWT\","
          + "\"config\":{\"JWTToken\":\"stored-ciphertext\",\"JWTTokenExpiry\":\"Unlimited\"}}}";
  private static final String BASIC_USER =
      "{\"name\":\"alice\",\"authenticationMechanism\":{\"authType\":\"BASIC\","
          + "\"config\":{\"password\":\"hunter2\"}}}";
  private static final String T1 = "00000000-0000-0000-0000-000000000001";
  private static final String T2 = "00000000-0000-0000-0000-000000000002";
  private static final String PLAIN_USER = "{\"name\":\"bob\"}";

  private final AtomicInteger decrypts = new AtomicInteger();
  private final BiFunction<String, AuthenticationMechanism, AuthenticationMechanism> decrypt =
      (name, mechanism) -> {
        decrypts.incrementAndGet();
        return new AuthenticationMechanism()
            .withAuthType(AuthType.JWT)
            .withConfig(Map.of("JWTToken", "bot-jwt", "JWTTokenExpiry", "Unlimited"));
      };

  private static FullRow row(
      boolean deleted, long updatedAt, String md5, String tokenId, String userJson, String pat) {
    return new FullRow("hash", "user-1", deleted, updatedAt, md5, tokenId, userJson, pat);
  }

  private static String pat(String id, String jwt) {
    return "{\"token\":\""
        + id
        + "\",\"tokenType\":\"PERSONAL_ACCESS_TOKEN\",\"jwtToken\":\""
        + jwt
        + "\"}";
  }

  private static List<FullRow> botWithTwoPats() {
    return List.of(
        row(false, 10, "md5-a", T1, JWT_USER, pat(T1, "pat-one")),
        row(false, 10, "md5-a", T2, JWT_USER, pat(T2, "pat-two")));
  }

  @Test
  void fingerprintIgnoresPatRowOrder() {
    List<FullRow> rows = botWithTwoPats();
    assertEquals(
        JdbiCredentialSource.fingerprintOf(rows),
        JdbiCredentialSource.fingerprintOf(List.of(rows.get(1), rows.get(0))));
  }

  @Test
  void fingerprintMovesOnEachInputAlone() {
    SourceFingerprint base =
        JdbiCredentialSource.fingerprintOf(List.of(row(false, 10, "m", T1, null, null)));
    List<FullRow> variants =
        List.of(
            new FullRow("hash", "user-2", false, 10, "m", T1, null, null),
            row(true, 10, "m", T1, null, null),
            row(false, 11, "m", T1, null, null),
            row(false, 10, "other", T1, null, null),
            row(false, 10, "m", T2, null, null));
    variants.forEach(v -> assertNotEquals(base, JdbiCredentialSource.fingerprintOf(List.of(v))));
  }

  @Test
  void addingAPatMovesTheFingerprint() {
    SourceFingerprint none =
        JdbiCredentialSource.fingerprintOf(List.of(row(false, 10, "m", null, null, null)));
    SourceFingerprint one =
        JdbiCredentialSource.fingerprintOf(List.of(row(false, 10, "m", T1, null, null)));
    assertNotEquals(none, one);
  }

  @Test
  void userWithNoPatsDiffersFromAbsentUser() {
    SourceFingerprint noPats =
        JdbiCredentialSource.fingerprintOf(List.of(row(false, 10, null, null, null, null)));
    assertNotEquals(SourceFingerprint.ABSENT, noPats);
    assertEquals(SourceFingerprint.ABSENT, JdbiCredentialSource.fingerprintOf(List.of()));
  }

  @Test
  void jwtMechanismAndTwoPatsGiveThreeDigests() {
    CredentialRecord record = JdbiCredentialSource.toRecord(botWithTwoPats(), null, decrypt);
    assertEquals(
        Set.of(TokenDigest.of("bot-jwt"), TokenDigest.of("pat-one"), TokenDigest.of("pat-two")),
        record.digests());
    assertEquals(TokenDigest.of("bot-jwt"), record.mechanismDigest());
    assertEquals(new MechanismVersion("md5-a", 10), record.mechanismVersion());
  }

  @Test
  void basicMechanismGivesOnlyPatDigests() {
    List<FullRow> rows = List.of(row(false, 10, "m", T1, BASIC_USER, pat(T1, "pat-one")));
    CredentialRecord record = JdbiCredentialSource.toRecord(rows, null, decrypt);
    assertEquals(Set.of(TokenDigest.of("pat-one")), record.digests());
    assertEquals(null, record.mechanismVersion());
    assertEquals(0, decrypts.get());
  }

  @Test
  void userWithoutMechanismOrPatsHasNoDigests() {
    CredentialRecord record =
        JdbiCredentialSource.toRecord(
            List.of(row(false, 10, null, null, PLAIN_USER, null)), null, decrypt);
    assertEquals(Set.of(), record.digests());
  }

  @Test
  void deletedUserHasNoDigestsAndKeepsItsFingerprint() {
    List<FullRow> rows = new ArrayList<>(botWithTwoPats());
    rows.replaceAll(r -> row(true, 10, "md5-a", r.tokenId(), r.userJson(), r.tokenJson()));
    CredentialRecord record = JdbiCredentialSource.toRecord(rows, null, decrypt);
    assertEquals(Set.of(), record.digests());
    assertEquals(JdbiCredentialSource.fingerprintOf(rows), record.fingerprint());
    assertEquals(0, decrypts.get());
  }

  @Test
  void noRowsGivesAbsent() {
    assertEquals(CredentialRecord.ABSENT, JdbiCredentialSource.toRecord(List.of(), null, decrypt));
  }

  @Test
  void unchangedMechanismVersionReusesPreviousDigestWithoutDecrypting() {
    CredentialRecord previous = JdbiCredentialSource.toRecord(botWithTwoPats(), null, decrypt);
    decrypts.set(0);
    CredentialRecord reread = JdbiCredentialSource.toRecord(botWithTwoPats(), previous, decrypt);
    assertEquals(previous.digests(), reread.digests());
    assertEquals(0, decrypts.get());
  }

  @Test
  void changedMd5DecryptsAgain() {
    CredentialRecord previous = JdbiCredentialSource.toRecord(botWithTwoPats(), null, decrypt);
    List<FullRow> rotated = List.of(row(false, 10, "md5-b", null, JWT_USER, null));
    JdbiCredentialSource.toRecord(rotated, previous, decrypt);
    assertEquals(2, decrypts.get());
  }

  @Test
  void changedUpdatedAtWithSameMd5DecryptsAgain() {
    CredentialRecord previous = JdbiCredentialSource.toRecord(botWithTwoPats(), null, decrypt);
    List<FullRow> externallyRotated = List.of(row(false, 99, "md5-a", null, JWT_USER, null));
    JdbiCredentialSource.toRecord(externallyRotated, previous, decrypt);
    assertEquals(2, decrypts.get());
  }

  @Test
  void emptyPreviousAlwaysDecrypts() {
    JdbiCredentialSource.toRecord(botWithTwoPats(), null, decrypt);
    JdbiCredentialSource.toRecord(botWithTwoPats(), null, decrypt);
    assertEquals(2, decrypts.get());
  }
}
