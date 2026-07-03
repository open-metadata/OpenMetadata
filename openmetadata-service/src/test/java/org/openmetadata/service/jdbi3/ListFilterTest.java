package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Include;

class ListFilterTest {
  @Test
  void test_escapeApostrophe() {
    assertEquals("abcd", ListFilter.escape("abcd"));
    assertEquals("a''bcd", ListFilter.escape("a'bcd"));
    assertEquals("a''b''cd", ListFilter.escape("a'b'cd"));
    assertEquals("a''b''c''d", ListFilter.escape("a'b'c'd"));
    assertEquals("a''b''c\\_d", ListFilter.escape("a'b'c_d"));
    assertEquals("a''b\\_c\\_d", ListFilter.escape("a'b_c_d"));
    assertEquals("a\\_b\\_c\\_d", ListFilter.escape("a_b_c_d"));
  }

  @Test
  void test_escapeBackslashAndApostrophe_passesThroughPlainStrings() {
    assertEquals("abcd", ListFilter.escapeBackslashAndApostrophe("abcd"));
    assertEquals("", ListFilter.escapeBackslashAndApostrophe(""));
  }

  @Test
  void test_escapeBackslashAndApostrophe_doublesApostrophes() {
    // ' → '' for the SQL string-literal layer
    assertEquals("a''b", ListFilter.escapeBackslashAndApostrophe("a'b"));
    assertEquals("''", ListFilter.escapeBackslashAndApostrophe("'"));
  }

  @Test
  void test_escapeBackslashAndApostrophe_doublesBackslashesBeforeApostrophes() {
    // \ → \\ for the SQL string-literal layer (MySQL default + Postgres legacy mode);
    // backslash escape must run BEFORE apostrophe escape so the \\ we just inserted
    // is not itself re-doubled by a subsequent pass.
    assertEquals("a\\\\b", ListFilter.escapeBackslashAndApostrophe("a\\b"));
    assertEquals("\\\\\\\\", ListFilter.escapeBackslashAndApostrophe("\\\\"));
    assertEquals("a\\\\''b", ListFilter.escapeBackslashAndApostrophe("a\\'b"));
  }

  @Test
  void test_escape_alsoDoublesBackslashesViaBackslashAndApostrophe() {
    // Regression guard: escape() composes through escapeBackslashAndApostrophe, so a
    // literal backslash in the input must come out doubled (defence-in-depth against
    // SQL string-literal escape interpretation, on top of the existing LIKE underscore
    // escape).
    assertEquals("a\\\\b", ListFilter.escape("a\\b"));
    assertEquals("a\\\\b\\_c", ListFilter.escape("a\\b_c"));
  }

  @Test
  void test_escapeForMySqlRegexReplacement_passesThroughPlainStrings() {
    assertEquals("abcd", ListFilter.escapeForMySqlRegexReplacement("abcd"));
    assertEquals("", ListFilter.escapeForMySqlRegexReplacement(""));
  }

  @Test
  void test_escapeForMySqlRegexReplacement_doublesApostrophesOnce() {
    // Apostrophes only matter for the SQL string-literal layer — REGEXP_REPLACE's
    // replacement context doesn't reserve them. Expect a single ' → '' doubling.
    assertEquals("a''b", ListFilter.escapeForMySqlRegexReplacement("a'b"));
  }

  @Test
  void test_escapeForMySqlRegexReplacement_quadruplesBackslashes() {
    // One input backslash needs to round-trip to one literal backslash in the
    // REGEXP_REPLACE output, so it must be FOUR backslashes in the emitted SQL text:
    //   SQL text  : \\\\  (4 backslashes)
    //   SQL parser: \\    (2 backslashes — '\\' is the SQL string-literal escape for '\')
    //   regex eng : \     (1 backslash — '\\' in the regex replacement is a literal '\')
    // Without the regex-replacement escape, the regex engine would interpret the lone
    // remaining '\' as the start of an escape/backref sequence.
    assertEquals("a\\\\\\\\b", ListFilter.escapeForMySqlRegexReplacement("a\\b"));
    assertEquals("\\\\\\\\", ListFilter.escapeForMySqlRegexReplacement("\\"));
  }

  @Test
  void test_escapeForMySqlRegexReplacement_protectsBackreferenceLookalikes() {
    // Without the extra regex-replacement layer, "\1" in the input would survive as "\1"
    // in the regex replacement and be interpreted as a backreference to capture group 1
    // (REGEXP_REPLACE doesn't have groups when called like updateFqn does, but the
    // behaviour is implementation-defined — usually empty-string substitution). After
    // the double escape it survives as a literal "\1" in the output.
    assertEquals("\\\\\\\\1bar", ListFilter.escapeForMySqlRegexReplacement("\\1bar"));
  }

  @Test
  void test_escapeForMySqlRegexReplacement_combinesBackslashAndApostrophe() {
    // Backslashes get four-x'd, apostrophes double once.
    assertEquals("a\\\\\\\\''b", ListFilter.escapeForMySqlRegexReplacement("a\\'b"));
  }

  @Test
  void addCondition() {
    String condition;
    ListFilter filter = new ListFilter();

    condition = filter.addCondition(List.of("a", "b"));
    assertEquals("a AND b", condition);

    condition = filter.addCondition(List.of("foo=`abcf`", "", ""));
    assertEquals("foo=`abcf`", condition);

    condition = filter.addCondition(List.of("foo=`abcf`", "v in ('A', 'B')", "x > 6"));
    assertEquals("foo=`abcf` AND v in ('A', 'B') AND x > 6", condition);

    condition = filter.addCondition(new ArrayList<>());
    assertEquals("", condition);
  }

  @Test
  void getCondition() {
    ListFilter filter = new ListFilter();
    String condition = filter.getCondition("foo");
    assertEquals("WHERE foo.deleted = FALSE", condition);

    filter = new ListFilter();
    filter.addQueryParam("testCaseStatus", "Failed");
    condition = filter.getCondition("foo");
    assertEquals("WHERE foo.deleted = FALSE AND status = :testCaseStatus", condition);
  }

  @Test
  void test_getAgentTypeCondition_singleAgentType() {
    ListFilter filter = new ListFilter();

    filter.addQueryParam("agentType", "CollateAI");
    String condition = filter.getCondition("app_entity");
    assertTrue(
        condition.contains("JSON_EXTRACT(json, '$.agentType') IN (:agentType_0)")
            || condition.contains("json->>'agentType' IN (:agentType_0)"));
    assertEquals("CollateAI", filter.getQueryParams().get("agentType_0"));
  }

  @Test
  void test_getAgentTypeCondition_multipleAgentTypes() {
    ListFilter filter = new ListFilter();

    filter.addQueryParam("agentType", "CollateAI,Metadata,CollateAITierAgent");
    String condition = filter.getCondition("app_entity");

    assertTrue(condition.contains("IN (:agentType_0,:agentType_1,:agentType_2)"));
    assertFalse(condition.contains(" OR "));
    assertEquals("CollateAI", filter.getQueryParams().get("agentType_0"));
    assertEquals("Metadata", filter.getQueryParams().get("agentType_1"));
    assertEquals("CollateAITierAgent", filter.getQueryParams().get("agentType_2"));
  }

  @Test
  void test_getAgentTypeCondition_withWhitespace() {
    ListFilter filter = new ListFilter();

    filter.addQueryParam("agentType", " CollateAI , Metadata , CollateAITierAgent ");
    String condition = filter.getCondition("app_entity");

    assertTrue(condition.contains("IN (:agentType_0,:agentType_1,:agentType_2)"));
    assertFalse(condition.contains(" OR "));
    assertEquals("CollateAI", filter.getQueryParams().get("agentType_0"));
    assertEquals("Metadata", filter.getQueryParams().get("agentType_1"));
    assertEquals("CollateAITierAgent", filter.getQueryParams().get("agentType_2"));
  }

  @Test
  void test_getAgentTypeCondition_emptyOrNull() {
    ListFilter filter = new ListFilter();

    // Test null agent type
    String condition = filter.getCondition("app_entity");
    assertFalse(condition.contains("agentType"));

    // Test empty agent type
    filter.addQueryParam("agentType", "");
    condition = filter.getCondition("app_entity");
    assertFalse(condition.contains("agentType"));

    // Test whitespace only
    filter = new ListFilter();
    filter.addQueryParam("agentType", "   ");
    condition = filter.getCondition("app_entity");
    assertFalse(condition.contains("agentType"));
  }

  @Test
  void test_getAgentTypeCondition_singleAgentTypeWithComma() {
    ListFilter filter = new ListFilter();

    filter.addQueryParam("agentType", "CollateAI,");
    String condition = filter.getCondition("app_entity");

    assertTrue(condition.contains(":agentType_0"));
    assertEquals("CollateAI", filter.getQueryParams().get("agentType_0"));
    assertNull(filter.getQueryParams().get("agentType_1"));
  }

  @Test
  void test_serverIdConditionAppliesWhenServerIdParamPresent() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("serverId", "mcp-server-1");

    // The MCP execution time-series list/delete path builds its WHERE via the no-arg
    // getCondition() (null table name, to avoid a deleted-column clause time-series tables lack).
    // serverId is an MCP-execution-only query param, so gating the predicate on the table name
    // silently dropped the server scope and leaked other servers' rows into the result.
    assertTrue(filter.getCondition().contains("serverId = :serverId"));
    assertTrue(filter.getCondition("mcp_execution_entity").contains("serverId = :serverId"));

    ListFilter noServerId = new ListFilter();
    assertFalse(noServerId.getCondition().contains("serverId = :serverId"));
  }

  /**
   * `?service=` filtering must bind two related patterns:
   *   - {@code :serviceHash} for "any descendant of the service" — used by every
   *     service-filtered listing's WHERE clause via getFqnPrefixCondition.
   *   - {@code :serviceHashChild} for "any descendant strictly below the immediate
   *     level" — used by the root listing to negate descendants and keep only
   *     direct children.
   *
   * Both binds must reflect the same MD5 prefix, only differing in the LIKE pattern's
   * tail. This is the contract that ContainerDAO.listRoot{Before,After,Count} relies on.
   */
  @Test
  void test_getServiceCondition_bindsBothPrefixAndChildDepthPatterns() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("service", "aws_s3");

    String condition = filter.getCondition("storage_container_entity");
    assertTrue(
        condition.contains("storage_container_entity.fqnHash LIKE :serviceHash"),
        "WHERE clause should reference the service prefix LIKE bind. Got: " + condition);

    String hashLike = (String) filter.getQueryParams().get("serviceHash");
    String hashLikeChild = (String) filter.getQueryParams().get("serviceHashChild");
    assertNotNull(hashLike, "serviceHash bind must be set when service is filtered");
    assertNotNull(hashLikeChild, "serviceHashChild bind must be set for depth-aware listings");

    // Both binds share the same hashed prefix; only the LIKE-pattern tail differs.
    // In ContainerDAO.listRoot* the SQL uses them as:
    //   fqnHash LIKE     :serviceHash       -- '<hash>.%'   matches all descendants
    //   fqnHash NOT LIKE :serviceHashChild  -- '<hash>.%.%' rejects depth >= 2
    // so the combination keeps only direct children (depth = 1).
    int prefixEnd = hashLike.indexOf('%');
    assertTrue(prefixEnd > 0, "serviceHash should be of form '<hash>.%', got: " + hashLike);
    String prefix = hashLike.substring(0, prefixEnd);
    assertEquals(prefix + "%", hashLike);
    assertEquals(prefix + "%.%", hashLikeChild);
  }

  /**
   * A service whose name contains a dot (e.g. {@code aws.s3}) must hash as a single
   * quoted segment rather than splitting into {@code aws} + {@code s3}. This is the
   * special-char handling the FQN parser provides via {@code quoteName}; the listing
   * SQL relies on the resulting hash matching what ContainerRepository writes at create
   * time. Regression guard: a previous quote-stripping pass produced two hashes for a
   * single dotted name and silently broke {@code ?service=...&root=true}.
   */
  @Test
  void test_getServiceCondition_dottedServiceNameUsesSingleHashedSegment() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("service", "aws.s3");
    filter.getCondition("storage_container_entity");

    String hashLike = (String) filter.getQueryParams().get("serviceHash");
    String hashLikeChild = (String) filter.getQueryParams().get("serviceHashChild");
    assertNotNull(hashLike);
    assertNotNull(hashLikeChild);

    // The MD5 of a single quoted segment is 32 hex chars; with the trailing ".%" suffix
    // the prefix bind is exactly 34 chars. Two-segment-or-more service names would
    // produce a longer prefix because each additional segment adds 33 chars (1 dot +
    // 32 hex). 34 confirms quoteName collapsed the dotted name into one segment.
    int prefixEnd = hashLike.indexOf('%');
    assertEquals(34, prefixEnd + 1, "Dotted service name should hash to exactly one segment");

    // The child bind must mirror this: same 33-char hashed prefix + ".%.%".
    int childPrefixEnd = hashLikeChild.indexOf('%');
    assertEquals(prefixEnd, childPrefixEnd, "Both binds must share the same prefix length");
  }

  /**
   * {@code ?root=true} without {@code ?service=} must not bind {@code :serviceHash}
   * either — confirming that the depth bind {@code :serviceHashChild} the
   * {@code ContainerDAO.listRoot*} SQL references is not silently produced by ListFilter
   * for a no-service call. The DAO override has to default this bind itself
   * ({@code rootListingParams}) so the SQL stays runnable. Regression guard for the
   * "GET /containers?root=true (no service) crashes with missing-named-parameter" bug.
   */
  @Test
  void test_noServiceFilter_doesNotBindServicePatterns() {
    ListFilter filter = new ListFilter().addQueryParam("root", "true");
    filter.getCondition("storage_container_entity");

    assertNull(
        filter.getQueryParams().get("serviceHash"),
        "serviceHash must not be bound when ?service= is absent");
    assertNull(
        filter.getQueryParams().get("serviceHashChild"),
        "serviceHashChild must not be bound when ?service= is absent — DAO defaults it");
  }

  /**
   * Confirms the `?include=` flag still routes through the standard <sqlCondition> slot
   * regardless of which entity-specific prefix filter is in use. This is the bridge the
   * Deleted-toggle UI relies on: the user's choice translates to {@code include=} on the
   * URL, which becomes a deleted clause inside the WHERE we share with the depth check.
   */
  @Test
  void test_includeIsHonouredAlongsideServicePrefix() {
    // Default (include = NON_DELETED) → AND deleted = FALSE
    ListFilter ndFilter = new ListFilter(Include.NON_DELETED).addQueryParam("service", "aws_s3");
    String ndCond = ndFilter.getCondition("storage_container_entity");
    assertTrue(ndCond.contains("storage_container_entity.deleted = FALSE"), ndCond);

    // ALL drops the deleted predicate altogether
    ListFilter allFilter = new ListFilter(Include.ALL).addQueryParam("service", "aws_s3");
    String allCond = allFilter.getCondition("storage_container_entity");
    assertFalse(allCond.contains("storage_container_entity.deleted = FALSE"), allCond);
    assertFalse(allCond.contains("storage_container_entity.deleted = TRUE"), allCond);

    // DELETED restricts to soft-deleted rows
    ListFilter delFilter = new ListFilter(Include.DELETED).addQueryParam("service", "aws_s3");
    String delCond = delFilter.getCondition("storage_container_entity");
    assertTrue(delCond.contains("storage_container_entity.deleted = TRUE"), delCond);
  }

  @Test
  void test_getTaskCreatedAtRangeCondition_bothBounds() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("taskStartTs", "1000");
    filter.addQueryParam("taskEndTs", "2000");
    String condition = filter.getCondition("task_entity");
    assertTrue(condition.contains("task_entity.createdAt >= 1000"), condition);
    assertTrue(condition.contains("task_entity.createdAt <= 2000"), condition);
  }

  @Test
  void test_getTaskCreatedAtRangeCondition_startOnly() {
    ListFilter filter = new ListFilter().addQueryParam("taskStartTs", "1000");
    String condition = filter.getCondition("task_entity");
    assertTrue(condition.contains("task_entity.createdAt >= 1000"), condition);
    assertFalse(condition.contains("createdAt <="), condition);
  }

  @Test
  void test_getTaskCreatedAtRangeCondition_endOnly() {
    ListFilter filter = new ListFilter().addQueryParam("taskEndTs", "2000");
    String condition = filter.getCondition("task_entity");
    assertTrue(condition.contains("task_entity.createdAt <= 2000"), condition);
    assertFalse(condition.contains("createdAt >="), condition);
  }

  @Test
  void test_getTaskCreatedAtRangeCondition_absentWhenNoParams() {
    String condition = new ListFilter().getCondition("task_entity");
    assertFalse(condition.contains("createdAt"), condition);
  }
}
