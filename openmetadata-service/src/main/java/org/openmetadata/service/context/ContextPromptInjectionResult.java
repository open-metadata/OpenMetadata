package org.openmetadata.service.context;

import java.util.List;
import org.openmetadata.schema.type.EntityReference;

/** Result of assembling structured entity context for AskCollate prompt injection. */
public record ContextPromptInjectionResult(
    String formattedContext, List<EntityReference> usedEntityRefs, int totalTokens) {

  public static ContextPromptInjectionResult empty() {
    return new ContextPromptInjectionResult("", List.of(), 0);
  }
}
