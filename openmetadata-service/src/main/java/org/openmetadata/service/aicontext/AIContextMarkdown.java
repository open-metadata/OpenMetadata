/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.aicontext;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.time.Instant;
import java.util.List;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.aicontext.ColumnProfileSummary;
import org.openmetadata.schema.type.aicontext.DataQuality;
import org.openmetadata.schema.type.aicontext.FieldContext;
import org.openmetadata.schema.type.aicontext.ForeignKey;
import org.openmetadata.schema.type.aicontext.JoinHint;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.type.aicontext.TableContext;

/**
 * Renders an {@link AIContext} as a self-describing markdown document for consumption by LLM agents,
 * following the Open Knowledge Format conventions: a YAML frontmatter block (type/title/tags/
 * timestamp) followed by structural sections (a {@code # Schema} table, foreign keys and frequent
 * joins as fully-qualified-name cross-links, business definitions, attached articles, and lineage).
 * Structural markdown is preferred over prose because it aids both human reading and agent retrieval.
 */
public final class AIContextMarkdown {
  private static final int MAX_CONTENT_CHARS = 2000;
  private static final int MAX_SUMMARY_CHARS = 150;

  private AIContextMarkdown() {}

  public static String render(AIContext context) {
    StringBuilder markdown = new StringBuilder();
    appendFrontmatter(markdown, context);
    appendDescription(markdown, context);
    appendAssetContext(markdown, context.getAssetContext());
    appendKnowledgeSection(markdown, "Business Definitions", context.getGlossaryTerms());
    appendKnowledgeSection(markdown, "Metrics", context.getMetrics());
    appendKnowledgeSection(markdown, "Knowledge Articles", context.getArticles());
    appendLineage(markdown, context);
    appendObservability(markdown, context.getObservability());
    return markdown.toString().strip() + "\n";
  }

  private static void appendObservability(StringBuilder markdown, Observability observability) {
    if (observability != null) {
      appendProfile(markdown, observability);
      appendDataQuality(markdown, observability.getDataQuality());
    }
  }

  private static void appendProfile(StringBuilder markdown, Observability observability) {
    boolean hasProfile =
        observability.getRowCount() != null || !nullOrEmpty(observability.getColumnProfiles());
    if (hasProfile) {
      markdown.append("\n# Data Profile\n");
      if (observability.getRowCount() != null) {
        markdown
            .append("\n**Row count:** ")
            .append(number(observability.getRowCount()))
            .append('\n');
      }
      appendColumnProfiles(markdown, observability.getColumnProfiles());
    }
  }

  private static void appendColumnProfiles(
      StringBuilder markdown, List<ColumnProfileSummary> columns) {
    if (!nullOrEmpty(columns)) {
      markdown.append("\n| Column | Null % | Distinct | Min | Max |\n");
      markdown.append("|--------|--------|----------|-----|-----|\n");
      for (ColumnProfileSummary column : columns) {
        markdown
            .append("| ")
            .append(cell(column.getName()))
            .append(" | ")
            .append(percent(column.getNullProportion()))
            .append(" | ")
            .append(number(column.getDistinctCount()))
            .append(" | ")
            .append(cell(column.getMin()))
            .append(" | ")
            .append(cell(column.getMax()))
            .append(" |\n");
      }
    }
  }

  private static void appendDataQuality(StringBuilder markdown, DataQuality dataQuality) {
    if (dataQuality != null) {
      markdown.append("\n# Data Quality\n\n");
      markdown
          .append("Tests — passed: ")
          .append(orZero(dataQuality.getPassed()))
          .append(", failed: ")
          .append(orZero(dataQuality.getFailed()))
          .append(", aborted: ")
          .append(orZero(dataQuality.getAborted()))
          .append('\n');
      if (dataQuality.getFailed() != null && dataQuality.getFailed() > 0) {
        markdown
            .append("\n> ")
            .append(dataQuality.getFailed())
            .append(
                " data-quality test(s) are currently failing on this asset — qualify any answer accordingly.\n");
      }
    }
  }

  private static String number(Double value) {
    return value == null
        ? ""
        : (value == Math.floor(value) ? Long.toString(value.longValue()) : value.toString());
  }

  private static String percent(Double proportion) {
    return proportion == null ? "" : Math.round(proportion * 100) + "%";
  }

  private static int orZero(Integer value) {
    return value == null ? 0 : value;
  }

  public static String renderFound(AIContextFinder.FoundContext found) {
    StringBuilder markdown = new StringBuilder();
    markdown.append("# Relevant Knowledge\n");
    for (KnowledgeItem item : found.items()) {
      markdown
          .append("\n### ")
          .append(labelOf(item))
          .append(" (")
          .append(typeLabel(item))
          .append(")\n");
      appendYamlInline(markdown, item.getFullyQualifiedName());
      appendKnowledgeContent(markdown, item);
    }
    if (!found.candidateAssets().isEmpty()) {
      markdown.append("\n# Candidate Assets\n\n");
      for (AIContextFinder.CandidateAsset asset : found.candidateAssets()) {
        markdown
            .append("- `")
            .append(asset.fullyQualifiedName())
            .append("` (")
            .append(asset.entityType())
            .append(") — via `")
            .append(asset.via())
            .append("`\n");
      }
    }
    return markdown.toString().strip() + "\n";
  }

  private static String typeLabel(KnowledgeItem item) {
    return item.getType() == null
        ? ""
        : switch (item.getType()) {
          case GLOSSARY_TERM -> "Glossary Term";
          case METRIC -> "Metric";
          case PAGE -> "Article";
          case CONTEXT_MEMORY -> "Knowledge Pill";
        };
  }

  private static void appendFrontmatter(StringBuilder markdown, AIContext context) {
    markdown.append("---\n");
    appendYaml(markdown, "type", context.getEntityType());
    appendYaml(markdown, "title", titleOf(context));
    appendYaml(markdown, "description", summaryOf(context.getDescription()));
    appendYaml(markdown, "fullyQualifiedName", context.getFullyQualifiedName());
    if (context.getResource() != null) {
      appendYaml(markdown, "resource", context.getResource().toString());
    }
    if (!nullOrEmpty(context.getTags())) {
      markdown.append("tags: [");
      for (int i = 0; i < context.getTags().size(); i++) {
        if (i > 0) {
          markdown.append(", ");
        }
        markdown.append(yamlQuote(context.getTags().get(i)));
      }
      markdown.append("]\n");
    }
    if (context.getGeneratedAt() != null) {
      appendYaml(markdown, "timestamp", Instant.ofEpochMilli(context.getGeneratedAt()).toString());
    }
    markdown.append("---\n");
  }

  /**
   * The OKF {@code description} frontmatter key is a one-line summary; the full description stays
   * in the body. Takes the first line and bounds it so previews and index generators stay compact.
   */
  private static String summaryOf(String description) {
    String summary = null;
    if (!nullOrEmpty(description)) {
      String firstLine = description.strip().split("\n", 2)[0].strip();
      summary =
          firstLine.length() > MAX_SUMMARY_CHARS
              ? firstLine.substring(0, MAX_SUMMARY_CHARS) + "…"
              : firstLine;
    }
    return summary;
  }

  /**
   * Double-quotes a frontmatter scalar so YAML-significant characters in display names or FQNs
   * (quotes, colons, newlines) cannot break the document for downstream parsers.
   */
  private static String yamlQuote(String value) {
    return '"'
        + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ")
        + '"';
  }

  private static String titleOf(AIContext context) {
    return !nullOrEmpty(context.getDisplayName())
        ? context.getDisplayName()
        : context.getFullyQualifiedName();
  }

  private static void appendYaml(StringBuilder markdown, String key, String value) {
    if (!nullOrEmpty(value)) {
      markdown.append(key).append(": ").append(yamlQuote(value)).append('\n');
    }
  }

  private static void appendDescription(StringBuilder markdown, AIContext context) {
    if (!nullOrEmpty(context.getDescription())) {
      markdown.append('\n').append(context.getDescription().strip()).append('\n');
    }
  }

  private static void appendAssetContext(StringBuilder markdown, AssetContext assetContext) {
    if (assetContext != null && assetContext.getTable() != null) {
      appendTableContext(markdown, assetContext.getTable());
    }
  }

  private static void appendTableContext(StringBuilder markdown, TableContext table) {
    appendSchemaTable(markdown, table.getColumns());
    if (!nullOrEmpty(table.getPrimaryKey())) {
      markdown
          .append("\n**Primary key:** ")
          .append(String.join(", ", table.getPrimaryKey()))
          .append('\n');
    }
    appendForeignKeys(markdown, table.getForeignKeys());
    appendJoins(markdown, table.getFrequentJoins());
    if (!nullOrEmpty(table.getPartitionColumns())) {
      markdown
          .append("\n**Partitioned by:** ")
          .append(String.join(", ", table.getPartitionColumns()))
          .append('\n');
    }
  }

  private static void appendSchemaTable(StringBuilder markdown, List<FieldContext> columns) {
    if (nullOrEmpty(columns)) {
      return;
    }
    markdown.append("\n# Schema\n\n");
    markdown.append("| Column | Type | Constraint | Description |\n");
    markdown.append("|--------|------|------------|-------------|\n");
    for (FieldContext column : columns) {
      markdown
          .append("| ")
          .append(cell(column.getName()))
          .append(" | ")
          .append(cell(column.getDataType()))
          .append(" | ")
          .append(cell(column.getConstraint()))
          .append(" | ")
          .append(cell(column.getDescription()))
          .append(" |\n");
    }
  }

  private static void appendForeignKeys(StringBuilder markdown, List<ForeignKey> foreignKeys) {
    if (nullOrEmpty(foreignKeys)) {
      return;
    }
    markdown.append("\n# Foreign Keys\n\n");
    for (ForeignKey foreignKey : foreignKeys) {
      markdown
          .append("- `")
          .append(joinNonBlank(foreignKey.getColumns()))
          .append("` → `")
          .append(joinNonBlank(foreignKey.getReferredColumns()))
          .append('`')
          .append(cardinalitySuffix(foreignKey.getRelationshipType()))
          .append('\n');
    }
  }

  /** Joins column names defensively: a malformed constraint with null/blank entries must not
   * render "null" into (or fail) the whole context response. */
  private static String joinNonBlank(List<String> values) {
    StringBuilder joined = new StringBuilder();
    for (String value : values == null ? List.<String>of() : values) {
      if (!nullOrEmpty(value)) {
        if (joined.length() > 0) {
          joined.append(", ");
        }
        joined.append(value);
      }
    }
    return joined.toString();
  }

  private static String cardinalitySuffix(String relationshipType) {
    return nullOrEmpty(relationshipType) ? "" : " (" + relationshipType + ")";
  }

  private static void appendJoins(StringBuilder markdown, List<JoinHint> joins) {
    if (nullOrEmpty(joins)) {
      return;
    }
    markdown.append("\n# Frequent Joins\n\n");
    for (JoinHint join : joins) {
      markdown
          .append("- `")
          .append(cell(join.getColumn()))
          .append("` ↔ `")
          .append(cell(join.getJoinedWith()))
          .append('`')
          .append(join.getJoinCount() == null ? "" : " (" + join.getJoinCount() + "×)")
          .append('\n');
    }
  }

  private static void appendKnowledgeSection(
      StringBuilder markdown, String heading, List<KnowledgeItem> items) {
    if (nullOrEmpty(items)) {
      return;
    }
    markdown.append("\n# ").append(heading).append("\n");
    for (KnowledgeItem item : items) {
      markdown.append("\n### ").append(labelOf(item)).append('\n');
      appendYamlInline(markdown, item.getFullyQualifiedName());
      appendKnowledgeContent(markdown, item);
    }
  }

  /**
   * Renders a knowledge item's body, appending a retrieval hint whenever the content was excerpted
   * or omitted to fit the context budget, so the agent knows the full text is a fetch away.
   */
  private static void appendKnowledgeContent(StringBuilder markdown, KnowledgeItem item) {
    if (!nullOrEmpty(item.getContent())) {
      markdown.append('\n').append(truncate(item.getContent().strip())).append('\n');
    }
    if (Boolean.TRUE.equals(item.getContentTruncated())) {
      markdown
          .append("\n_Excerpt — fetch the full content with get_knowledge_content(type=`")
          .append(item.getType() == null ? "" : item.getType().value())
          .append("`, fqn=`")
          .append(nullOrEmpty(item.getFullyQualifiedName()) ? "" : item.getFullyQualifiedName())
          .append("`)._\n");
    }
  }

  private static void appendYamlInline(StringBuilder markdown, String fqn) {
    if (!nullOrEmpty(fqn)) {
      markdown.append('`').append(fqn).append("`\n");
    }
  }

  private static String labelOf(KnowledgeItem item) {
    return !nullOrEmpty(item.getDisplayName()) ? item.getDisplayName() : item.getName();
  }

  private static void appendLineage(StringBuilder markdown, AIContext context) {
    boolean hasLineage =
        !nullOrEmpty(context.getUpstream()) || !nullOrEmpty(context.getDownstream());
    if (hasLineage) {
      markdown.append("\n# Lineage\n\n");
      if (!nullOrEmpty(context.getUpstream())) {
        markdown.append("**Upstream:** ").append(codeJoin(context.getUpstream())).append('\n');
      }
      if (!nullOrEmpty(context.getDownstream())) {
        markdown.append("**Downstream:** ").append(codeJoin(context.getDownstream())).append('\n');
      }
    }
  }

  private static String codeJoin(List<String> values) {
    StringBuilder joined = new StringBuilder();
    for (int i = 0; i < values.size(); i++) {
      if (i > 0) {
        joined.append(", ");
      }
      joined.append('`').append(values.get(i)).append('`');
    }
    return joined.toString();
  }

  private static String cell(String value) {
    return nullOrEmpty(value) ? "" : value.replace("|", "\\|").replace("\n", " ").strip();
  }

  private static String truncate(String value) {
    return value.length() > MAX_CONTENT_CHARS ? value.substring(0, MAX_CONTENT_CHARS) + "…" : value;
  }
}
