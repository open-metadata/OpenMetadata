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
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyProfileViolation;
import org.openmetadata.schema.type.OntologyProfileViolationCode;
import org.openmetadata.schema.type.OntologyProfileViolationSeverity;

public final class OwlProfileGuard {
  private static final String RDF_NAMESPACE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  private static final String RDFS_NAMESPACE = "http://www.w3.org/2000/01/rdf-schema#";
  private static final String OWL_NAMESPACE = "http://www.w3.org/2002/07/owl#";
  private static final String XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema#";
  private static final Set<String> RESERVED_NAMESPACES =
      Set.of(RDF_NAMESPACE, RDFS_NAMESPACE, OWL_NAMESPACE, XSD_NAMESPACE);

  private final PropertySimplicity propertySimplicity;
  private final VocabularyIndex vocabularyIndex;

  public OwlProfileGuard(
      final PropertySimplicity propertySimplicity, final VocabularyIndex vocabularyIndex) {
    this.propertySimplicity = propertySimplicity;
    this.vocabularyIndex = vocabularyIndex;
  }

  public OntologyProfileReport validate(final OntologyAxiom axiom) {
    final List<OntologyProfileViolation> violations = new ArrayList<>();
    validateReservedSubject(axiom, violations);
    validateAxiomShape(axiom, violations);
    validatePunning(axiom, violations);
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

  private static void validateObjectAssertion(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
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

  private static void validateDataAssertion(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
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
    for (int index = 0; index < safeExpressions.size(); index++) {
      validateExpression(safeExpressions.get(index), "/expressions/" + index, violations);
    }
  }

  private void validateExpression(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (expression == null || expression.getKind() == null) {
      invalidExpression(violations, path, "Every class expression requires a kind");
    } else {
      switch (expression.getKind()) {
        case NAMED_CLASS -> validateNamedClass(expression, path, violations);
        case INTERSECTION, UNION -> validateOperands(expression, path, violations);
        case ONE_OF -> validateEnumeration(expression, path, violations);
        case RESTRICTION -> validateRestriction(expression, path, violations);
      }
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
    for (int index = 0; index < operands.size(); index++) {
      validateExpression(operands.get(index), path + "/operands/" + index, violations);
    }
  }

  private static void validateEnumeration(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (nullOrEmpty(expression.getIndividualIris())) {
      invalidExpression(
          violations, path + "/individualIris", "An enumeration requires named individuals");
    }
  }

  private void validateRestriction(
      final OntologyExpression expression,
      final String path,
      final List<OntologyProfileViolation> violations) {
    if (expression.getPropertyIri() == null || expression.getRestrictionKind() == null) {
      invalidExpression(violations, path, "A restriction requires propertyIri and restrictionKind");
    } else {
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
    } else {
      validateExpression(expression.getFiller(), path + "/filler", violations);
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
    if (expression.getCardinality() == null) {
      invalidExpression(
          violations, path + "/cardinality", "A cardinality restriction requires cardinality");
    }
    if (expression.getFiller() != null) {
      validateExpression(expression.getFiller(), path + "/filler", violations);
    }
    if (!propertySimplicity.isSimple(expression.getPropertyIri())) {
      addViolation(
          violations,
          OntologyProfileViolationCode.NON_SIMPLE_CARDINALITY,
          path + "/propertyIri",
          "OWL 2 DL forbids cardinality restrictions over transitive or chained properties");
    }
  }

  private void validatePunning(
      final OntologyAxiom axiom, final List<OntologyProfileViolation> violations) {
    final boolean subjectIsClass = isClassAxiom(axiom.getAxiomType());
    final boolean conflicts =
        subjectIsClass
            ? vocabularyIndex.isIndividual(axiom.getSubjectIri())
            : axiom.getAxiomType() == OntologyAxiomType.CLASS_ASSERTION
                && vocabularyIndex.isClass(axiom.getSubjectIri());
    if (conflicts) {
      addViolation(
          violations,
          OntologyProfileViolationCode.ILLEGAL_PUNNING,
          "/subjectIri",
          "The subject IRI is already used with an incompatible class or individual role");
    }
    validateExpressionPunning(axiom.getExpressions(), violations);
  }

  private void validateExpressionPunning(
      final List<OntologyExpression> expressions, final List<OntologyProfileViolation> violations) {
    for (final OntologyExpression expression : listOrEmpty(expressions)) {
      validateExpressionPunning(expression, violations);
    }
  }

  private void validateExpressionPunning(
      final OntologyExpression expression, final List<OntologyProfileViolation> violations) {
    if (expression != null
        && expression.getClassIri() != null
        && vocabularyIndex.isIndividual(expression.getClassIri())) {
      addViolation(
          violations,
          OntologyProfileViolationCode.ILLEGAL_PUNNING,
          "/expressions/classIri",
          "A named class IRI is already used as an individual");
    }
    if (expression != null) {
      validateExpressionPunning(expression.getOperands(), violations);
      if (expression.getFiller() != null) {
        validateExpressionPunning(expression.getFiller(), violations);
      }
    }
  }

  private static boolean isClassAxiom(final OntologyAxiomType axiomType) {
    final boolean isClassAxiom =
        axiomType == OntologyAxiomType.SUBCLASS_OF
            || axiomType == OntologyAxiomType.EQUIVALENT_CLASS
            || axiomType == OntologyAxiomType.DISJOINT_WITH;
    return isClassAxiom;
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

  @FunctionalInterface
  public interface PropertySimplicity {
    boolean isSimple(URI propertyIri);
  }

  public interface VocabularyIndex {
    boolean isClass(URI iri);

    boolean isIndividual(URI iri);
  }
}
