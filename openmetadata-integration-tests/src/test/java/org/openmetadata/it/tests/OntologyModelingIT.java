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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.OntologyIriPreview;
import org.openmetadata.schema.api.data.OntologyIriPreviewRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyModelingIT {
  private static final UUID CANDIDATE_ID = UUID.fromString("13786df5-8d21-4ccb-a792-e3fdd888341e");

  @AfterEach
  void cleanup(TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void previewsGovernedIriFromPersistedGlossaryConfiguration(TestNamespace namespace) {
    OntologyConfiguration configuration =
        new OntologyConfiguration()
            .withBaseIri(URI.create("https://example.org/finance/"))
            .withLayer(OntologyLayer.L_3)
            .withImports(List.of())
            .withPrefixes(List.of())
            .withIriMintingPattern("concept/{term}/{uuid}")
            .withReadOnly(false)
            .withInstalledPacks(List.of());
    Glossary glossary =
        namespace.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(namespace.prefix("modeledGlossary"))
                        .withDescription("Governed IRI model")
                        .withOntologyConfiguration(configuration)));
    OntologyIriPreviewRequest request =
        new OntologyIriPreviewRequest()
            .withGlossaryId(glossary.getId())
            .withTermName("Counterparty Risk")
            .withCandidateId(CANDIDATE_ID);

    OntologyIriPreview preview = SdkClients.adminClient().ontologyModeling().previewIri(request);

    assertEquals(
        URI.create("https://example.org/finance/concept/Counterparty%20Risk/" + CANDIDATE_ID),
        preview.getIri());
    assertEquals("Counterparty%20Risk", preview.getTermSegment());
  }
}
