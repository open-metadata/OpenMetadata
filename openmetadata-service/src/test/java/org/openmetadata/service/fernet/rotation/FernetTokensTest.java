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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.macasaet.fernet.Key;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.Opening;
import org.openmetadata.service.fernet.rotation.FernetTokens.Finding;
import org.openmetadata.service.fernet.rotation.FernetTokens.Rewrite;
import org.openmetadata.service.secrets.BoundCiphertext;
import org.openmetadata.service.secrets.SecretOwner;

class FernetTokensTest {
  private static final String NEW_KEY = Key.generateKey().serialise();
  private static final String OLD_KEY = Key.generateKey().serialise();
  private static final KeyRing NEW = KeyRing.parse(NEW_KEY);
  private static final KeyRing OLD = KeyRing.parse(OLD_KEY);
  private static final KeyRing THIRD = KeyRing.parse(Key.generateKey().serialise());
  private static final KeyRing RING = KeyRing.parse(NEW_KEY + "," + OLD_KEY);
  private static final Location ROW =
      new Location("dbservice_entity", "json", List.of("id"), List.of("8c1d"));
  private static final String SECRET = "s3cret";
  private static final String PASSWORD = "/connection/config/password";

  @Test
  void anOlderKeyTokenInAServiceJsonIsReplacedUnderThePrimaryKeyOnly() {
    String oldToken = OLD.seal(SECRET);
    String json = serviceJson(oldToken);

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, json, Encoding.JSON), RING);

    String replaced = rewrite.replacement().orElseThrow();
    String newToken = JsonUtils.readTree(replaced).at(PASSWORD).textValue();
    assertEquals(new Opening.Primary(SECRET), NEW.open(newToken));
    assertEquals(new Opening.NoKey(), OLD.open(newToken));
    assertEquals(oldToken.length(), newToken.length());
    assertEquals(json.replace(oldToken, newToken), replaced, "everything else is byte-identical");
    assertEquals(
        List.of(new Finding(TokenKind.PLAIN, Outcome.OLDER_KEY, PASSWORD, "")), rewrite.findings());
  }

  @Test
  void aPrimaryKeyTokenGivesNoReplacement() {
    Rewrite rewrite =
        FernetTokens.rewrite(
            StoredText.writable(ROW, serviceJson(NEW.seal(SECRET)), Encoding.JSON), RING);

    assertEquals(Optional.empty(), rewrite.replacement());
    assertEquals(
        List.of(new Finding(TokenKind.PLAIN, Outcome.PRIMARY, "", "")), rewrite.findings());
  }

  @Test
  void theSameTokenTwiceGetsOneReplacement() {
    String oldToken = OLD.seal(SECRET);
    String json = "{\"a\":\"" + oldToken + "\",\"b\":\"" + oldToken + "\"}";

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, json, Encoding.JSON), RING);

    JsonNode replaced = JsonUtils.readTree(rewrite.replacement().orElseThrow());
    assertEquals(replaced.get("a").textValue(), replaced.get("b").textValue());
    assertEquals(new Opening.Primary(SECRET), NEW.open(replaced.get("a").textValue()));
    assertEquals(
        List.of(new Finding(TokenKind.PLAIN, Outcome.OLDER_KEY, "/a", "")), rewrite.findings());
  }

  @Test
  void aTokenNoConfiguredKeyOpensIsNoKeyAndStays() {
    Rewrite rewrite =
        FernetTokens.rewrite(
            StoredText.writable(ROW, serviceJson(THIRD.seal(SECRET)), Encoding.JSON), RING);

    assertEquals(Optional.empty(), rewrite.replacement());
    assertEquals(
        List.of(new Finding(TokenKind.PLAIN, Outcome.NO_KEY, PASSWORD, "")), rewrite.findings());
  }

  @Test
  void textThatOnlyStartsLikeATokenIsNotAFinding() {
    Rewrite rewrite =
        FernetTokens.rewrite(
            StoredText.writable(ROW, "{\"description\":\"fernet:see docs\"}", Encoding.JSON), RING);

    assertEquals(new Rewrite(Optional.empty(), List.of()), rewrite);
  }

  @Test
  void aBoundTokenOpensAfterTheRewriteForItsDestinationAndFieldOnly() {
    UUID destinationId = UUID.randomUUID();
    SecretOwner owner = SecretOwner.builder("alertdestination").id(destinationId).build();
    String field = "/headers/X-Key";
    String oldToken = BoundCiphertext.seal(OLD, owner, field, SECRET);
    String json = alertJson(destinationId, oldToken);

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, json, Encoding.JSON), RING);

    String newToken =
        JsonUtils.readTree(rewrite.replacement().orElseThrow())
            .at("/destinations/0/config/headers/X-Key")
            .textValue();
    assertEquals(new Opening.Primary(SECRET), BoundCiphertext.open(NEW, owner, field, newToken));
    assertEquals(new Opening.NoKey(), BoundCiphertext.open(NEW, owner, "/endpoint", newToken));
    SecretOwner another = SecretOwner.builder("alertdestination").id(UUID.randomUUID()).build();
    assertEquals(new Opening.NoKey(), BoundCiphertext.open(NEW, another, field, newToken));
    assertEquals(oldToken.length(), newToken.length());
    assertEquals(
        List.of(
            new Finding(
                TokenKind.BOUND, Outcome.OLDER_KEY, "/destinations/0/config/headers/X-Key", "")),
        rewrite.findings());
  }

  @Test
  void aBoundTokenInsideAChangeDescriptionStringRekeys() {
    UUID destinationId = UUID.randomUUID();
    SecretOwner owner = SecretOwner.builder("alertdestination").id(destinationId).build();
    String field = "/headers/X-Key";
    String oldToken = BoundCiphertext.seal(OLD, owner, field, SECRET);
    String destinations =
        JsonUtils.readTree(alertJson(destinationId, oldToken)).get("destinations").toString();
    String json =
        "{\"id\":\""
            + UUID.randomUUID()
            + "\",\"destinations\":[],\"changeDescription\":{\"fieldsUpdated\":[{\"name\":\"destinations\",\"newValue\":"
            + JsonUtils.pojoToJson(destinations)
            + "}]}}";

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, json, Encoding.JSON), RING);

    String recorded =
        JsonUtils.readTree(rewrite.replacement().orElseThrow())
            .at("/changeDescription/fieldsUpdated/0/newValue")
            .textValue();
    String newToken = JsonUtils.readTree(recorded).at("/0/config/headers/X-Key").textValue();
    assertEquals(new Opening.Primary(SECRET), BoundCiphertext.open(NEW, owner, field, newToken));
    assertEquals(
        List.of(
            new Finding(
                TokenKind.BOUND,
                Outcome.OLDER_KEY,
                "/changeDescription/fieldsUpdated/0/newValue",
                "")),
        rewrite.findings());
  }

  @Test
  void aBoundTokenWithNoAnchorIsUnbound() {
    SecretOwner owner = SecretOwner.builder("somethingelse").id(UUID.randomUUID()).build();
    String json = "{\"secret\":\"" + BoundCiphertext.seal(OLD, owner, "/secret", SECRET) + "\"}";

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, json, Encoding.JSON), RING);

    assertEquals(Optional.empty(), rewrite.replacement());
    assertEquals(
        List.of(new Finding(TokenKind.BOUND, Outcome.UNBOUND, "/secret", "its owner is unknown")),
        rewrite.findings());
  }

  @Test
  void anAnchoredBoundTokenThatNoKeyOpensIsUnbound() {
    UUID destinationId = UUID.randomUUID();
    SecretOwner owner = SecretOwner.builder("alertdestination").id(destinationId).build();
    String json =
        alertJson(destinationId, BoundCiphertext.seal(THIRD, owner, "/headers/X-Key", SECRET));

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, json, Encoding.JSON), RING);

    assertEquals(Optional.empty(), rewrite.replacement());
    assertEquals(
        List.of(
            new Finding(
                TokenKind.BOUND,
                Outcome.UNBOUND,
                "/destinations/0/config/headers/X-Key",
                "no candidate owner opens it")),
        rewrite.findings());
  }

  @Test
  void aJavaSerializedStringHoldingATokenIsRewrittenAsBytes() throws Exception {
    String oldToken = OLD.seal(SECRET);
    String bytes = new String(serialize(oldToken), StandardCharsets.ISO_8859_1);

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, bytes, Encoding.BYTES), RING);

    String stored = rewrite.replacement().orElseThrow();
    assertEquals(bytes.length(), stored.length());
    String newToken = deserialize(stored.getBytes(StandardCharsets.ISO_8859_1));
    assertEquals(new Opening.Primary(SECRET), NEW.open(newToken));
    assertEquals(
        List.of(new Finding(TokenKind.PLAIN, Outcome.OLDER_KEY, "", "")), rewrite.findings());
  }

  @Test
  void anUnpaddedTokenFollowedByALetterInBytesIsCutToItsOwnLength() {
    String fortyChars = "0123456789012345678901234567890123456789";
    String oldToken = OLD.seal(fortyChars);
    assertFalse(oldToken.endsWith("="), "forty bytes of plaintext give an unpadded token");
    String bytes = "\u0000\u0005" + oldToken + "p\u0000\u0004rest";

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, bytes, Encoding.BYTES), RING);

    String stored = rewrite.replacement().orElseThrow();
    String newToken = stored.substring(2, 2 + oldToken.length());
    assertEquals(new Opening.Primary(fortyChars), NEW.open(newToken));
    assertEquals("\u0000\u0005" + newToken + "p\u0000\u0004rest", stored);
  }

  @Test
  void aPaddedTokenFollowedByALetterInBytesStaysWhole() {
    String oldToken = OLD.seal(SECRET);
    assertTrue(oldToken.endsWith("=="), "six bytes of plaintext give a padded token");
    String bytes = oldToken + "t\u0000\u0003abc";

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, bytes, Encoding.BYTES), RING);

    String stored = rewrite.replacement().orElseThrow();
    String newToken = stored.substring(0, oldToken.length());
    assertEquals(new Opening.Primary(SECRET), NEW.open(newToken));
    assertEquals(newToken + "t\u0000\u0003abc", stored);
  }

  @Test
  void aTokenWhoseSecretHoldsAnOlderKeyTokenIsNotRewritten() {
    String outer = OLD.seal(OLD.seal(SECRET));

    Rewrite rewrite =
        FernetTokens.rewrite(
            StoredText.writable(ROW, "{\"t\":\"" + outer + "\"}", Encoding.JSON), RING);

    assertEquals(Optional.empty(), rewrite.replacement());
    assertEquals(
        List.of(
            new Finding(
                TokenKind.PLAIN,
                Outcome.UNREWRITABLE,
                "/t",
                "its secret holds a token that is not under the primary key")),
        rewrite.findings());
  }

  @Test
  void aTokenWhoseSecretHoldsAPrimaryKeyTokenIsSealedAgainAsOpaqueText() {
    String inner = NEW.seal(SECRET);
    String outer = OLD.seal(inner);

    Rewrite rewrite =
        FernetTokens.rewrite(
            StoredText.writable(ROW, "{\"t\":\"" + outer + "\"}", Encoding.JSON), RING);

    String newOuter = JsonUtils.readTree(rewrite.replacement().orElseThrow()).get("t").textValue();
    assertEquals(new Opening.Primary(inner), NEW.open(newOuter));
  }

  @Test
  void anOlderKeyTokenInAValueThatCannotBeWrittenIsNotRewritable() {
    Location noKey = new Location("fernet_it_nopk", "note", List.of(), List.of());
    String text = OLD.seal(SECRET) + " and " + NEW.seal(SECRET);

    Rewrite rewrite =
        FernetTokens.rewrite(
            new StoredText(noKey, text, Encoding.TEXT, Writability.NO_PRIMARY_KEY), RING);

    assertEquals(Optional.empty(), rewrite.replacement());
    assertEquals(
        List.of(
            new Finding(TokenKind.PLAIN, Outcome.UNREWRITABLE, "", "its table has no primary key"),
            new Finding(TokenKind.PLAIN, Outcome.PRIMARY, "", "")),
        rewrite.findings());
  }

  @Test
  void aValueWithAnUnrewritableTokenIsNotWrittenAtAll() {
    String json =
        "{\"a\":\"" + OLD.seal(SECRET) + "\",\"b\":\"" + OLD.seal(OLD.seal(SECRET)) + "\"}";

    Rewrite rewrite = FernetTokens.rewrite(StoredText.writable(ROW, json, Encoding.JSON), RING);

    assertEquals(Optional.empty(), rewrite.replacement());
    assertEquals(
        List.of(Outcome.OLDER_KEY, Outcome.UNREWRITABLE),
        rewrite.findings().stream().map(Finding::outcome).toList());
  }

  @Test
  void encodedLengthsFollowTheFernetSeries() {
    assertEquals(100, FernetTokens.encodedLength(1));
    assertEquals(120, FernetTokens.encodedLength(2));
    assertEquals(140, FernetTokens.encodedLength(3));
    assertEquals(164, FernetTokens.encodedLength(4));
    assertEquals(OLD.seal(SECRET).length() - "fernet:".length(), FernetTokens.encodedLength(1));
  }

  private static String serviceJson(String token) {
    return "{\"id\":\""
        + UUID.randomUUID()
        + "\",\"name\":\"mysql\",\"connection\":{\"config\":{\"type\":\"Mysql\",\"password\":\""
        + token
        + "\"}}}";
  }

  private static String alertJson(UUID destinationId, String headerToken) {
    return "{\"id\":\""
        + UUID.randomUUID()
        + "\",\"name\":\"alert\",\"destinations\":[{\"id\":\""
        + destinationId
        + "\",\"category\":\"External\",\"type\":\"Webhook\",\"config\":{\"endpoint\":\"https://example.test/hook\",\"headers\":{\"X-Key\":\""
        + headerToken
        + "\"}}}]}";
  }

  private static byte[] serialize(String value) throws IOException {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (ObjectOutputStream out = new ObjectOutputStream(bytes)) {
      out.writeObject(value);
    }
    return bytes.toByteArray();
  }

  private static String deserialize(byte[] bytes) throws IOException, ClassNotFoundException {
    try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(bytes))) {
      return (String) in.readObject();
    }
  }
}
