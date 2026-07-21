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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.BuildOntologySubset;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.OntologyLayer;

class OntologySubsetValidatorTest {
  private final OntologySubsetValidator validator = new OntologySubsetValidator();

  @Test
  void acceptsFoundationalSourceForAnApplicationModel() {
    assertDoesNotThrow(
        () ->
            validator.validate(
                OntologySubsetTestFixtures.sourceGlossary(),
                OntologySubsetTestFixtures.targetGlossary(),
                OntologySubsetTestFixtures.request(false)));
  }

  @Test
  void rejectsSameModelReadOnlyTargetAndDownwardDependency() {
    final Glossary source = OntologySubsetTestFixtures.sourceGlossary();
    final Glossary target = OntologySubsetTestFixtures.targetGlossary();

    assertThrows(
        BadRequestException.class,
        () -> validator.validate(source, source, OntologySubsetTestFixtures.request(false)));

    target.getOntologyConfiguration().setReadOnly(true);
    assertThrows(
        BadRequestException.class,
        () -> validator.validate(source, target, OntologySubsetTestFixtures.request(false)));

    target.getOntologyConfiguration().setReadOnly(false);
    source.getOntologyConfiguration().setLayer(OntologyLayer.L_3);
    target.getOntologyConfiguration().setLayer(OntologyLayer.L_1);
    assertThrows(
        BadRequestException.class,
        () -> validator.validate(source, target, OntologySubsetTestFixtures.request(false)));
  }

  @Test
  void rejectsUnpinnedModelsAndEmptySelection() {
    final Glossary source = OntologySubsetTestFixtures.sourceGlossary().withVersion(null);
    final Glossary target = OntologySubsetTestFixtures.targetGlossary();
    final BuildOntologySubset empty =
        OntologySubsetTestFixtures.request(false).withSourceTermIds(Set.of());

    assertThrows(
        BadRequestException.class,
        () -> validator.validate(source, target, OntologySubsetTestFixtures.request(false)));
    source.setVersion(0.4D);
    assertThrows(BadRequestException.class, () -> validator.validate(source, target, empty));
  }
}
