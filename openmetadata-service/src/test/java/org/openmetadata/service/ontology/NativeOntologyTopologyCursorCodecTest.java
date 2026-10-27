package org.openmetadata.service.ontology;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.macasaet.fernet.Key;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.AxiomPosition;
import org.openmetadata.service.ontology.NativeOntologyDataGraphPager.Cursor;
import org.openmetadata.service.util.RestUtil;

class NativeOntologyTopologyCursorCodecTest {
  private static final NativeOntologyTopologyCursorCodec CODEC =
      new NativeOntologyTopologyCursorCodec(List.of(Key.generateKey()));
  private static final String REFUSED = "Invalid native graph topology cursor";

  @Test
  void cursorRoundTripsIndependentStreamPositionsAndRejectsDifferentContext() {
    final var cursor =
        new Cursor(
            1,
            "context",
            new AxiomPosition("", UUID.randomUUID().toString()),
            7,
            new LineagePosition(
                UUID.randomUUID().toString(), UUID.randomUUID().toString(), "typed"),
            false,
            true);
    assertEquals(cursor, CODEC.decode(CODEC.encode(cursor), "context"));
    assertThrows(BadRequestException.class, () -> CODEC.decode(CODEC.encode(cursor), "changed"));
    assertThrows(BadRequestException.class, () -> CODEC.decode("not base64", "context"));
    assertThrows(BadRequestException.class, () -> CODEC.decode("a".repeat(8193), "context"));
    assertThrows(
        BadRequestException.class, () -> CODEC.decode(RestUtil.encodeCursor("{}"), "context"));
    assertThrows(
        BadRequestException.class, () -> CODEC.decode(RestUtil.encodeCursor("{broken"), "context"));
  }

  @Test
  void anIssuedCursorShowsNoPositionAndItsBase64DecodingIsNotJson() {
    final var cursor = cursor();
    final String decoded = new String(Base64.getUrlDecoder().decode(CODEC.encode(cursor)), UTF_8);
    assertFalse(decoded.contains(cursor.semanticAfter().id()));
    assertFalse(decoded.contains(cursor.lineageAfter().fromId()));
    assertFalse(decoded.contains(cursor.lineageAfter().toId()));
    assertFalse(decoded.contains(cursor.lineageAfter().relationType()));
    assertThrows(JsonParsingException.class, () -> JsonUtils.readTree(decoded));
  }

  @Test
  void everyTamperedByteIsRefused() {
    final byte[] issued = Base64.getUrlDecoder().decode(CODEC.encode(cursor()));
    for (int index = 0; index < issued.length; index++) {
      final byte[] tampered = issued.clone();
      tampered[index] ^= 1;
      assertRefused(CODEC, Base64.getUrlEncoder().encodeToString(tampered));
    }
  }

  @Test
  void aCursorFromAnotherKeyOrInTheUnsignedFormatIsRefused() {
    final var otherKey = new NativeOntologyTopologyCursorCodec(List.of(Key.generateKey()));
    assertRefused(CODEC, otherKey.encode(cursor()));
    assertRefused(CODEC, unsigned(cursor()));
  }

  @Test
  void withoutAKeyNoCursorIsIssuedAndNoneIsAccepted() {
    final var keyless = new NativeOntologyTopologyCursorCodec(List.of());
    assertThrows(IllegalStateException.class, () -> keyless.encode(cursor()));
    assertRefused(keyless, CODEC.encode(cursor()));
    assertRefused(keyless, unsigned(cursor()));
  }

  @Test
  void aRotatedKeyListStillOpensCursorsSealedWithAnOlderKey() {
    final var older = Key.generateKey();
    final var sealed = new NativeOntologyTopologyCursorCodec(List.of(older)).encode(cursor());
    final var rotated = new NativeOntologyTopologyCursorCodec(List.of(Key.generateKey(), older));
    assertEquals(cursor(), rotated.decode(sealed, "context"));
  }

  static String unsigned(final Cursor cursor) {
    return RestUtil.encodeCursor(
        """
        {"version":%d,"contextDigest":"%s","semanticAfterId":"%s","targetOffset":%d,\
        "lineageAfter":{"fromId":"%s","toId":"%s","relationType":"%s"},\
        "semanticDone":%b,"lineageDone":%b}"""
            .formatted(
                cursor.version(),
                cursor.contextDigest(),
                cursor.semanticAfter().id(),
                cursor.targetOffset(),
                cursor.lineageAfter().fromId(),
                cursor.lineageAfter().toId(),
                cursor.lineageAfter().relationType(),
                cursor.semanticDone(),
                cursor.lineageDone()));
  }

  private static void assertRefused(
      final NativeOntologyTopologyCursorCodec codec, final String token) {
    assertEquals(
        REFUSED,
        assertThrows(BadRequestException.class, () -> codec.decode(token, "context")).getMessage());
  }

  private static Cursor cursor() {
    return new Cursor(
        1,
        "context",
        new AxiomPosition("", "8d1f3c52-6f0e-4a5c-9b7e-2a4d6c8e0f13"),
        3,
        new LineagePosition(
            "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9",
            "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a",
            "typed"),
        false,
        false);
  }
}
