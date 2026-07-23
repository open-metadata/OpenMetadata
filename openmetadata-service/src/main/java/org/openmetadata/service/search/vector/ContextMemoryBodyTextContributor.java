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
package org.openmetadata.service.search.vector;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.VectorDocBuilder.BodyTextExtractor;

/**
 * Body text contributor for {@link ContextMemory}. The semantic payload of a memory lives in its
 * title, summary, question, and answer fields, not in {@code description}, so the default
 * description-only extractor would feed near-empty text to the embedding model. This contributor
 * concatenates the populated memory fields into a labelled body so the vector represents the
 * actual Q/A content.
 */
public final class ContextMemoryBodyTextContributor implements VectorBodyTextContributor {

  public static final ContextMemoryBodyTextContributor INSTANCE =
      new ContextMemoryBodyTextContributor();

  private ContextMemoryBodyTextContributor() {}

  @Override
  public String entityType() {
    return Entity.CONTEXT_MEMORY;
  }

  @Override
  public BodyTextExtractor extractor() {
    return ContextMemoryBodyTextContributor::extractBodyText;
  }

  static String extractBodyText(EntityInterface entity) {
    if (!(entity instanceof ContextMemory memory)) {
      return null;
    }
    List<String> parts = new ArrayList<>();
    appendIfPresent(parts, "title", memory.getTitle());
    appendIfPresent(parts, "summary", memory.getSummary());
    appendIfPresent(parts, "question", memory.getQuestion());
    appendIfPresent(parts, "answer", memory.getAnswer());
    appendIfPresent(parts, "description", memory.getDescription());
    return parts.isEmpty() ? "" : String.join("; ", parts);
  }

  private static void appendIfPresent(List<String> parts, String label, String value) {
    if (value == null || value.isBlank()) {
      return;
    }
    parts.add(label + ": " + value.strip());
  }
}
