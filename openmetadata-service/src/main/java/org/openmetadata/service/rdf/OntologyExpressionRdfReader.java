package org.openmetadata.service.rdf;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.apache.jena.rdf.model.Literal;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.service.exception.BadRequestException;

final class OntologyExpressionRdfReader {
  private final Model model;
  private final Set<Statement> remaining;
  private final Set<Resource> visiting = new HashSet<>();
  private final long deadline = System.nanoTime() + Duration.ofSeconds(30).toNanos();
  private int steps;

  OntologyExpressionRdfReader(final Model model, final Set<Statement> remaining) {
    this.model = model;
    this.remaining = remaining;
  }

  OntologyExpression read(final RDFNode node) {
    return read(node, 0);
  }

  private OntologyExpression read(final RDFNode node, final int depth) {
    budget();
    if (depth > 64 || !node.isResource()) {
      throw new BadRequestException("Unsupported or too deeply nested ontology expression");
    }
    final Resource resource = node.asResource();
    if (resource.isURIResource()) {
      return new OntologyExpression()
          .withKind(OntologyExpressionKind.NAMED_CLASS)
          .withClassIri(URI.create(resource.getURI()));
    }
    if (!visiting.add(resource)) {
      throw new BadRequestException("Cyclic ontology expression");
    }
    try {
      if (takeType(resource, OWL2.Restriction)) {
        return restriction(resource, depth);
      }
      if (!takeType(resource, OWL2.Class) && !takeType(resource, RDFS.Datatype)) {
        throw new BadRequestException("Unsupported blank-node ontology expression");
      }
      for (final var pair :
          List.of(
              new Pair(OWL2.intersectionOf, OntologyExpressionKind.INTERSECTION),
              new Pair(OWL2.unionOf, OntologyExpressionKind.UNION),
              new Pair(OWL2.oneOf, OntologyExpressionKind.ONE_OF))) {
        final RDFNode values = one(resource, pair.property());
        if (values == null) {
          continue;
        }
        final List<RDFNode> items = list(values, depth + 1);
        final OntologyExpression expression = new OntologyExpression().withKind(pair.kind());
        if (pair.kind() == OntologyExpressionKind.ONE_OF) {
          expression.withIndividualIris(
              items.stream().map(OntologyExpressionRdfReader::iri).toList());
        } else {
          expression.withOperands(items.stream().map(item -> read(item, depth + 1)).toList());
        }
        return expression;
      }
      throw new BadRequestException("Ontology expression has no supported constructor");
    } finally {
      visiting.remove(resource);
    }
  }

  private OntologyExpression restriction(final Resource resource, final int depth) {
    final URI propertyIri = iri(require(resource, OWL2.onProperty));
    final OntologyExpression result =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(propertyIri);
    final var forms =
        List.of(
            new Restriction(OWL2.someValuesFrom, OntologyRestrictionKind.SOME),
            new Restriction(OWL2.allValuesFrom, OntologyRestrictionKind.ONLY),
            new Restriction(OWL2.hasValue, OntologyRestrictionKind.VALUE),
            new Restriction(OWL2.minCardinality, OntologyRestrictionKind.MIN),
            new Restriction(OWL2.maxCardinality, OntologyRestrictionKind.MAX),
            new Restriction(OWL2.cardinality, OntologyRestrictionKind.EXACT),
            new Restriction(OWL2.minQualifiedCardinality, OntologyRestrictionKind.MIN),
            new Restriction(OWL2.maxQualifiedCardinality, OntologyRestrictionKind.MAX),
            new Restriction(OWL2.qualifiedCardinality, OntologyRestrictionKind.EXACT));
    for (final var form : forms) {
      final RDFNode value = one(resource, form.property());
      if (value == null) {
        continue;
      }
      result.withRestrictionKind(form.kind());
      switch (form.kind()) {
        case SOME, ONLY -> result.withFiller(read(value, depth + 1));
        case VALUE -> {
          if (value.isLiteral()) {
            result.withLiteral(literal(value.asLiteral()));
          } else {
            result.withIndividualIri(iri(value));
          }
        }
        case MIN, MAX, EXACT -> {
          if (!value.isLiteral()
              || !value.asLiteral().getLanguage().isEmpty()
              || !XSD.nonNegativeInteger.getURI().equals(value.asLiteral().getDatatypeURI())) {
            throw new BadRequestException("Cardinality must be a non-negative integer");
          }
          try {
            final int cardinality = Integer.parseInt(value.asLiteral().getLexicalForm());
            if (cardinality < 0) {
              throw new NumberFormatException();
            }
            result.withCardinality(cardinality);
          } catch (NumberFormatException exception) {
            throw new BadRequestException("Cardinality must be a non-negative integer");
          }
          final RDFNode classFiller = one(resource, OWL2.onClass);
          final RDFNode dataFiller = one(resource, OWL2.onDataRange);
          if (classFiller != null && dataFiller != null) {
            throw new BadRequestException("A cardinality cannot have two fillers");
          }
          if (classFiller != null || dataFiller != null) {
            result.withFiller(read(classFiller == null ? dataFiller : classFiller, depth + 1));
          }
        }
      }
      return result;
    }
    throw new BadRequestException("Restriction has no supported constraint");
  }

  List<RDFNode> list(final RDFNode head, final int depth) {
    if (!head.isResource()) {
      throw new BadRequestException("RDF list head must be a resource");
    }
    final List<RDFNode> values = new ArrayList<>();
    final Set<Resource> seen = new HashSet<>();
    Resource cursor = head.asResource();
    while (!RDF.nil.equals(cursor)) {
      budget();
      if (depth > 64 || values.size() >= 10_000 || !cursor.isAnon() || !seen.add(cursor)) {
        throw new BadRequestException("Malformed or oversized RDF list");
      }
      values.add(require(cursor, RDF.first));
      final RDFNode tail = require(cursor, RDF.rest);
      if (!tail.isResource()) {
        throw new BadRequestException("RDF list tail must be a resource");
      }
      cursor = tail.asResource();
    }
    return values;
  }

  RDFNode one(final Resource subject, final Property property) {
    budget();
    final List<Statement> statements =
        model.listStatements(subject, property, (RDFNode) null).toList();
    if (statements.size() > 1) {
      throw new BadRequestException("Conflicting RDF values for " + property.getURI());
    }
    if (statements.isEmpty()) {
      return null;
    }
    remaining.remove(statements.getFirst());
    return statements.getFirst().getObject();
  }

  RDFNode require(final Resource subject, final Property property) {
    final RDFNode value = one(subject, property);
    if (value == null) {
      throw new BadRequestException("Missing RDF value for " + property.getURI());
    }
    return value;
  }

  boolean takeType(final Resource subject, final Resource type) {
    final Statement statement = model.createStatement(subject, RDF.type, type);
    if (model.contains(statement)) {
      remaining.remove(statement);
      return true;
    }
    return false;
  }

  static URI iri(final RDFNode node) {
    if (!node.isURIResource()) {
      throw new BadRequestException("Expected an absolute RDF IRI");
    }
    final URI iri = URI.create(node.asResource().getURI());
    if (!iri.isAbsolute()) {
      throw new BadRequestException("Expected an absolute RDF IRI");
    }
    return iri;
  }

  static OntologyLiteral literal(final Literal value) {
    if (!value.getLanguage().isEmpty()) {
      throw new BadRequestException(
          "Language-tagged literals cannot be represented in native ontologies");
    }
    final String datatype = value.getDatatypeURI();
    return new OntologyLiteral()
        .withValue(value.getLexicalForm())
        .withDatatypeIri(
            datatype == null || XSD.xstring.getURI().equals(datatype)
                ? null
                : URI.create(datatype));
  }

  private record Pair(Property property, OntologyExpressionKind kind) {}

  private record Restriction(Property property, OntologyRestrictionKind kind) {}

  private void budget() {
    if (++steps > 200_000 || System.nanoTime() >= deadline) {
      throw new BadRequestException("Ontology expression exceeds its traversal budget");
    }
  }
}
