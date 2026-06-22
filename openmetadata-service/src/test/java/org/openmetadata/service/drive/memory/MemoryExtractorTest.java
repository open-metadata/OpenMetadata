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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.service.llm.LLMCompletionClient;

@ExtendWith(MockitoExtension.class)
class MemoryExtractorTest {

  @Mock LLMCompletionClient llmClient;

  @Test
  void deriveReturnsVerdictsFromLlm() {
    MemoryDerivation verdict =
        new MemoryDerivation(
            new MemoryVerdict(
                MemoryAction.CREATE,
                null,
                "Business",
                "Business glossary",
                "Churn",
                "Churn",
                "Customer churn rate",
                null,
                null,
                null),
            new MemoryVerdict(
                MemoryAction.SKIP, null, null, null, null, null, null, null, null, null));
    when(llmClient.completeStructured(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(MemoryDerivation.class)))
        .thenReturn(List.of(verdict));

    MemoryExtractor extractor = new MemoryExtractor(llmClient);
    ContextMemory memory =
        new ContextMemory()
            .withTitle("Churn")
            .withQuestion("What is churn?")
            .withAnswer("Lost customers");
    MemoryDerivation result =
        extractor.derive(memory, new MemoryContext(List.of(), List.of(), List.of()));

    assertEquals(MemoryAction.CREATE, result.termVerdict().action());
    assertEquals(MemoryAction.SKIP, result.metricVerdict().action());
  }

  @Test
  void deriveReturnsSkipSkipWhenLlmReturnsEmptyList() {
    when(llmClient.completeStructured(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(MemoryDerivation.class)))
        .thenReturn(List.of());

    MemoryExtractor extractor = new MemoryExtractor(llmClient);
    ContextMemory memory = new ContextMemory().withTitle("Test").withQuestion("Q").withAnswer("A");
    MemoryDerivation result =
        extractor.derive(memory, new MemoryContext(List.of(), List.of(), List.of()));

    assertEquals(MemoryAction.SKIP, result.termVerdict().action());
    assertEquals(MemoryAction.SKIP, result.metricVerdict().action());
  }
}
