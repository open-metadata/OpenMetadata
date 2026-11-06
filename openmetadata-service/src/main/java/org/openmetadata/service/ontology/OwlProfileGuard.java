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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.apache.jena.vocabulary.OWL2;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyProfileViolation;
import org.openmetadata.schema.type.OntologyProfileViolationCode;
import org.openmetadata.schema.type.OntologyProfileViolationSeverity;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.service.rdf.OwlEntityDeclarations;

public final class OwlProfileGuard {
  private static final int MAX_EXPRESSION_DEPTH = 64;
  private static final int MAX_EXPRESSION_STEPS = 10_000;
  private static final String RDF_NAMESPACE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  private static final String RDFS_NAMESPACE = "http://www.w3.org/2000/01/rdf-schema#";
  private static final String OWL_NAMESPACE = "http://www.w3.org/2002/07/owl#";
  private static final String XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema#";
  private static final Set<String> RESERVED_NAMESPACES =
      Set.of(RDF_NAMESPACE, RDFS_NAMESPACE, OWL_NAMESPACE, XSD_NAMESPACE);

  private final Function<URI, OntologyProperty> properties;
  private final Predicate<URI> nonSimple;

  public OwlProfileGuard(final Function<URI, OntologyProperty> properties) {
    this(properties, iri -> isNonSimple(properties.apply(iri)));
  }

  public OwlProfileGuard(
      final Function<URI, OntologyProperty> properties, final Predicate<URI> nonSimple) {
    this.properties = Objects.requireNonNull(properties);
    this.nonSimple = Objects.requireNonNull(nonSimple);
  }

  public OntologyProfileReport validate(final OntologyAxiom axiom) {
    final List<OntologyProfileViolation> violations = new ArrayList<>();
    if (axiom.getSubjectIri() == null) {
      invalidAxiom(violations, "/subjectIri", "An axiom requires a subject IRI");
    }
    validateAbsoluteIri(axiom.getSubjectIri(), "/subjectIri", violations);
    validateAbsoluteIri(axiom.getPropertyIri(), "/propertyIri", violations);
    validateAbsoluteIri(axiom.getTargetIri(), "/targetIri", violations);
    validateLiteral(axiom.getLiteral(), "/literal", violations);
    validateReservedSubject(axiom, violations);
    validateAxiomShape(axiom, violations);
    final boolean isValid =
        violations.stream()
            .noneMatch(
                violation -> violation.getSeverity() == OntologyProfileViolationSeverity.ERROR);
    return new OntologyProfileReport().withValid(isValid).withViolations(List.copyOf(violations));
  }

  public void validateOrThrow(final OntologyAxiom axiom) {
    final OntologyProfileReport report = validate(axiom);
    if (!Boolean.TRUE.equals(report.getValid())) {
      final String details =
          report.getViolations().stream()
              .map(OntologyProfileViolation::getMessage)
              .collect(Collectors.joining("; "));
      throw new BadRequestException("OWL 2 DL profile validation failed: " + details);
    }
  }

  private static void validateReservedSubject(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
    if (isReserved(axiom.getSubjectIri())) {
      addViolation(
          violations,
          OntologyProfileViolationCode.RESERVED_SUBJECT_IRI,
          "/subjectIri",
          "Authored axioms cannot redefine reserved RDF, RDFS, OWL, or XSD vocabulary");
    }
  }

  private void validateAxiomShape(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
    switch (axiom.getAxiomType()) {
      case SUBCLASS_OF, EQUIVALENT_CLASS, DISJOINT_WITH -> validateClassAxiom(axiom, violations);
      case CLASS_ASSERTION -> validateClassAssertion(axiom, violations);
      case OBJECT_PROPERTY_ASSERTION -> validateObjectAssertion(axiom, violations);
      case DATA_PROPERTY_ASSERTION -> validateDataAssertion(axiom, violations);
      case null -> invalidAxiom(violations, "/axiomType", "An axiom type is required");
    }
  }

  private void validateClassAxiom(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
    if (nullOrEmpty(axiom.getExpressions())) {
      invalidAxiom(
          violations, "/expressions", "A class axiom requires at least one class expression");
    }
    validateExpressions(axiom.getExpressions(), violations);
    rejectAssertionFields(axiom, violations);
  }

  private void validateClassAssertion(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
    if (listOrEmpty(axiom.getExpressions()).size() != 1) {
      invalidAxiom(
          violations,
          "/expressions",
          "A class assertion requires exactly one asserted class expression");
    }
    validateExpressions(axiom.getExpressions(), violations);
    rejectAssertionFields(axiom, violations);
  }

  private void validateObjectAssertion(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
    validatePropertyKind(
        axiom.getPropertyIri(), OntologyPropertyKind.OBJECT, "/propertyIri", violations);
    final boolean isInvalid = axiom.getPropertyIri() == null || axiom.getTargetIri() == null;
    if (isInvalid) {
      invalidAxiom(
          violations,
          "/propertyIri",
          "An object property assertion requires propertyIri and targetIri");
    }
    if (axiom.getLiteral() != null || !nullOrEmpty(axiom.getExpressions())) {
      invalidAxiom(
          violations,
          "/literal",
          "An object property assertion cannot contain a literal or class expressions");
    }
  }

  private void validateDataAssertion(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
    validatePropertyKind(
        axiom.getPropertyIri(), OntologyPropertyKind.DATA, "/propertyIri", violations);
    final boolean isInvalid = axiom.getPropertyIri() == null || axiom.getLiteral() == null;
    if (isInvalid) {
      invalidAxiom(
          violations,
          "/propertyIri",
          "A data property assertion requires propertyIri and a typed literal");
    }
    if (axiom.getTargetIri() != null || !nullOrEmpty(axiom.getExpressions())) {
      invalidAxiom(
          violations,
          "/targetIri",
          "A data property assertion cannot contain targetIri or class expressions");
    }
  }

  private static void rejectAssertionFields(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
    final boolean hasAssertionField =
        axiom.getPropertyIri() != null
            || axiom.getTargetIri() != null
            || axiom.getLiteral() != null;
    if (hasAssertionField) {
      invalidAxiom(
          violations, "/propertyIri", "Class axioms cannot contain property assertion fields");
    }
  }

  private void validateExpressions(
      final List<OntologyExpression> expressions, final List<OntologyProfileViolation> violations) {
    final List<OntologyExpression> safeExpressions = listOrEmpty(expressions);
    final var pending = new ArrayDeque<Expression>();
    for (int index = 0; index < safeExpressions.size(); index++) {
      pending.add(new Expression(safeExpressions.get(index), "/expressions/" + index, 0, false));
    }
    int visited = 0;
    while (!pending.isEmpty()) {
      final Expression current = pending.removeLast();
      if (++visited > MAX_EXPRESSION_STEPS
          || pending.size() > MAX_EXPRESSION_STEPS
          || current.depth() > MAX_EXPRESSION_DEPTH) {
        invalidExpression(
            violations, current.path(), "Expressions exceed 64 levels or 10000 nodes");
        break;
      }
      validateExpression(current.value(), current.path(), violations);
      validateDataRange(current, violations);
      scheduleChildren(current, pending);
    }
  }

  private void scheduleChildren(final Expression current, final ArrayDeque<Expression> pending) {
    final var value = current.value();
    if (value == null) {
      return;
    }
    final var operands = listOrEmpty(value.getOperands());
    for (int index = 0; index < operands.size(); index++) {
      pending.add(
          new Expression(
              operands.get(index),
              current.path() + "/operands/" + index,
              current.depth() + 1,
              current.datatype()));
    }
    if (value.getFiller() != null) {
      pending.add(
          new Expression(
              value.getFiller(),
              current.path() + "/filler",
              current.depth() + 1,
              restrictionPropertyKind(value) == OntologyPropertyKind.DATA));
    }
  }

  private static void validateDataRange(
      final Expression current, final List<OntologyProfileViolation> violations) {
    final var value = current.value();
    if (current.datatype() && value != null && value.getKind() != null) {
      final boolean valid =
          switch (value.getKind()) {
            case NAMED_CLASS -> OwlDatatypeSupport.isSupported(value.getClassIri());
            case UNION, INTERSECTION -> true;
            case ONE_OF, RESTRICTION -> false;
          };
      if (!valid) {
        invalidExpression(
            violations,
            current.path(),
            "A data range requires supported OWL 2 datatypes or their intersection/union");
      }
    }
  }

  private void validateExpression(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (expression == null || expression.getKind() == null) {
      invalidExpression(violations, path, "Every class expression requires a kind");
    } else {
      validateExpressionIris(expression, path, violations);
      OntologyExpressionShape.validate(
          expression, path, message -> invalidExpression(violations, path, message));
      switch (expression.getKind()) {
        case NAMED_CLASS -> validateNamedClass(expression, path, violations);
        case INTERSECTION, UNION -> validateOperands(expression, path, violations);
        case ONE_OF -> validateEnumeration(expression, path, violations);
        case RESTRICTION -> validateRestriction(expression, path, violations);
      }
    }
  }

  private static void validateExpressionIris(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    validateAbsoluteIri(expression.getClassIri(), path + "/classIri", violations);
    validateAbsoluteIri(expression.getPropertyIri(), path + "/propertyIri", violations);
    validateAbsoluteIri(expression.getIndividualIri(), path + "/individualIri", violations);
    listOrEmpty(expression.getIndividualIris())
        .forEach(iri -> validateAbsoluteIri(iri, path + "/individualIris", violations));
    validateLiteral(expression.getLiteral(), path + "/literal", violations);
  }

  private static void validateLiteral(
      final OntologyLiteral literal,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (literal != null) {
      validateAbsoluteIri(literal.getDatatypeIri(), path + "/datatypeIri", violations);
      if (!OwlDatatypeSupport.isValidLiteral(literal)) {
        invalidExpression(
            violations,
            path,
            "A literal requires a supported OWL 2 datatype and a valid lexical value");
      }
    }
  }

  private static void validateAbsoluteIri(
      final URI iri, final String path, final List<OntologyProfileViolation> violations) {
    if (iri != null && !iri.isAbsolute()) {
      invalidExpression(violations, path, "Ontology references must be absolute IRIs");
    }
  }

  private static void validateNamedClass(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (expression.getClassIri() == null) {
      invalidExpression(violations, path + "/classIri", "A named class requires classIri");
    }
  }

  private void validateOperands(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    final List<OntologyExpression> operands = listOrEmpty(expression.getOperands());
    if (operands.size() < 2) {
      invalidExpression(
          violations, path + "/operands", "Intersection and union require at least two operands");
    }
  }

  private static void validateEnumeration(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (nullOrEmpty(expression.getIndividualIris())
        || expression.getIndividualIris().stream().anyMatch(Objects::isNull)) {
      invalidExpression(
          violations, path + "/individualIris", "An enumeration requires named individuals");
    } else if (expression.getIndividualIris().stream().map(URI::toString).distinct().count()
        != expression.getIndividualIris().size()) {
      invalidExpression(violations, path + "/individualIris", "Enumeration IRIs must be unique");
    }
  }

  private void validateRestriction(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (expression.getPropertyIri() == null || expression.getRestrictionKind() == null) {
      invalidExpression(violations, path, "A restriction requires propertyIri and restrictionKind");
    } else {
      validatePropertyKind(
          expression.getPropertyIri(),
          restrictionPropertyKind(expression),
          path + "/propertyIri",
          violations);
      validateRestrictionValue(expression, path, violations);
    }
  }

  private void validateRestrictionValue(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    switch (expression.getRestrictionKind()) {
      case SOME, ONLY -> validateRestrictionFiller(expression, path, violations);
      case VALUE -> validateHasValue(expression, path, violations);
      case MIN, MAX, EXACT -> validateCardinality(expression, path, violations);
    }
  }

  private void validateRestrictionFiller(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (expression.getFiller() == null) {
      invalidExpression(violations, path + "/filler", "This restriction requires a filler");
    }
  }

  private static void validateHasValue(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    final boolean hasIndividual = expression.getIndividualIri() != null;
    final boolean hasLiteral = expression.getLiteral() != null;
    if (hasIndividual == hasLiteral) {
      invalidExpression(
          violations, path, "A value restriction requires exactly one individualIri or literal");
    }
  }

  private void validateCardinality(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (expression.getCardinality() == null || expression.getCardinality() < 0) {
      invalidExpression(
          violations,
          path + "/cardinality",
          "A cardinality restriction requires a non-negative cardinality");
    }
    if (nonSimple.test(expression.getPropertyIri())) {
      addViolation(
          violations,
          OntologyProfileViolationCode.NON_SIMPLE_CARDINALITY,
          path + "/propertyIri",
          "OWL 2 DL forbids cardinality restrictions over non-simple properties");
    }
  }

  static boolean isNonSimple(final OntologyProperty property) {
    return property != null
        && (!nullOrEmpty(property.getPropertyChain())
            || (property.getCharacteristics() != null
                && property.getCharacteristics().contains(RelationshipCharacteristic.TRANSITIVE)));
  }

  private void validatePropertyKind(
      final URI iri,
      final OntologyPropertyKind expected,
      final String path,
      final List<OntologyProfileViolation> violations) {
    final OntologyProperty property = iri == null ? null : properties.apply(iri);
    if (iri != null && OWL2.topDataProperty.getURI().equals(iri.toString())) {
      invalidExpression(
          violations, path, "OWL 2 DL permits topDataProperty only as a super data property");
    }
    if (property != null
        && (property.getKind() == OntologyPropertyKind.ANNOTATION
            || (expected != null && property.getKind() != expected))) {
      addViolation(
          violations,
          OntologyProfileViolationCode.ILLEGAL_PUNNING,
          path,
          "The assertion conflicts with the declared ontology property kind");
    }
  }

  private OntologyPropertyKind restrictionPropertyKind(final OntologyExpression expression) {
    final OntologyExpression filler = expression.getFiller();
    final OntologyProperty property =
        expression.getPropertyIri() == null ? null : properties.apply(expression.getPropertyIri());
    if (expression.getLiteral() != null
        || (expression.getIndividualIri() == null
            && property != null
            && property.getKind() == OntologyPropertyKind.DATA)
        || (filler != null
            && filler.getClassIri() != null
            && OwlEntityDeclarations.isDatatype(filler.getClassIri().toString()))) {
      return OntologyPropertyKind.DATA;
    }
    return expression.getIndividualIri() != null || filler != null
        ? OntologyPropertyKind.OBJECT
        : null;
  }

  private static boolean isReserved(final URI iri) {
    final String value = iri == null ? "" : iri.toString();
    return RESERVED_NAMESPACES.stream().anyMatch(value::startsWith);
  }

  private static void invalidAxiom(
      final List<OntologyProfileViolation> violations, final String path, final String message) {
    addViolation(violations, OntologyProfileViolationCode.INVALID_AXIOM_SHAPE, path, message);
  }

  private static void invalidExpression(
      final List<OntologyProfileViolation> violations, final String path, final String message) {
    addViolation(violations, OntologyProfileViolationCode.INVALID_EXPRESSION_SHAPE, path, message);
  }

  private static void addViolation(
      final List<OntologyProfileViolation> violations,
      final OntologyProfileViolationCode code,
      final String path,
      final String message) {
    violations.add(
        new OntologyProfileViolation()
            .withSeverity(OntologyProfileViolationSeverity.ERROR)
            .withCode(code)
            .withPath(path)
            .withMessage(message));
  }

  private record Expression(OntologyExpression value, String path, int depth, boolean datatype) {}
}
