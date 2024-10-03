package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ListFilterTest {
  @Test
  void test_escapeApostrophe() {
    assertEqual("abcd", ListFilter.escape("abcd"));
    assertEqual("a''bcd", ListFilter.escape("a'bcd"));
    assertEqual("a''b''cd", ListFilter.escape("a'b'cd"));
    assertEqual("a''b''c''d", ListFilter.escape("a'b'c'd"));
    assertEqual("a''b''c\\_d", ListFilter.escape("a'b'c_d"));
    assertEqual("a''b\\_c\\_d", ListFilter.escape("a'b_c_d"));
    assertEqual("a\\_b\\_c\\_d", ListFilter.escape("a_b_c_d"));
  }

  @Test
  void addCondition() {
    String condition;
    ListFilter filter = new ListFilter();

    condition = filter.addCondition(List.of("a", "b"));
    assertEqual("a AND b", condition);

    condition = filter.addCondition(List.of("foo=`abcf`", "", ""));
    assertEqual("foo=`abcf`", condition);

    condition = filter.addCondition(List.of("foo=`abcf`", "v in ('A', 'B')", "x > 6"));
    assertEqual("foo=`abcf` AND v in ('A', 'B') AND x > 6", condition);

    condition = filter.addCondition(new ArrayList<>());
    assertEqual("", condition);
  }

  @Test
  void getCondition() {
    ListFilter filter = new ListFilter();
    String condition = filter.getCondition("foo");
    assertEqual("WHERE foo.deleted = FALSE", condition);

    filter = new ListFilter();
    filter.addQueryParam("testCaseStatus", "Failed");
    condition = filter.getCondition("foo");
    assertEqual("WHERE foo.deleted = FALSE AND status = 'Failed'", condition);
  }
}
