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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyIriPreview;
import org.openmetadata.schema.api.data.OntologyIriPreviewRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.OntologyConfiguration;

class OntologyIriMinterTest {
  private static final UUID GLOSSARY_ID = UUID.fromString("209fd87f-1e64-4197-9264-3d9a8bd42a62");
  private static final UUID CANDIDATE_ID = UUID.fromString("78ba2f96-3584-4429-850f-cef7d4f5d876");

  @Test
  void expandsEverySupportedPlaceholderAndEncodesSegments() {
    Glossary glossary = glossary("Financial Risk", "models/{glossary}/{term}/{uuid}");
    OntologyIriPreviewRequest request =
        new OntologyIriPreviewRequest()
            .withGlossaryId(GLOSSARY_ID)
            .withTermName("Counterparty Risk")
            .withCandidateId(CANDIDATE_ID);

    OntologyIriPreview preview = new OntologyIriMinter().preview(glossary, request);

    assertEquals("Counterparty%20Risk", preview.getTermSegment());
    assertEquals(
        URI.create(
            "https://example.org/models/Financial%20Risk/Counterparty%20Risk/" + CANDIDATE_ID),
        preview.getIri());
    assertEquals(CANDIDATE_ID, preview.getCandidateId());
  }

  @Test
  void rejectsUnknownOrMalformedPlaceholders() {
    Glossary unknown = glossary("Risk", "{term}/{unsupported}");
    Glossary malformed = glossary("Risk", "{term");
    OntologyIriPreviewRequest request = request();

    assertThrows(
        BadRequestException.class, () -> new OntologyIriMinter().preview(unknown, request));
    assertThrows(
        BadRequestException.class, () -> new OntologyIriMinter().preview(malformed, request));
  }

  @Test
  void rejectsRelativeBaseIri() {
    OntologyConfiguration configuration =
        new OntologyConfiguration()
            .withBaseIri(URI.create("relative"))
            .withIriMintingPattern("{term}");

    assertThrows(
        BadRequestException.class, () -> OntologyIriMinter.validateConfiguration(configuration));
  }

  private static Glossary glossary(final String name, final String pattern) {
    OntologyConfiguration configuration =
        new OntologyConfiguration()
            .withBaseIri(URI.create("https://example.org/"))
            .withIriMintingPattern(pattern);
    return new Glossary()
        .withId(GLOSSARY_ID)
        .withName(name)
        .withOntologyConfiguration(configuration);
  }

  private static OntologyIriPreviewRequest request() {
    return new OntologyIriPreviewRequest()
        .withGlossaryId(GLOSSARY_ID)
        .withTermName("Risk")
        .withCandidateId(CANDIDATE_ID);
  }
}
