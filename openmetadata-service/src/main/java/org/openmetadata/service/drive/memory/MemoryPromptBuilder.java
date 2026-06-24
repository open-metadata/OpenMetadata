/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.memory;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;

/** Renders a compact user-prompt from a ContextMemory and its grounding candidates. */
final class MemoryPromptBuilder {
  private MemoryPromptBuilder() {}

  static String build(ContextMemory memory, MemoryContext context) {
    return renderMemory(memory)
        + "EXISTING GLOSSARY TERMS\n"
        + renderCandidates(context.terms())
        + "\n"
        + "EXISTING METRICS\n"
        + renderCandidates(context.metrics())
        + "\n"
        + "AVAILABLE GLOSSARIES (reuse one; do not mint near-duplicates)\n"
        + renderCandidates(context.glossaries())
        + "\n"
        + "SAME-DOCUMENT TERMS (reuse these, or relate to them via termVerdict.relatedTerms)\n"
        + renderCandidates(context.siblingTerms())
        + "\n"
        + renderRelationTypes()
        + "\n"
        + renderMetricEnums();
  }

  private static String renderRelationTypes() {
    return "ALLOWED RELATION TYPES (relatedTerms[].relationType; direction is \"this term <type> target\")\n"
        + String.join(", ", GlossaryTermRepository.DEFAULT_RELATION_TYPES)
        + "\n";
  }

  private static String renderMetricEnums() {
    return "ALLOWED METRIC ENUMS (use exactly one value or null)\n"
        + "metricType: "
        + enumValues(MetricType.values())
        + "\n"
        + "unitOfMeasurement: "
        + enumValues(MetricUnitOfMeasurement.values())
        + "\n";
  }

  private static <E extends Enum<E>> String enumValues(E[] values) {
    final List<String> out = new ArrayList<>();
    for (final E value : values) {
      out.add(value.toString());
    }
    return String.join(", ", out);
  }

  private static String renderMemory(ContextMemory memory) {
    return "MEMORY\n"
        + "title: "
        + StringUtils.defaultString(memory.getTitle())
        + "\n"
        + "question: "
        + StringUtils.defaultString(memory.getQuestion())
        + "\n"
        + "answer: "
        + StringUtils.defaultString(memory.getAnswer())
        + "\n\n";
  }

  private static String renderCandidates(List<MemoryCandidate> candidates) {
    String result = "(none)\n";
    if (!nullOrEmpty(candidates)) {
      StringBuilder sb = new StringBuilder();
      for (MemoryCandidate c : candidates) {
        sb.append(c.fqn())
            .append(" — ")
            .append(c.name())
            .append(" — ")
            .append(StringUtils.defaultString(c.description()))
            .append("\n");
      }
      result = sb.toString();
    }
    return result;
  }
}
