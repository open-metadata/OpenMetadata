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
class OntologyExtractorTest {

  @Mock LLMCompletionClient llmClient;

  @Test
  void deriveReturnsVerdictsFromLlm() {
    OntologyDerivation verdict =
        new OntologyDerivation(
            new OntologyVerdict(
                "CREATE",
                null,
                "Business",
                "Business glossary",
                "Churn",
                "Churn",
                "Customer churn rate",
                null,
                null,
                null),
            new OntologyVerdict("SKIP", null, null, null, null, null, null, null, null, null));
    when(llmClient.completeStructured(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(OntologyDerivation.class)))
        .thenReturn(List.of(verdict));

    OntologyExtractor extractor = new OntologyExtractor(llmClient);
    ContextMemory memory =
        new ContextMemory()
            .withTitle("Churn")
            .withQuestion("What is churn?")
            .withAnswer("Lost customers");
    OntologyDerivation result =
        extractor.derive(memory, new OntologyContext(List.of(), List.of(), List.of()));

    assertEquals("CREATE", result.termVerdict().action());
    assertEquals("SKIP", result.metricVerdict().action());
  }

  @Test
  void deriveReturnsSkipSkipWhenLlmReturnsEmptyList() {
    when(llmClient.completeStructured(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(OntologyDerivation.class)))
        .thenReturn(List.of());

    OntologyExtractor extractor = new OntologyExtractor(llmClient);
    ContextMemory memory = new ContextMemory().withTitle("Test").withQuestion("Q").withAnswer("A");
    OntologyDerivation result =
        extractor.derive(memory, new OntologyContext(List.of(), List.of(), List.of()));

    assertEquals(OntologyAction.SKIP, result.termVerdict().action());
    assertEquals(OntologyAction.SKIP, result.metricVerdict().action());
  }
}
