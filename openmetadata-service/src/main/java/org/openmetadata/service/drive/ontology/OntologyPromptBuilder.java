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

package org.openmetadata.service.drive.ontology;

import java.util.List;
import org.openmetadata.schema.entity.context.ContextMemory;

/** Renders a compact user-prompt from a ContextMemory and its grounding candidates. */
final class OntologyPromptBuilder {
  private OntologyPromptBuilder() {}

  static String build(ContextMemory memory, OntologyContext context) {
    return "MEMORY\n"
        + "title: "
        + nullToEmpty(memory.getTitle())
        + "\n"
        + "question: "
        + nullToEmpty(memory.getQuestion())
        + "\n"
        + "answer: "
        + nullToEmpty(memory.getAnswer())
        + "\n\n"
        + "EXISTING GLOSSARY TERMS\n"
        + renderCandidates(context.terms())
        + "\n"
        + "EXISTING METRICS\n"
        + renderCandidates(context.metrics())
        + "\n"
        + "AVAILABLE GLOSSARIES\n"
        + renderCandidates(context.glossaries());
  }

  private static String renderCandidates(List<OntologyCandidate> candidates) {
    String result = "(none)\n";
    if (candidates != null && !candidates.isEmpty()) {
      StringBuilder sb = new StringBuilder();
      for (OntologyCandidate c : candidates) {
        sb.append(c.fqn())
            .append(" — ")
            .append(c.name())
            .append(" — ")
            .append(nullToEmpty(c.description()))
            .append("\n");
      }
      result = sb.toString();
    }
    return result;
  }

  private static String nullToEmpty(String s) {
    return s == null ? "" : s;
  }
}
