package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyReleaseReview;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.util.RestUtil;

class OntologyReleaseRepositoryTest {
  private final List<OntologyReleaseReview> rows =
      IntStream.range(0, 5)
          .mapToObj(index -> new OntologyReleaseReview().withTaskId("TASK-0000" + index))
          .toList();

  @Test
  void firstPageHasNoBeforeCursorAndPointsAtTheNextRow() {
    ResultList<OntologyReleaseReview> page =
        OntologyReleaseRepository.page(rows.subList(0, 2), 0, 2, rows.size());

    assertEquals(List.of("TASK-00000", "TASK-00001"), taskIds(page));
    assertNull(page.getPaging().getBefore());
    assertEquals("2", RestUtil.decodeCursor(page.getPaging().getAfter()));
    assertEquals(5, page.getPaging().getTotal());
  }

  @Test
  void middlePagePointsBothWays() {
    ResultList<OntologyReleaseReview> page =
        OntologyReleaseRepository.page(rows.subList(2, 4), 2, 2, rows.size());

    assertEquals(List.of("TASK-00002", "TASK-00003"), taskIds(page));
    assertEquals("0", RestUtil.decodeCursor(page.getPaging().getBefore()));
    assertEquals("4", RestUtil.decodeCursor(page.getPaging().getAfter()));
  }

  @Test
  void lastPageHasNoAfterCursorAndAnOffsetPastTheEndIsEmpty() {
    ResultList<OntologyReleaseReview> last =
        OntologyReleaseRepository.page(rows.subList(4, 5), 4, 2, rows.size());
    ResultList<OntologyReleaseReview> past =
        OntologyReleaseRepository.page(List.of(), 9, 2, rows.size());
    ResultList<OntologyReleaseReview> farPast =
        OntologyReleaseRepository.page(List.of(), Integer.MAX_VALUE, 2, rows.size());

    assertEquals(List.of("TASK-00004"), taskIds(last));
    assertEquals("2", RestUtil.decodeCursor(last.getPaging().getBefore()));
    assertNull(last.getPaging().getAfter());
    assertEquals(List.of(), taskIds(past));
    assertNull(past.getPaging().getAfter());
    assertEquals(List.of(), taskIds(farPast));
    assertNull(farPast.getPaging().getAfter());
  }

  @Test
  void offsetReadsTheCursorAndRefusesAMalformedOne() {
    assertEquals(0, OntologyReleaseRepository.offset(null));
    assertEquals(3, OntologyReleaseRepository.offset(cursor("3")));
    assertThrows(BadRequestException.class, () -> OntologyReleaseRepository.offset("not base64!"));
    assertThrows(
        BadRequestException.class, () -> OntologyReleaseRepository.offset(cursor("three")));
    assertThrows(BadRequestException.class, () -> OntologyReleaseRepository.offset(cursor("-1")));
  }

  private static String cursor(String offset) {
    return Base64.getUrlEncoder().encodeToString(offset.getBytes(StandardCharsets.UTF_8));
  }

  private static List<String> taskIds(ResultList<OntologyReleaseReview> page) {
    return page.getData().stream().map(OntologyReleaseReview::getTaskId).toList();
  }
}
