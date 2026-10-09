package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class EntityIndexWriteTest {

  private static final long NO_PAYLOAD_LIMIT = Long.MAX_VALUE;

  @Test
  void writesAreSentInRequestsOfAHundredItems() {
    List<List<EntityIndexWrite>> requests =
        EntityIndexWrite.bulkRequests(writes(250, "x"), NO_PAYLOAD_LIMIT);

    assertEquals(List.of(100, 100, 50), requests.stream().map(List::size).toList());
  }

  @Test
  void aRequestStopsAtThePayloadCap() {
    List<EntityIndexWrite> writes = writes(10, "a".repeat(1_000));
    long cap = writes.getFirst().estimatedBytes() * 3;

    List<List<EntityIndexWrite>> requests = EntityIndexWrite.bulkRequests(writes, cap);

    assertEquals(List.of(3, 3, 3, 1), requests.stream().map(List::size).toList());
  }

  @Test
  void aWriteLargerThanTheCapGoesAlone() {
    List<EntityIndexWrite> writes = writes(3, "a".repeat(10_000));

    List<List<EntityIndexWrite>> requests = EntityIndexWrite.bulkRequests(writes, 100);

    assertEquals(3, requests.size());
    assertTrue(requests.stream().allMatch(request -> request.size() == 1));
  }

  @Test
  void noWritesMeanNoRequests() {
    assertTrue(EntityIndexWrite.bulkRequests(List.of(), NO_PAYLOAD_LIMIT).isEmpty());
  }

  private static List<EntityIndexWrite> writes(int count, String value) {
    return IntStream.range(0, count)
        .mapToObj(
            i ->
                new EntityIndexWrite(
                    "table_search_index", "doc" + i, "script", Map.of("name", value)))
        .toList();
  }
}
