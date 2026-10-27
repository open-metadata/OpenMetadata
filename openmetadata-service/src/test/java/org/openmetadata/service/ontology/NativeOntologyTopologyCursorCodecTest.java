package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.AxiomPosition;
import org.openmetadata.service.ontology.NativeOntologyDataGraphPager.Cursor;
import org.openmetadata.service.util.RestUtil;

class NativeOntologyTopologyCursorCodecTest {
  private static final NativeOntologyTopologyCursorCodec CODEC =
      new NativeOntologyTopologyCursorCodec();

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
}
