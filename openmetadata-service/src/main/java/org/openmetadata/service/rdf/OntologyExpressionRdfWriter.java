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

package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Literal;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.service.rdf.OwlEntityDeclarations.EntityKind;

/**
 * Writes authored axioms in the OWL 2 RDF mapping, declaring every class, property and individual
 * they name. A restriction is a data restriction when its value is a literal, its filler names a
 * datatype, or its property is a known data property; its qualified cardinality then uses {@code
 * owl:onDataRange} instead of {@code owl:onClass}.
 */
public final class OntologyExpressionRdfWriter {
  private final Predicate<String> isKnownDataProperty;

  public OntologyExpressionRdfWriter() {
    this(iri -> false);
  }

  public OntologyExpressionRdfWriter(final Predicate<String> isKnownDataProperty) {
    this.isKnownDataProperty = Objects.requireNonNull(isKnownDataProperty);
  }

  public void write(final Model model, final OntologyAxiom axiom) {
    final Resource subject = model.createResource(axiom.getSubjectIri().toString());
    switch (axiom.getAxiomType()) {
      case SUBCLASS_OF -> addClassAxiom(model, subject, RDFS.subClassOf, axiom);
      case EQUIVALENT_CLASS -> addClassAxiom(model, subject, OWL2.equivalentClass, axiom);
      case DISJOINT_WITH -> addClassAxiom(model, subject, OWL2.disjointWith, axiom);
      case CLASS_ASSERTION -> addClassAssertion(model, subject, axiom);
      case OBJECT_PROPERTY_ASSERTION -> addObjectPropertyAssertion(model, subject, axiom);
      case DATA_PROPERTY_ASSERTION -> addDataPropertyAssertion(model, subject, axiom);
    }
  }

  public Resource expression(final Model model, final OntologyExpression expression) {
    final Resource resource =
        switch (expression.getKind()) {
          case NAMED_CLASS -> namedClass(model, expression);
          case INTERSECTION -> collectionExpression(
              model, OWL2.intersectionOf, expression.getOperands());
          case UNION -> collectionExpression(model, OWL2.unionOf, expression.getOperands());
          case ONE_OF -> oneOf(model, expression);
          case RESTRICTION -> restriction(model, expression);
        };
    return resource;
  }

  private void addClassAxiom(
      final Model model,
      final Resource subject,
      final Property predicate,
      final OntologyAxiom axiom) {
    OwlEntityDeclarations.declare(model, subject, EntityKind.CLASS);
    listOrEmpty(axiom.getExpressions())
        .forEach(item -> subject.addProperty(predicate, expression(model, item)));
  }

  private void addClassAssertion(
      final Model model, final Resource subject, final OntologyAxiom axiom) {
    OwlEntityDeclarations.declare(model, subject, EntityKind.NAMED_INDIVIDUAL);
    subject.addProperty(RDF.type, expression(model, axiom.getExpressions().getFirst()));
  }

  private static void addObjectPropertyAssertion(
      final Model model, final Resource subject, final OntologyAxiom axiom) {
    final Resource target = model.createResource(axiom.getTargetIri().toString());
    OwlEntityDeclarations.declare(model, subject, EntityKind.NAMED_INDIVIDUAL);
    OwlEntityDeclarations.declare(model, target, EntityKind.NAMED_INDIVIDUAL);
    subject.addProperty(property(model, axiom.getPropertyIri().toString(), false), target);
  }

  private static void addDataPropertyAssertion(
      final Model model, final Resource subject, final OntologyAxiom axiom) {
    OwlEntityDeclarations.declare(model, subject, EntityKind.NAMED_INDIVIDUAL);
    subject.addLiteral(
        property(model, axiom.getPropertyIri().toString(), true),
        literal(model, axiom.getLiteral()));
  }

  private static Resource namedClass(final Model model, final OntologyExpression expression) {
    final Resource namedClass = model.createResource(expression.getClassIri().toString());
    OwlEntityDeclarations.declare(model, namedClass, EntityKind.CLASS);
    return namedClass;
  }

  private Resource collectionExpression(
      final Model model, final Property predicate, final List<OntologyExpression> operands) {
    final Resource expression = model.createResource().addProperty(RDF.type, OWL2.Class);
    expression.addProperty(predicate, model.createList(nodes(model, operands).iterator()));
    return expression;
  }

  private List<RDFNode> nodes(final Model model, final List<OntologyExpression> expressions) {
    return listOrEmpty(expressions).stream()
        .map(expression -> (RDFNode) expression(model, expression))
        .toList();
  }

  private static Resource oneOf(final Model model, final OntologyExpression expression) {
    final List<RDFNode> individuals =
        expression.getIndividualIris().stream()
            .map(iri -> (RDFNode) individual(model, iri.toString()))
            .toList();
    final Resource enumeration = model.createResource().addProperty(RDF.type, OWL2.Class);
    enumeration.addProperty(OWL2.oneOf, model.createList(individuals.iterator()));
    return enumeration;
  }

  private Resource restriction(final Model model, final OntologyExpression expression) {
    final boolean isData = isDataRestriction(expression);
    final Resource restriction = model.createResource().addProperty(RDF.type, OWL2.Restriction);
    restriction.addProperty(
        OWL2.onProperty, property(model, expression.getPropertyIri().toString(), isData));
    addRestrictionValue(model, restriction, expression, isData);
    return restriction;
  }

  private boolean isDataRestriction(final OntologyExpression expression) {
    return expression.getLiteral() != null
        || isDatatypeFiller(expression.getFiller())
        || isKnownDataProperty.test(expression.getPropertyIri().toString());
  }

  private static boolean isDatatypeFiller(final OntologyExpression filler) {
    return filler != null
        && filler.getKind() == OntologyExpressionKind.NAMED_CLASS
        && filler.getClassIri() != null
        && OwlEntityDeclarations.isDatatype(filler.getClassIri().toString());
  }

  private void addRestrictionValue(
      final Model model,
      final Resource restriction,
      final OntologyExpression expression,
      final boolean isData) {
    switch (expression.getRestrictionKind()) {
      case SOME -> restriction.addProperty(
          OWL2.someValuesFrom, filler(model, expression.getFiller(), isData));
      case ONLY -> restriction.addProperty(
          OWL2.allValuesFrom, filler(model, expression.getFiller(), isData));
      case VALUE -> addHasValue(model, restriction, expression);
      case MIN, MAX, EXACT -> addCardinality(model, restriction, expression, isData);
    }
  }

  private Resource filler(
      final Model model, final OntologyExpression filler, final boolean isData) {
    return isData ? dataRange(model, filler) : expression(model, filler);
  }

  private Resource dataRange(final Model model, final OntologyExpression value) {
    return switch (value.getKind()) {
      case NAMED_CLASS -> {
        final Resource datatype = model.createResource(value.getClassIri().toString());
        OwlEntityDeclarations.declare(model, datatype, EntityKind.DATATYPE);
        yield datatype;
      }
      case UNION, INTERSECTION -> model
          .createResource()
          .addProperty(RDF.type, RDFS.Datatype)
          .addProperty(
              value.getKind() == OntologyExpressionKind.UNION ? OWL2.unionOf : OWL2.intersectionOf,
              model.createList(
                  value.getOperands().stream()
                      .map(operand -> dataRange(model, operand))
                      .iterator()));
      case ONE_OF, RESTRICTION -> throw new IllegalArgumentException(
          "Unsupported data range: " + value.getKind());
    };
  }

  private static void addHasValue(
      final Model model, final Resource restriction, final OntologyExpression expression) {
    final RDFNode value =
        expression.getIndividualIri() == null
            ? literal(model, expression.getLiteral())
            : individual(model, expression.getIndividualIri().toString());
    restriction.addProperty(OWL2.hasValue, value);
  }

  private void addCardinality(
      final Model model,
      final Resource restriction,
      final OntologyExpression expression,
      final boolean isData) {
    final boolean isQualified = expression.getFiller() != null;
    restriction.addLiteral(
        cardinalityProperty(expression.getRestrictionKind(), isQualified),
        model.createTypedLiteral(
            String.valueOf(expression.getCardinality()), XSDDatatype.XSDnonNegativeInteger));
    if (isQualified) {
      restriction.addProperty(
          isData ? OWL2.onDataRange : OWL2.onClass, filler(model, expression.getFiller(), isData));
    }
  }

  private static Property cardinalityProperty(
      final OntologyRestrictionKind kind, final boolean isQualified) {
    final Property property =
        switch (kind) {
          case MIN -> isQualified ? OWL2.minQualifiedCardinality : OWL2.minCardinality;
          case MAX -> isQualified ? OWL2.maxQualifiedCardinality : OWL2.maxCardinality;
          case EXACT -> isQualified ? OWL2.qualifiedCardinality : OWL2.cardinality;
          case SOME, ONLY, VALUE -> throw new IllegalArgumentException(
              "Restriction kind '" + kind + "' is not a cardinality");
        };
    return property;
  }

  private static Property property(final Model model, final String iri, final boolean isData) {
    OwlEntityDeclarations.declare(
        model, iri, isData ? EntityKind.DATA_PROPERTY : EntityKind.OBJECT_PROPERTY);
    return model.createProperty(iri);
  }

  private static Resource individual(final Model model, final String iri) {
    OwlEntityDeclarations.declare(model, iri, EntityKind.NAMED_INDIVIDUAL);
    return model.createResource(iri);
  }

  static Literal literal(final Model model, final OntologyLiteral literal) {
    final Literal value =
        literal.getDatatypeIri() == null
            ? model.createLiteral(literal.getValue())
            : model.createTypedLiteral(literal.getValue(), literal.getDatatypeIri().toString());
    return value;
  }
}
