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
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyRestrictionKind;

public final class OntologyExpressionRdfWriter {
  public void write(final Model model, final OntologyAxiom axiom) {
    final Resource subject = model.createResource(axiom.getSubjectIri().toString());
    switch (axiom.getAxiomType()) {
      case SUBCLASS_OF -> addExpressions(model, subject, RDFS.subClassOf, axiom.getExpressions());
      case EQUIVALENT_CLASS -> addExpressions(
          model, subject, OWL2.equivalentClass, axiom.getExpressions());
      case DISJOINT_WITH -> addExpressions(
          model, subject, OWL2.disjointWith, axiom.getExpressions());
      case CLASS_ASSERTION -> subject.addProperty(RDF.type, firstExpression(model, axiom));
      case OBJECT_PROPERTY_ASSERTION -> subject.addProperty(
          model.createProperty(axiom.getPropertyIri().toString()),
          model.createResource(axiom.getTargetIri().toString()));
      case DATA_PROPERTY_ASSERTION -> subject.addLiteral(
          model.createProperty(axiom.getPropertyIri().toString()),
          literal(model, axiom.getLiteral()));
    }
  }

  public Resource expression(final Model model, final OntologyExpression expression) {
    final Resource resource =
        switch (expression.getKind()) {
          case NAMED_CLASS -> model.createResource(expression.getClassIri().toString());
          case INTERSECTION -> collectionExpression(
              model, OWL2.intersectionOf, expression.getOperands());
          case UNION -> collectionExpression(model, OWL2.unionOf, expression.getOperands());
          case ONE_OF -> oneOf(model, expression);
          case RESTRICTION -> restriction(model, expression);
        };
    return resource;
  }

  private void addExpressions(
      final Model model,
      final Resource subject,
      final Property predicate,
      final List<OntologyExpression> expressions) {
    listOrEmpty(expressions)
        .forEach(item -> subject.addProperty(predicate, expression(model, item)));
  }

  private Resource firstExpression(final Model model, final OntologyAxiom axiom) {
    return expression(model, axiom.getExpressions().getFirst());
  }

  private Resource collectionExpression(
      final Model model,
      final org.apache.jena.rdf.model.Property predicate,
      final List<OntologyExpression> operands) {
    final Resource expression = model.createResource().addProperty(RDF.type, OWL2.Class);
    expression.addProperty(predicate, model.createList(nodes(model, operands).iterator()));
    return expression;
  }

  private List<RDFNode> nodes(final Model model, final List<OntologyExpression> expressions) {
    return listOrEmpty(expressions).stream()
        .map(expression -> (RDFNode) expression(model, expression))
        .toList();
  }

  private Resource oneOf(final Model model, final OntologyExpression expression) {
    final List<RDFNode> individuals =
        expression.getIndividualIris().stream()
            .map(iri -> (RDFNode) model.createResource(iri.toString()))
            .toList();
    final Resource enumeration = model.createResource().addProperty(RDF.type, OWL2.Class);
    enumeration.addProperty(OWL2.oneOf, model.createList(individuals.iterator()));
    return enumeration;
  }

  private Resource restriction(final Model model, final OntologyExpression expression) {
    final Resource restriction = model.createResource().addProperty(RDF.type, OWL2.Restriction);
    restriction.addProperty(
        OWL2.onProperty, model.createResource(expression.getPropertyIri().toString()));
    addRestrictionValue(model, restriction, expression);
    return restriction;
  }

  private void addRestrictionValue(
      final Model model, final Resource restriction, final OntologyExpression expression) {
    switch (expression.getRestrictionKind()) {
      case SOME -> restriction.addProperty(
          OWL2.someValuesFrom, expression(model, expression.getFiller()));
      case ONLY -> restriction.addProperty(
          OWL2.allValuesFrom, expression(model, expression.getFiller()));
      case VALUE -> addHasValue(model, restriction, expression);
      case MIN, MAX, EXACT -> addCardinality(model, restriction, expression);
    }
  }

  private void addHasValue(
      final Model model, final Resource restriction, final OntologyExpression expression) {
    final RDFNode value =
        expression.getIndividualIri() == null
            ? literal(model, expression.getLiteral())
            : model.createResource(expression.getIndividualIri().toString());
    restriction.addProperty(OWL2.hasValue, value);
  }

  private void addCardinality(
      final Model model, final Resource restriction, final OntologyExpression expression) {
    final boolean isQualified = expression.getFiller() != null;
    restriction.addLiteral(
        cardinalityProperty(expression.getRestrictionKind(), isQualified),
        model.createTypedLiteral(expression.getCardinality()));
    if (isQualified) {
      restriction.addProperty(OWL2.onClass, expression(model, expression.getFiller()));
    }
  }

  private Property cardinalityProperty(
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

  private Literal literal(final Model model, final OntologyLiteral literal) {
    final Literal value =
        literal.getDatatypeIri() == null
            ? model.createLiteral(literal.getValue())
            : model.createTypedLiteral(literal.getValue(), literal.getDatatypeIri().toString());
    return value;
  }
}
