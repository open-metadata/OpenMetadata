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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMProvider;
import org.openmetadata.service.llm.LLMClientHolder;

class OntologyAiAvailabilityTest {
  @AfterEach
  void resetLlm() {
    LLMClientHolder.initialize(null);
  }

  @Test
  void ontologyAiNeedsTheRdfFlagAndAnEnabledModel() {
    enableLlm(false);

    assertFalse(OntologyAiAvailability.isEnabled(null));
    assertFalse(OntologyAiAvailability.isEnabled(new RdfConfiguration()));
    assertTrue(OntologyAiAvailability.isEnabled(new RdfConfiguration().withAiEnabled(true)));

    LLMClientHolder.initialize(null);
    assertFalse(OntologyAiAvailability.isEnabled(new RdfConfiguration().withAiEnabled(true)));
  }

  @Test
  void legacyAskCollateFlagStillEnablesOntologyAi() {
    enableLlm(false);

    assertTrue(
        OntologyAiAvailability.isEnabled(new RdfConfiguration().withAskCollateEnabled(true)));
  }

  @Test
  void memoryDerivationAlsoNeedsItsOwnFlag() {
    final RdfConfiguration rdf = new RdfConfiguration().withAiEnabled(true);

    enableLlm(false);
    assertFalse(OntologyAiAvailability.isMemoryDerivationEnabled(rdf));
    enableLlm(true);
    assertTrue(OntologyAiAvailability.isMemoryDerivationEnabled(rdf));
    assertFalse(OntologyAiAvailability.isMemoryDerivationEnabled(new RdfConfiguration()));
  }

  private static void enableLlm(final boolean memoryDerivation) {
    LLMClientHolder.initialize(
        new LLMConfiguration()
            .withEnabled(true)
            .withProvider(LLMProvider.NOOP)
            .withOntologyMemoryDerivationEnabled(memoryDerivation));
  }
}
