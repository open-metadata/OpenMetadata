package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventSize;

class ChangeEventReadBudgetTest {

  private static final long MEGABYTE = 1024L * 1024L;

  @Test
  void nothingToReadReadsNothing() {
    assertEquals(List.of(), ChangeEventDAO.offsetsWithinBudget(List.of(), 8 * MEGABYTE));
  }

  @Test
  void readsEventsInOrderUntilTheNextOneWouldPassTheBudget() {
    List<ChangeEventSize> sizes =
        List.of(
            new ChangeEventSize(8L, 3 * MEGABYTE),
            new ChangeEventSize(9L, 5 * MEGABYTE),
            new ChangeEventSize(10L, 1L),
            new ChangeEventSize(11L, 1L));

    assertEquals(List.of(8L, 9L), ChangeEventDAO.offsetsWithinBudget(sizes, 8 * MEGABYTE));
  }

  @Test
  void anEventLargerThanTheBudgetIsStillReadOnItsOwn() {
    List<ChangeEventSize> sizes =
        List.of(new ChangeEventSize(8L, 50 * MEGABYTE), new ChangeEventSize(9L, 1L));

    assertEquals(List.of(8L), ChangeEventDAO.offsetsWithinBudget(sizes, 8 * MEGABYTE));
  }

  @Test
  void aReadAsksForNoMoreRowsThanTheCap() {
    ChangeEventDAO dao = mock(ChangeEventDAO.class, CALLS_REAL_METHODS);
    when(dao.listSizesAfter(ChangeEventDAO.MAX_ROWS_PER_READ, 7L)).thenReturn(List.of());

    List<ChangeEventRecord> read = dao.listWithOffset(Integer.MAX_VALUE, 7L);

    assertEquals(List.of(), read);
    verify(dao).listSizesAfter(ChangeEventDAO.MAX_ROWS_PER_READ, 7L);
    verify(dao, never()).listByOffsets(anyList());
  }

  @Test
  void aReadLoadsOnlyTheEventsWithinTheBudget() {
    ChangeEventDAO dao = mock(ChangeEventDAO.class, CALLS_REAL_METHODS);
    when(dao.listSizesAfter(100, 7L))
        .thenReturn(
            List.of(
                new ChangeEventSize(8L, ChangeEventDAO.MAX_BYTES_PER_READ),
                new ChangeEventSize(9L, 1L)));
    List<ChangeEventRecord> first = List.of(new ChangeEventRecord(8L, "{}"));
    when(dao.listByOffsets(List.of(8L))).thenReturn(first);

    assertEquals(first, dao.listWithOffset(100, 7L));
  }
}
