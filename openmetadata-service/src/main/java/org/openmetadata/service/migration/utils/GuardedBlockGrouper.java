package org.openmetadata.service.migration.utils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Groups each MySQL guarded block into one {@link SqlUnit}: the {@code SET @v} statements that
 * build the DDL, then {@code PREPARE n FROM @v}, {@code EXECUTE n} and an optional {@code
 * DEALLOCATE PREPARE n}. A malformed block fails when the file is parsed, not half way through a
 * migration. The authoring rule is ADR:2026-10-22-mysql-guarded-blocks-run-as-one-migration-unit.
 */
final class GuardedBlockGrouper {
  private static final Pattern LEADING_COMMENTS =
      Pattern.compile("\\A(?:\\s*(?:--[^\\n]*|#[^\\n]*|/\\*(?!!).*?\\*/))*\\s*", Pattern.DOTALL);
  private static final Pattern SET_VARIABLE =
      Pattern.compile("\\ASET\\s+@(\\w+)\\s*:?=", Pattern.CASE_INSENSITIVE);
  private static final Pattern PREPARE =
      Pattern.compile("\\APREPARE\\s+`?(\\w+)`?\\s+FROM\\s+@(\\w+)", Pattern.CASE_INSENSITIVE);
  private static final Pattern EXECUTE =
      Pattern.compile("\\AEXECUTE\\s+`?(\\w+)`?", Pattern.CASE_INSENSITIVE);
  private static final Pattern DEALLOCATE =
      Pattern.compile("\\A(?:DEALLOCATE|DROP)\\s+PREPARE\\s+`?(\\w+)`?", Pattern.CASE_INSENSITIVE);
  private static final int SNIPPET_LENGTH = 120;

  private enum State {
    OUTSIDE_BLOCK,
    PREPARED,
    EXECUTED
  }

  private final String source;
  private final List<SqlUnit> units = new ArrayList<>();
  private final List<String> pendingSets = new ArrayList<>();
  private final Set<String> pendingVariables = new HashSet<>();
  private List<String> block = new ArrayList<>();
  private String blockName;
  private State state = State.OUTSIDE_BLOCK;

  private GuardedBlockGrouper(String source) {
    this.source = source;
  }

  static List<SqlUnit> group(List<String> statements, String source) {
    GuardedBlockGrouper grouper = new GuardedBlockGrouper(source);
    statements.forEach(grouper::accept);
    grouper.finish();
    return grouper.units;
  }

  private void accept(String statement) {
    String body = LEADING_COMMENTS.matcher(statement).replaceFirst("");
    if (state == State.EXECUTED && deallocatesBlock(body)) {
      block.add(statement);
      closeBlock();
      return;
    }
    if (state == State.EXECUTED) {
      closeBlock();
    }
    if (state == State.PREPARED) {
      acceptExecute(statement, body);
      return;
    }
    acceptOutsideBlock(statement, body);
  }

  private boolean deallocatesBlock(String body) {
    Matcher deallocate = DEALLOCATE.matcher(body);
    return deallocate.find() && deallocate.group(1).equalsIgnoreCase(blockName);
  }

  private void acceptExecute(String statement, String body) {
    Matcher execute = EXECUTE.matcher(body);
    if (!execute.find() || !execute.group(1).equalsIgnoreCase(blockName)) {
      throw malformed(
          "PREPARE " + blockName + " must be followed by EXECUTE " + blockName, statement);
    }
    block.add(statement);
    state = State.EXECUTED;
  }

  private void acceptOutsideBlock(String statement, String body) {
    Matcher set = SET_VARIABLE.matcher(body);
    if (set.find()) {
      pendingSets.add(statement);
      pendingVariables.add(set.group(1).toLowerCase(Locale.ROOT));
      return;
    }
    Matcher prepare = PREPARE.matcher(body);
    if (prepare.find()) {
      openBlock(statement, prepare);
      return;
    }
    rejectOutsideBlock(statement, body);
    units.add(SqlUnit.of(statement));
  }

  private void openBlock(String statement, Matcher prepare) {
    if (!pendingVariables.contains(prepare.group(2).toLowerCase(Locale.ROOT))) {
      throw malformed(
          "PREPARE must read a variable set by the SET @ statements before it", statement);
    }
    block = new ArrayList<>(pendingSets);
    block.add(statement);
    blockName = prepare.group(1);
    pendingSets.clear();
    pendingVariables.clear();
    state = State.PREPARED;
  }

  private void rejectOutsideBlock(String statement, String body) {
    if (EXECUTE.matcher(body).find() || DEALLOCATE.matcher(body).find()) {
      throw malformed("EXECUTE or DEALLOCATE without the PREPARE right before it", statement);
    }
    if (!pendingSets.isEmpty()) {
      throw malformed("SET @ must be followed by the PREPARE that reads it", pendingSets.get(0));
    }
  }

  private void closeBlock() {
    units.add(new SqlUnit(block));
    block = new ArrayList<>();
    blockName = null;
    state = State.OUTSIDE_BLOCK;
  }

  private void finish() {
    if (state == State.PREPARED) {
      throw malformed("the file ends before EXECUTE " + blockName, block.get(block.size() - 1));
    }
    if (state == State.EXECUTED) {
      closeBlock();
    }
    if (!pendingSets.isEmpty()) {
      throw malformed("SET @ must be followed by the PREPARE that reads it", pendingSets.get(0));
    }
  }

  private IllegalStateException malformed(String reason, String statement) {
    String body = LEADING_COMMENTS.matcher(statement).replaceFirst("").replaceAll("\\s+", " ");
    String snippet = body.length() > SNIPPET_LENGTH ? body.substring(0, SNIPPET_LENGTH) : body;
    return new IllegalStateException(
        String.format("Malformed guarded block in %s: %s, at: %s", source, reason, snippet));
  }
}
