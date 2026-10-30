package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.ArrayDeque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyReference;
import org.openmetadata.schema.type.OntologyReferenceRole;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;

/** Rebuildable semantic-reference index input; the entity JSON remains authoritative. */
public final class OntologyReferences {
  private static final int MAX_REFERENCES = 10_000;
  private final Set<Target> targets = new LinkedHashSet<>();
  private int visited;

  private OntologyReferences() {}

  public static List<OntologyReference> collect(final OntologyDefinition entity) {
    if (Boolean.TRUE.equals(entity.getDeleted()) || entity instanceof Ontology) {
      return List.of();
    }
    final OntologyReferences references = new OntologyReferences();
    final String sourceType =
        switch (entity) {
          case OntologyConcept concept -> {
            references.concept(concept);
            yield Entity.ONTOLOGY_CONCEPT;
          }
          case OntologyProperty property -> {
            references.property(property);
            yield Entity.ONTOLOGY_PROPERTY;
          }
          case OntologyAxiom axiom -> {
            references.axiom(axiom);
            yield Entity.ONTOLOGY_AXIOM;
          }
          default -> throw new BadRequestException("Unsupported ontology reference source");
        };
    return references.targets.stream()
        .map(
            target ->
                new OntologyReference()
                    .withOntologyId(entity.getOntology().getId())
                    .withSource(entity.getEntityReference().withType(sourceType))
                    .withRole(target.role())
                    .withIri(URI.create(target.iri())))
        .toList();
  }

  private void concept(final OntologyConcept concept) {
    listOrEmpty(concept.getConceptMappings())
        .forEach(
            mapping -> {
              add(OntologyReferenceRole.MAPPING_TARGET, mapping.getConceptIri());
              add(OntologyReferenceRole.MAPPING_SCHEME, mapping.getSchemeIri());
            });
    add(OntologyReferenceRole.REPLACED_BY, concept.getReplacedBy());
  }

  private void property(final OntologyProperty property) {
    add(OntologyReferenceRole.DOMAIN, property.getDomain());
    add(OntologyReferenceRole.RANGE, property.getRange());
    add(OntologyReferenceRole.INVERSE, property.getInverse());
    add(OntologyReferenceRole.PROPERTY_CHAIN, property.getPropertyChain());
    add(OntologyReferenceRole.DISJOINT_PROPERTY, property.getDisjointWith());
    add(OntologyReferenceRole.REPLACED_BY, property.getReplacedBy());
    listOrEmpty(property.getEnumValues()).forEach(this::literal);
  }

  private void axiom(final OntologyAxiom axiom) {
    add(OntologyReferenceRole.AXIOM_SUBJECT, axiom.getSubjectIri());
    add(OntologyReferenceRole.SUPER_CLASS, OntologyClassHierarchy.namedParents(axiom));
    add(OntologyReferenceRole.PROPERTY, axiom.getPropertyIri());
    add(OntologyReferenceRole.INDIVIDUAL, axiom.getTargetIri());
    literal(axiom.getLiteral());
    final ArrayDeque<OntologyExpression> pending = new ArrayDeque<>();
    schedule(pending, axiom.getExpressions());
    while (!pending.isEmpty()) {
      requireCapacity();
      final OntologyExpression expression = pending.removeLast();
      expression(expression);
      schedule(pending, expression.getOperands());
      if (expression.getFiller() != null) {
        schedule(pending, List.of(expression.getFiller()));
      }
    }
  }

  private void schedule(
      final ArrayDeque<OntologyExpression> pending, final List<OntologyExpression> expressions) {
    final List<OntologyExpression> children = listOrEmpty(expressions);
    if (children.size() > MAX_REFERENCES - visited - pending.size()) {
      throw traversalLimit();
    }
    pending.addAll(children);
  }

  private void expression(final OntologyExpression expression) {
    add(OntologyReferenceRole.CLASS_EXPRESSION, expression.getClassIri());
    add(OntologyReferenceRole.PROPERTY, expression.getPropertyIri());
    add(OntologyReferenceRole.INDIVIDUAL, expression.getIndividualIri());
    add(OntologyReferenceRole.INDIVIDUAL, expression.getIndividualIris());
    literal(expression.getLiteral());
  }

  private void literal(final OntologyLiteral literal) {
    if (literal != null) {
      add(OntologyReferenceRole.DATATYPE, literal.getDatatypeIri());
    }
  }

  private void add(final OntologyReferenceRole role, final List<URI> iris) {
    listOrEmpty(iris).forEach(iri -> add(role, iri));
  }

  private void add(final OntologyReferenceRole role, final URI iri) {
    if (iri != null) {
      requireCapacity();
      if (!iri.isAbsolute()) {
        throw new BadRequestException("Ontology references require absolute IRIs");
      }
      targets.add(new Target(role, iri.toString()));
    }
  }

  private void requireCapacity() {
    if (++visited > MAX_REFERENCES) {
      throw traversalLimit();
    }
  }

  private static BadRequestException traversalLimit() {
    return new BadRequestException(
        "An ontology definition exceeds the 10000 reference traversal limit");
  }

  private record Target(OntologyReferenceRole role, String iri) {}
}
