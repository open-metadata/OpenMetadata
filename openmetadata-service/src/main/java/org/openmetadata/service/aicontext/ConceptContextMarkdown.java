/*
 *  Copyright 2026 Collate
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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.aicontext.AIContextMarkdown.appendHeading;
import static org.openmetadata.service.aicontext.AIContextMarkdown.cell;

import java.time.Instant;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.type.aicontext.ColumnProfileSummary;
import org.openmetadata.schema.type.aicontext.ConceptBinding;
import org.openmetadata.schema.type.aicontext.ConceptContext;
import org.openmetadata.schema.type.aicontext.ConceptEvidence;
import org.openmetadata.schema.type.personaContext.ContextSection;

/** Markdown projection of the typed concept bundle; uses the same section choices as asset context. */
final class ConceptContextMarkdown {
  private ConceptContextMarkdown() {}

  static void append(
      StringBuilder markdown,
      ConceptContext concept,
      Set<ContextSection> sections,
      String prefix,
      String metricExpression) {
    if (sections.contains(ContextSection.SCHEMA)) {
      appendDefinition(markdown, concept, prefix, metricExpression);
      appendAttributes(markdown, concept, prefix);
      appendBindings(markdown, concept, prefix);
    }
    if (sections.contains(ContextSection.GLOSSARY_TERMS)) {
      appendRelations(markdown, concept, prefix);
    }
    if (sections.contains(ContextSection.PROFILE)) {
      appendProfiles(markdown, concept, prefix);
    }
    if (sections.contains(ContextSection.METRICS)) {
      AIContextMarkdown.appendKnowledgeSection(
          markdown, "Metrics", concept.getMetrics(), prefix, true);
    }
    if (sections.contains(ContextSection.ARTICLES)) {
      appendEvidence(markdown, concept, prefix);
    }
  }

  private static void appendDefinition(
      StringBuilder markdown, ConceptContext concept, String prefix, String metricExpression) {
    if (!nullOrEmpty(concept.getDefinition())) {
      appendHeading(markdown, prefix, "Concept Definition");
      if (metricExpression == null) {
        markdown.append('\n').append(PromptText.forPrompt(concept.getDefinition())).append('\n');
      } else {
        AIContextMarkdown.appendSqlBlock(markdown, metricExpression);
      }
    }
    if (!nullOrEmpty(concept.getSynonyms())) {
      markdown
          .append("\n**Synonyms:** ")
          .append(String.join(", ", concept.getSynonyms()))
          .append('\n');
    }
  }

  private static void appendAttributes(
      StringBuilder markdown, ConceptContext concept, String prefix) {
    if (!nullOrEmpty(concept.getAttributes())) {
      appendHeading(markdown, prefix, "Ontology Attributes");
      markdown.append("\n| Attribute | Type | Unit | Allowed values |\n|---|---|---|---|\n");
      for (OntologyAttribute attribute : concept.getAttributes()) {
        markdown
            .append("| ")
            .append(cell(attribute.getName()))
            .append(" | ")
            .append(attribute.getDataType() == null ? "" : attribute.getDataType().value())
            .append(" | ")
            .append(cell(attribute.getUnit()))
            .append(" | ")
            .append(
                cell(
                    attribute.getEnumValues() == null
                        ? ""
                        : String.join(", ", attribute.getEnumValues())))
            .append(" |\n");
      }
    }
  }

  private static void appendRelations(
      StringBuilder markdown, ConceptContext concept, String prefix) {
    if (!nullOrEmpty(concept.getRelatedTerms())) {
      appendHeading(markdown, prefix, "Related Terms");
      for (TermRelation relation : concept.getRelatedTerms()) {
        markdown
            .append("\n- ")
            .append(cell(relation.getRelationType()))
            .append(" → `")
            .append(cell(relation.getTerm().getFullyQualifiedName()))
            .append("`\n");
      }
    }
  }

  private static void appendBindings(
      StringBuilder markdown, ConceptContext concept, String prefix) {
    appendHeading(markdown, prefix, "Concept Bindings");
    markdown.append("\n| Asset | Type | Column | Data type |\n|---|---|---|---|\n");
    for (ConceptBinding binding : listOrEmpty(concept.getBindings())) {
      markdown
          .append("| ")
          .append(cell(binding.getAssetFqn()))
          .append(" | ")
          .append(cell(binding.getAssetType()))
          .append(" | ")
          .append(cell(binding.getColumn()))
          .append(" | ")
          .append(cell(binding.getDataType()))
          .append(" |\n");
    }
    listOrEmpty(concept.getBindings()).forEach(binding -> appendSamples(markdown, binding));
    if (Boolean.TRUE.equals(concept.getTruncated())) {
      markdown
          .append("\n_Bindings capped: showing ")
          .append(concept.getBindings().size())
          .append(" of ")
          .append(concept.getTotalBindings())
          .append(" bindings across ")
          .append(concept.getTotalAssets())
          .append(" visible assets; at most 10 assets and 25 bindings per asset._\n");
    }
  }

  private static void appendSamples(StringBuilder markdown, ConceptBinding binding) {
    if (!nullOrEmpty(binding.getSampleValues())) {
      String values =
          binding.getSampleValues().stream()
              .map(value -> value == null ? "NULL" : String.valueOf(value))
              .collect(Collectors.joining(", "));
      markdown
          .append("\nStored samples for `")
          .append(cell(binding.getColumn()))
          .append("`: ")
          .append(cell(values))
          .append(" (representative rows; never count or aggregate over them).\n");
    }
  }

  private static void appendProfiles(
      StringBuilder markdown, ConceptContext concept, String prefix) {
    boolean hasProfiles =
        listOrEmpty(concept.getBindings()).stream()
            .anyMatch(binding -> binding.getProfile() != null);
    if (hasProfiles) {
      appendHeading(markdown, prefix, "Bound Column Profiles");
      markdown.append("\n| Column | Null % | Distinct | Min | Max |\n|---|---|---|---|---|\n");
      for (ConceptBinding binding : concept.getBindings()) {
        if (binding.getProfile() != null) {
          appendProfile(markdown, binding);
        }
      }
    }
  }

  private static void appendProfile(StringBuilder markdown, ConceptBinding binding) {
    ColumnProfileSummary profile = binding.getProfile();
    markdown
        .append("| ")
        .append(cell(binding.getColumn()))
        .append(" | ")
        .append(
            profile.getNullProportion() == null
                ? ""
                : Math.round(profile.getNullProportion() * 100) + "%")
        .append(" | ")
        .append(profile.getDistinctCount() == null ? "" : profile.getDistinctCount())
        .append(" | ")
        .append(cell(profile.getMin()))
        .append(" | ")
        .append(cell(profile.getMax()))
        .append(" |\n");
  }

  private static void appendEvidence(
      StringBuilder markdown, ConceptContext concept, String prefix) {
    if (!nullOrEmpty(concept.getEvidence())) {
      appendHeading(markdown, prefix, "Saved Query Evidence");
      for (ConceptEvidence evidence : concept.getEvidence()) {
        markdown.append("\n- `").append(cell(evidence.getFullyQualifiedName())).append("`\n");
        if (evidence.getLastRunAt() != null) {
          markdown
              .append("Last run: ")
              .append(Instant.ofEpochMilli(evidence.getLastRunAt()))
              .append('\n');
        }
        if (evidence.getLastRunStatus() != null) {
          markdown.append("Status: ").append(cell(evidence.getLastRunStatus())).append('\n');
        }
        AIContextMarkdown.appendSqlBlock(markdown, evidence.getQuery());
        if (Boolean.TRUE.equals(evidence.getQueryTruncated())) {
          markdown.append("\n_Query excerpt; fetch the saved Query for the complete statement._\n");
        }
      }
    }
  }
}
