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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Stream;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.XSD;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyProfileViolationCode;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;

class OwlProfileGuardTest {
  private static final URI PRODUCT = URI.create("https://example.org/Product");
  private static final URI CATEGORY = URI.create("https://example.org/Category");
  private static final URI HAS_CATEGORY = URI.create("https://example.org/hasCategory");

  @Test
  void everyAxiomRequiresASubject() {
    assertFalse(
        new OwlProfileGuard(iri -> null)
            .validate(classAxiom(namedClass(CATEGORY)).withSubjectIri(null))
            .getValid());
  }

  @Test
  void ignoresNoExpressionFieldsAndBoundsNestedInput() {
    final var guard = guard(property -> true);
    assertFalse(guard.validate(classAxiom(namedClass(CATEGORY).withCardinality(2))).getValid());
    OntologyExpression nested = namedClass(CATEGORY);
    for (int depth = 0; depth < 80; depth++) {
      nested =
          new OntologyExpression()
              .withKind(OntologyExpressionKind.RESTRICTION)
              .withPropertyIri(HAS_CATEGORY)
              .withRestrictionKind(OntologyRestrictionKind.SOME)
              .withFiller(nested);
    }
    assertFalse(guard.validate(classAxiom(nested)).getValid());
  }

  @Test
  void dataLiteralsRequireSupportedDatatypesAndValidLexicalValues() {
    final var guard =
        new OwlProfileGuard(iri -> new OntologyProperty().withKind(OntologyPropertyKind.DATA));
    final var axiom =
        new OntologyAxiom()
            .withAxiomType(OntologyAxiomType.DATA_PROPERTY_ASSERTION)
            .withSubjectIri(PRODUCT)
            .withPropertyIri(HAS_CATEGORY);
    for (var literal :
        List.of(
            new OntologyLiteral(),
            new OntologyLiteral().withValue("no").withDatatypeIri(URI.create(XSD.integer.getURI())),
            new OntologyLiteral().withValue("value").withDatatypeIri(URI.create("urn:unknown")),
            new OntologyLiteral()
                .withValue("2026-10-15")
                .withDatatypeIri(URI.create(XSD.date.getURI())))) {
      assertFalse(guard.validate(axiom.withLiteral(literal)).getValid());
    }
    assertTrue(guard.validate(axiom.withLiteral(literal())).getValid());
    assertFalse(
        guard
            .validate(axiom.withPropertyIri(URI.create(OWL2.topDataProperty.getURI())))
            .getValid());
  }

  @Test
  void dataRangesAcceptBooleanDatatypesButRejectClassExpressions() {
    final var guard =
        new OwlProfileGuard(iri -> new OntologyProperty().withKind(OntologyPropertyKind.DATA));
    final var union =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.UNION)
            .withOperands(
                List.of(
                    namedClass(URI.create(XSD.xstring.getURI())),
                    namedClass(URI.create(XSD.integer.getURI()))));
    final var restriction = exactlyOneCategory().withFiller(union);
    assertTrue(guard.validate(classAxiom(restriction)).getValid());
    union.setOperands(List.of(namedClass(CATEGORY), namedClass(URI.create(XSD.integer.getURI()))));
    assertFalse(guard.validate(classAxiom(restriction)).getValid());
  }

  @ParameterizedTest
  @EnumSource(OntologyPropertyKind.class)
  void assertionsRespectDeclaredPropertyKinds(OntologyPropertyKind kind) {
    OwlProfileGuard guard = new OwlProfileGuard(iri -> new OntologyProperty().withKind(kind));
    OntologyAxiom assertion =
        new OntologyAxiom()
            .withSubjectIri(PRODUCT)
            .withPropertyIri(HAS_CATEGORY)
            .withTargetIri(CATEGORY)
            .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION);
    assertEquals(kind == OntologyPropertyKind.OBJECT, guard.validate(assertion).getValid());
    assertion
        .withAxiomType(OntologyAxiomType.DATA_PROPERTY_ASSERTION)
        .withTargetIri(null)
        .withLiteral(literal());
    assertEquals(kind == OntologyPropertyKind.DATA, guard.validate(assertion).getValid());
  }

  @Test
  void restrictionFillersRespectTheDeclaredPropertyKind() {
    OwlProfileGuard guard =
        new OwlProfileGuard(iri -> new OntologyProperty().withKind(OntologyPropertyKind.DATA));
    assertFalse(guard.validate(classAxiom(exactlyOneCategory())).getValid());
    OntologyExpression expression =
        exactlyOneCategory()
            .withFiller(namedClass(URI.create("http://www.w3.org/2001/XMLSchema#string")));
    assertTrue(guard.validate(classAxiom(expression)).getValid());
    expression
        .withRestrictionKind(OntologyRestrictionKind.VALUE)
        .withFiller(null)
        .withLiteral(literal())
        .withCardinality(null);
    assertTrue(guard.validate(classAxiom(expression)).getValid());
  }

  @ParameterizedTest
  @EnumSource(OntologyAxiomType.class)
  void acceptsEverySupportedAxiomShape(OntologyAxiomType type) {
    OntologyAxiom axiom = classAxiom(namedClass(CATEGORY)).withAxiomType(type);
    if (type == OntologyAxiomType.OBJECT_PROPERTY_ASSERTION) {
      axiom.withExpressions(List.of()).withPropertyIri(HAS_CATEGORY).withTargetIri(CATEGORY);
    } else if (type == OntologyAxiomType.DATA_PROPERTY_ASSERTION) {
      axiom.withExpressions(List.of()).withPropertyIri(HAS_CATEGORY).withLiteral(literal());
    }
    assertTrue(guard(property -> true).validate(axiom).getValid());
  }

  @ParameterizedTest
  @EnumSource(OntologyRestrictionKind.class)
  void acceptsEverySupportedRestriction(OntologyRestrictionKind kind) {
    OntologyExpression expression = exactlyOneCategory().withRestrictionKind(kind);
    if (kind == OntologyRestrictionKind.SOME || kind == OntologyRestrictionKind.ONLY) {
      expression.setCardinality(null);
    }
    if (kind == OntologyRestrictionKind.VALUE) {
      expression.withFiller(null).withCardinality(null).withIndividualIri(CATEGORY);
    }
    assertTrue(guard(property -> true).validate(classAxiom(expression)).getValid());
  }

  @ParameterizedTest
  @EnumSource(
      value = OntologyExpressionKind.class,
      names = {"INTERSECTION", "UNION"})
  void acceptsNestedBooleanExpressions(OntologyExpressionKind kind) {
    OntologyExpression expression =
        new OntologyExpression()
            .withKind(kind)
            .withOperands(List.of(namedClass(CATEGORY), exactlyOneCategory()));
    assertTrue(guard(property -> true).validate(classAxiom(expression)).getValid());
  }

  @ParameterizedTest
  @MethodSource("invalidAxioms")
  void rejectsIncompleteOrConflictingShapes(OntologyAxiom axiom) {
    OwlProfileGuard guard = guard(property -> true);
    assertFalse(guard.validate(axiom).getValid());
    assertThrows(BadRequestException.class, () -> guard.validateOrThrow(axiom));
  }

  static Stream<OntologyAxiom> invalidAxioms() {
    return Stream.of(
        classAxiom(namedClass(CATEGORY)).withAxiomType(null),
        classAxiom(namedClass(CATEGORY)).withExpressions(List.of()),
        classAxiom(namedClass(CATEGORY)).withPropertyIri(HAS_CATEGORY),
        classAxiom(namedClass(CATEGORY)).withLiteral(literal()),
        classAxiom(namedClass(CATEGORY))
            .withAxiomType(OntologyAxiomType.CLASS_ASSERTION)
            .withExpressions(List.of(namedClass(CATEGORY), namedClass(PRODUCT))),
        classAxiom(namedClass(CATEGORY)).withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION),
        new OntologyAxiom()
            .withSubjectIri(PRODUCT)
            .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
            .withPropertyIri(HAS_CATEGORY)
            .withTargetIri(CATEGORY)
            .withLiteral(literal()),
        classAxiom(namedClass(CATEGORY)).withAxiomType(OntologyAxiomType.DATA_PROPERTY_ASSERTION),
        new OntologyAxiom()
            .withSubjectIri(PRODUCT)
            .withAxiomType(OntologyAxiomType.DATA_PROPERTY_ASSERTION)
            .withPropertyIri(HAS_CATEGORY)
            .withLiteral(literal())
            .withTargetIri(CATEGORY),
        classAxiom(new OntologyExpression()),
        classAxiom(namedClass(null)),
        classAxiom(
            new OntologyExpression()
                .withKind(OntologyExpressionKind.INTERSECTION)
                .withOperands(List.of(namedClass(CATEGORY)))),
        classAxiom(new OntologyExpression().withKind(OntologyExpressionKind.ONE_OF)),
        classAxiom(new OntologyExpression().withKind(OntologyExpressionKind.RESTRICTION)),
        classAxiom(
            exactlyOneCategory()
                .withRestrictionKind(OntologyRestrictionKind.SOME)
                .withFiller(null)),
        classAxiom(exactlyOneCategory().withCardinality(null)),
        classAxiom(exactlyOneCategory().withCardinality(-1)),
        classAxiom(
            exactlyOneCategory()
                .withRestrictionKind(OntologyRestrictionKind.VALUE)
                .withLiteral(literal())
                .withIndividualIri(CATEGORY)),
        classAxiom(namedClass(CATEGORY)).withExpressions(Arrays.asList((OntologyExpression) null)));
  }

  @Test
  void acceptsClassIndividualReuseInsideNestedExpressions() {
    OwlProfileGuard guard = guard(property -> true);
    assertTrue(guard.validate(classAxiom(exactlyOneCategory())).getValid());
    assertTrue(
        guard
            .validate(
                classAxiom(namedClass(CATEGORY)).withAxiomType(OntologyAxiomType.CLASS_ASSERTION))
            .getValid());
  }

  private static OntologyLiteral literal() {
    return new OntologyLiteral()
        .withValue("value")
        .withDatatypeIri(URI.create("http://www.w3.org/2001/XMLSchema#string"));
  }

  @Test
  void nestedReferencesMustBeAbsolute() {
    OntologyExpression restriction =
        exactlyOneCategory().withFiller(namedClass(URI.create("relative/Category")));
    OntologyProfileReport report = guard(property -> true).validate(classAxiom(restriction));
    assertFalse(report.getValid());
    assertEquals("/expressions/0/filler/classIri", report.getViolations().getFirst().getPath());
  }

  @Test
  void enumerationPreservesDistinctSemanticIdentifiers() {
    List<String> iris = List.of("HTTPS://EXAMPLE.org/客户%2fA", "https://example.org/客户%2fA");
    OntologyExpression expression =
        JsonUtils.readValue(
            "{\"kind\":\"ONE_OF\",\"individualIris\":" + JsonUtils.pojoToJson(iris) + "}",
            OntologyExpression.class);
    assertEquals(iris, expression.getIndividualIris().stream().map(URI::toString).toList());
    OwlProfileGuard guard = guard(property -> true);
    assertTrue(guard.validate(classAxiom(expression)).getValid());
    expression.setIndividualIris(List.of(URI.create(iris.getFirst()), URI.create(iris.getFirst())));
    assertFalse(guard.validate(classAxiom(expression)).getValid());
  }

  @Test
  void acceptsQualifiedCardinalityOnSimpleProperty() {
    OwlProfileGuard guard = guard(propertyIri -> true);
    OntologyAxiom axiom = classAxiom(exactlyOneCategory());

    OntologyProfileReport report = guard.validate(axiom);

    assertTrue(report.getValid());
    assertTrue(report.getViolations().isEmpty());
  }

  @Test
  void rejectsCardinalityOnTransitiveProperty() {
    OwlProfileGuard guard = guard(propertyIri -> !HAS_CATEGORY.equals(propertyIri));

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

    OntologyProfileReport report = guard(propertyIri -> true).validate(classAxiom(restriction));

    assertFalse(report.getValid());
  }

  @Test
  void rejectsReservedVocabularyRedefinition() {
    OntologyAxiom axiom =
        classAxiom(namedClass(CATEGORY))
            .withSubjectIri(URI.create("http://www.w3.org/2002/07/owl#Thing"));

    OntologyProfileReport report = guard(propertyIri -> true).validate(axiom);

    assertFalse(report.getValid());
    assertTrue(
        report.getViolations().stream()
            .anyMatch(
                violation ->
                    violation.getCode() == OntologyProfileViolationCode.RESERVED_SUBJECT_IRI));
  }

  @Test
  void acceptsClassIndividualPunning() {
    OntologyProfileReport report =
        guard(property -> true)
            .validate(
                classAxiom(namedClass(CATEGORY)).withAxiomType(OntologyAxiomType.CLASS_ASSERTION));

    assertTrue(report.getValid());
  }

  private static OwlProfileGuard guard(final Predicate<URI> isSimple) {
    return new OwlProfileGuard(
        iri ->
            isSimple.test(iri)
                ? null
                : new OntologyProperty()
                    .withKind(OntologyPropertyKind.OBJECT)
                    .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE)));
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
}
