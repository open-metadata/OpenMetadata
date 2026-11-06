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
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.MeasuredKpiPatternInput;
import org.openmetadata.schema.api.data.OntologyPatternType;

class OntologyPatternRequestValidatorTest {
  private final OntologyPatternRequestValidator validator = new OntologyPatternRequestValidator();

  @ParameterizedTest
  @MethodSource("validRequests")
  void acceptsEachTypedPatternConfiguration(final InstantiateOntologyPattern request) {
    assertDoesNotThrow(() -> validator.validate(request));
  }

  @Test
  void rejectsMismatchedOrMultipleConfigurations() {
    final InstantiateOntologyPattern mismatched =
        OntologyPatternTestFixtures.regulatoryRequest()
            .withPatternType(OntologyPatternType.MEASURED_KPI);
    final InstantiateOntologyPattern multiple =
        OntologyPatternTestFixtures.regulatoryRequest()
            .withMeasuredKpi(new MeasuredKpiPatternInput());

    assertThrows(BadRequestException.class, () -> validator.validate(mismatched));
    assertThrows(BadRequestException.class, () -> validator.validate(multiple));
  }

  @Test
  void rejectsIncompleteAndDuplicateTerms() {
    final InstantiateOntologyPattern incomplete = OntologyPatternTestFixtures.regulatoryRequest();
    incomplete.getRegulatoryControl().getEvidence().setDescription(" ");
    final InstantiateOntologyPattern duplicate = OntologyPatternTestFixtures.regulatoryRequest();
    duplicate
        .getRegulatoryControl()
        .getEvidence()
        .setName(duplicate.getRegulatoryControl().getControl().getName());

    assertThrows(BadRequestException.class, () -> validator.validate(incomplete));
    assertThrows(BadRequestException.class, () -> validator.validate(duplicate));
  }

  @Test
  void rejectsMissingPatternType() {
    final InstantiateOntologyPattern request =
        OntologyPatternTestFixtures.regulatoryRequest().withPatternType(null);

    assertThrows(BadRequestException.class, () -> validator.validate(request));
  }

  private static Stream<InstantiateOntologyPattern> validRequests() {
    return Stream.of(
        OntologyPatternTestFixtures.regulatoryRequest(),
        OntologyPatternTestFixtures.measuredKpiRequest(),
        OntologyPatternTestFixtures.productHierarchyRequest());
  }
}
