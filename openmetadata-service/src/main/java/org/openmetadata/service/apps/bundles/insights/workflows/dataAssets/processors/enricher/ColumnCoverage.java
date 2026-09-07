package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayDeque;
import java.util.List;
import java.util.Locale;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;

/** Recursive counters preserve coverage without indexing an unbounded tree of column field paths. */
public record ColumnCoverage(long total, long described, long glossaryLinked, long piiClassified) {
  public static final String FIELD = "columnCoverage";
  private static final String PII_PREFIX = "pii.";

  public static ColumnCoverage from(List<Column> columns) {
    ArrayDeque<Column> pending = new ArrayDeque<>(listOrEmpty(columns));
    long total = 0;
    long described = 0;
    long glossaryLinked = 0;
    long piiClassified = 0;
    while (!pending.isEmpty()) {
      Column column = pending.removeFirst();
      total++;
      described += column.getDescription() != null && !column.getDescription().isBlank() ? 1 : 0;
      glossaryLinked += hasGlossaryTerm(column) ? 1 : 0;
      piiClassified += hasPiiDecision(column) ? 1 : 0;
      pending.addAll(listOrEmpty(column.getChildren()));
    }
    return new ColumnCoverage(total, described, glossaryLinked, piiClassified);
  }

  private static boolean hasGlossaryTerm(Column column) {
    return listOrEmpty(column.getTags()).stream()
        .anyMatch(tag -> tag.getSource() == TagSource.GLOSSARY);
  }

  private static boolean hasPiiDecision(Column column) {
    return listOrEmpty(column.getTags()).stream()
        .map(TagLabel::getTagFQN)
        .anyMatch(fqn -> fqn != null && fqn.toLowerCase(Locale.ROOT).startsWith(PII_PREFIX));
  }
}
