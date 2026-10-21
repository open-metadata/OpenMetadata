package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyReleaseDAO;
import org.openmetadata.service.ontology.OntologyReleaseHistory.Cursor;
import org.openmetadata.service.util.RestUtil;

class OntologyReleaseHistoryTest {
  @Test
  void cursorRetainsItsOwnerAndInitialHighWater() {
    final UUID owner = UUID.randomUUID();
    final Cursor cursor = new Cursor(owner, 12, 0);
    final String after = RestUtil.encodeCursor(cursor.after(8));
    assertEquals(new Cursor(owner, 12, 8), Cursor.parse(owner, after));
    assertThrows(BadRequestException.class, () -> Cursor.parse(UUID.randomUUID(), after));
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "!", "bm90LWEtaGlzdG9yeS1jdXJzb3I=", "YQ=="})
  void malformedCursorsAreRejected(String after) {
    assertThrows(BadRequestException.class, () -> Cursor.parse(UUID.randomUUID(), after));
  }

  @ParameterizedTest
  @ValueSource(strings = {"0:0", "12:0", "12:13", "-1:1", "12:-1", "not-a-number:1"})
  void cursorRevisionsMustBeWithinTheirInitialHighWater(String revisions) {
    final UUID owner = UUID.randomUUID();
    final String after = RestUtil.encodeCursor("ontology-releases-v1:" + owner + ":" + revisions);
    assertThrows(BadRequestException.class, () -> Cursor.parse(owner, after));
  }

  @Test
  void oversizedCursorsAreRejected() {
    assertThrows(BadRequestException.class, () -> Cursor.parse(UUID.randomUUID(), "a".repeat(257)));
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, 0, 101, Integer.MAX_VALUE})
  void pageSizeMustBeBounded(int limit) {
    final var history = new OntologyReleaseHistory(mock(OntologyReleaseDAO.class));
    assertThrows(BadRequestException.class, () -> history.list(UUID.randomUUID(), limit, null));
  }
}
