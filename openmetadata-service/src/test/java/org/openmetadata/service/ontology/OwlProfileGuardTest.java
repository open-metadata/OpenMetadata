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

import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyProfileViolationCode;
import org.openmetadata.schema.type.OntologyRestrictionKind;

class OwlProfileGuardTest {
  private static final URI PRODUCT = URI.create("https://example.org/Product");
  private static final URI CATEGORY = URI.create("https://example.org/Category");
  private static final URI HAS_CATEGORY = URI.create("https://example.org/hasCategory");

  @Test
  void acceptsQualifiedCardinalityOnSimpleProperty() {
    OwlProfileGuard guard = guard(propertyIri -> true, emptyVocabulary());
    OntologyAxiom axiom = classAxiom(exactlyOneCategory());

    OntologyProfileReport report = guard.validate(axiom);

    assertTrue(report.getValid());
    assertTrue(report.getViolations().isEmpty());
  }

  @Test
  void rejectsCardinalityOnTransitiveProperty() {
    OwlProfileGuard guard =
        guard(propertyIri -> !HAS_CATEGORY.equals(propertyIri), emptyVocabulary());

    OntologyProfileReport report = guard.validate(classAxiom(exactlyOneCategory()));

    assertFalse(report.getValid());
    assertTrue(
        report.getViolations().stream()
            .anyMatch(
                violation ->
                    violation.getCode() == OntologyProfileViolationCode.NON_SIMPLE_CARDINALITY));
  }

  @Test
  void rejectsIncompleteValueRestriction() {
    OntologyExpression restriction =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(HAS_CATEGORY)
            .withRestrictionKind(OntologyRestrictionKind.VALUE);

    OntologyProfileReport report =
        guard(propertyIri -> true, emptyVocabulary()).validate(classAxiom(restriction));

    assertFalse(report.getValid());
  }

  @Test
  void rejectsReservedVocabularyRedefinition() {
    OntologyAxiom axiom =
        classAxiom(namedClass(CATEGORY))
            .withSubjectIri(URI.create("http://www.w3.org/2002/07/owl#Thing"));

    OntologyProfileReport report = guard(propertyIri -> true, emptyVocabulary()).validate(axiom);

    assertFalse(report.getValid());
    assertTrue(
        report.getViolations().stream()
            .anyMatch(
                violation ->
                    violation.getCode() == OntologyProfileViolationCode.RESERVED_SUBJECT_IRI));
  }

  @Test
  void rejectsClassIndividualPunning() {
    OwlProfileGuard.VocabularyIndex vocabulary =
        new OwlProfileGuard.VocabularyIndex() {
          @Override
          public boolean isClass(final URI iri) {
            return false;
          }

          @Override
          public boolean isIndividual(final URI iri) {
            return PRODUCT.equals(iri);
          }
        };

    OntologyProfileReport report =
        guard(propertyIri -> true, vocabulary).validate(classAxiom(namedClass(CATEGORY)));

    assertFalse(report.getValid());
  }

  private static OwlProfileGuard guard(
      final OwlProfileGuard.PropertySimplicity properties,
      final OwlProfileGuard.VocabularyIndex vocabulary) {
    return new OwlProfileGuard(properties, vocabulary);
  }

  private static OntologyAxiom classAxiom(final OntologyExpression expression) {
    return new OntologyAxiom()
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(PRODUCT)
        .withExpressions(List.of(expression));
  }

  private static OntologyExpression exactlyOneCategory() {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.RESTRICTION)
        .withPropertyIri(HAS_CATEGORY)
        .withRestrictionKind(OntologyRestrictionKind.EXACT)
        .withCardinality(1)
        .withFiller(namedClass(CATEGORY));
  }

  private static OntologyExpression namedClass(final URI classIri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(classIri);
  }

  private static OwlProfileGuard.VocabularyIndex emptyVocabulary() {
    return new OwlProfileGuard.VocabularyIndex() {
      @Override
      public boolean isClass(final URI iri) {
        return false;
      }

      @Override
      public boolean isIndividual(final URI iri) {
        return false;
      }
    };
  }
}
