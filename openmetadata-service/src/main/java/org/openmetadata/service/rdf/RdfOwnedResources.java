package org.openmetadata.service.rdf;

import static org.openmetadata.service.rdf.translator.RdfConceptBindingMapper.BOUND_ASSET;
import static org.openmetadata.service.rdf.translator.RdfConceptBindingMapper.BOUND_COLUMN;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.Set;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.vocabulary.RDF;

/** Owned subresources must be replaced along with the entity links that identify them. */
public final class RdfOwnedResources {
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String LIST_CELL_SEGMENT = "/list/";
  private static final Node HAS_CUSTOM_PROPERTY =
      NodeFactory.createURI(OM_NS + "hasCustomProperty");
  private static final Node HAS_EXTENSION = NodeFactory.createURI(OM_NS + "hasExtension");
  private static final Node HAS_EXTENSION_PROPERTY =
      NodeFactory.createURI(OM_NS + "hasExtensionProperty");
  private static final Node HAS_COLUMN = NodeFactory.createURI(OM_NS + "hasColumn");
  private static final Node HAS_CHILD_COLUMN = NodeFactory.createURI(OM_NS + "hasChildColumn");
  private static final Node HAS_CONSTRAINT = NodeFactory.createURI(OM_NS + "hasConstraint");
  private static final Node HAS_QUALITY_MEASUREMENT =
      NodeFactory.createURI("http://www.w3.org/ns/dqv#hasQualityMeasurement");
  private static final Node HAS_CONSTRAINT_MEMBER =
      NodeFactory.createURI(OM_NS + "hasConstraintMember");
  private static final Node HAS_CONSTRAINED_COLUMN =
      NodeFactory.createURI(OM_NS + "hasConstrainedColumn");
  private static final Node HAS_TEST_RESULT = NodeFactory.createURI(OM_NS + "hasTestResult");
  private static final Node HAS_RESULT_VALUE = NodeFactory.createURI(OM_NS + "hasResultValue");
  private static final Node HAS_OPEN_INCIDENT = NodeFactory.createURI(OM_NS + "hasOpenIncident");

  private RdfOwnedResources() {}

  /**
   * Matches owned triples without traversing shared entity references. List cells are matched by
   * the name {@link #listCellIri} gives them, or as blank nodes for lists projected before cells
   * were named; only their {@code rdf:first} and {@code rdf:rest} triples are owned, so a cell can
   * never lead the match into the entities a list refers to.
   */
  public static String ownedTriplesPattern() {
    return """
        {
          ?entity <https://open-metadata.org/ontology/hasCustomProperty> ?subject .
          ?subject ?p ?o
        }
        UNION {
          ?entity <https://open-metadata.org/ontology/hasExtension> ?extension .
          { ?extension ?p ?o . BIND(?extension AS ?subject) }
          UNION {
            ?extension <https://open-metadata.org/ontology/hasExtensionProperty> ?subject .
            ?subject ?p ?o
          }
        }
        UNION {
          ?entity (<https://open-metadata.org/ontology/hasConstraint>
                   |<http://www.w3.org/ns/dqv#hasQualityMeasurement>) ?subject .
          ?subject ?p ?o
        }
        UNION {
          ?entity <https://open-metadata.org/ontology/hasOpenIncident> ?subject .
          ?subject ?p ?o
        }
        UNION {
          ?entity <https://open-metadata.org/ontology/hasTestResult> ?result .
          { ?result ?p ?o . BIND(?result AS ?subject) }
          UNION {
            ?result <https://open-metadata.org/ontology/hasResultValue> ?subject .
            ?subject ?p ?o
          }
        }
        UNION {
          ?entity <https://open-metadata.org/ontology/hasColumn> ?topColumn .
          ?topColumn (<https://open-metadata.org/ontology/hasChildColumn>)* ?column .
          { ?column ?p ?o . BIND(?column AS ?subject) }
          UNION {
            ?column <http://www.w3.org/ns/dqv#hasQualityMeasurement> ?subject .
            ?subject ?p ?o
          }
        }
        UNION {
          ?entity ?listProperty ?list .
          FILTER(isBlank(?list) || STRSTARTS(STR(?list), CONCAT(STR(?entity), "/list/")))
          ?list (<http://www.w3.org/1999/02/22-rdf-syntax-ns#rest>)* ?subject .
          ?subject ?p ?o .
          FILTER(?p IN (<http://www.w3.org/1999/02/22-rdf-syntax-ns#first>,
                        <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest>))
        }
        UNION {
          ?entity ?p ?o .
          FILTER(?o = <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil>
                 || (isIRI(?o) && STRSTARTS(STR(?o), CONCAT(STR(?entity), "/list/"))))
          BIND(?entity AS ?subject)
        }
        UNION {
          ?entity <https://open-metadata.org/ontology/hasConstraint> ?ownedConstraint .
          ?ownedConstraint (<https://open-metadata.org/ontology/hasConstraintMember>
                            |<https://open-metadata.org/ontology/hasConstrainedColumn>) ?subject .
          ?subject ?p ?o
        }
        """;
  }

  /**
   * Matches the concept binding edges into {@code ?entity} and into its columns, binding each as
   * {@code ?subject ?p ?o}. Their subjects are ontology terms the entity does not own, so only these
   * edges belong to it, never the terms' other triples.
   */
  public static String incomingBindingTriplesPattern() {
    return """
        {
          ?subject <%1$s> ?entity .
          BIND(<%1$s> AS ?p)
          BIND(?entity AS ?o)
        }
        UNION {
          ?entity <https://open-metadata.org/ontology/hasColumn> ?boundTopColumn .
          ?boundTopColumn (<https://open-metadata.org/ontology/hasChildColumn>)* ?o .
          ?subject <%2$s> ?o .
          BIND(<%2$s> AS ?p)
        }
        """
        .formatted(BOUND_ASSET, BOUND_COLUMN);
  }

  /** Whether {@code triple} of the entity's projection is one of its incoming binding edges. */
  public static boolean isIncomingBinding(
      final Triple triple, final Node entity, final Set<Node> ownedSubjects) {
    final String predicate = triple.getPredicate().getURI();
    return (BOUND_ASSET.equals(predicate) && entity.equals(triple.getObject()))
        || (BOUND_COLUMN.equals(predicate) && ownedSubjects.contains(triple.getObject()));
  }

  /** Names cell {@code index} of the list {@code ownerUri} holds under {@code predicateUri}. */
  public static String listCellIri(
      final String ownerUri, final String predicateUri, final int index) {
    return ownerUri
        + LIST_CELL_SEGMENT
        + URLEncoder.encode(predicateUri, StandardCharsets.UTF_8)
        + "/"
        + index;
  }

  /** Whether {@code value}, the object of one of the entity's triples, is a list the entity owns. */
  public static boolean isOwnedList(final String entityUri, final Node value) {
    return RDF.nil.asNode().equals(value) || isListCell(entityUri, value);
  }

  /**
   * The subjects {@link #ownedTriplesPattern()} reaches from {@code entity}, found by walking
   * {@code graph}, the entity's own projection, instead of the store.
   */
  public static Set<Node> ownedSubjects(final Graph graph, final Node entity) {
    final Set<Node> owned = new HashSet<>(objects(graph, entity, HAS_CUSTOM_PROPERTY));
    for (Node extension : objects(graph, entity, HAS_EXTENSION)) {
      owned.add(extension);
      owned.addAll(objects(graph, extension, HAS_EXTENSION_PROPERTY));
    }
    owned.addAll(objects(graph, entity, HAS_CONSTRAINT));
    owned.addAll(objects(graph, entity, HAS_QUALITY_MEASUREMENT));
    owned.addAll(testResults(graph, entity));
    owned.addAll(objects(graph, entity, HAS_OPEN_INCIDENT));
    final Set<Node> columns =
        descendants(graph, objects(graph, entity, HAS_COLUMN), HAS_CHILD_COLUMN);
    owned.addAll(columns);
    for (Node column : columns) {
      owned.addAll(objects(graph, column, HAS_QUALITY_MEASUREMENT));
    }
    owned.addAll(listCells(graph, entity));
    owned.addAll(constraintParts(graph, entity));
    return owned;
  }

  /**
   * A constraint's members and the table's own columns it names, including a name the table has no
   * column for, so no write leaves their triples behind.
   */
  private static Set<Node> constraintParts(final Graph graph, final Node entity) {
    final Set<Node> parts = new HashSet<>();
    for (Node constraint : objects(graph, entity, HAS_CONSTRAINT)) {
      parts.addAll(objects(graph, constraint, HAS_CONSTRAINT_MEMBER));
      parts.addAll(objects(graph, constraint, HAS_CONSTRAINED_COLUMN));
    }
    return parts;
  }

  private static Set<Node> testResults(final Graph graph, final Node entity) {
    final Set<Node> results = objects(graph, entity, HAS_TEST_RESULT);
    final Set<Node> owned = new HashSet<>(results);
    results.forEach(result -> owned.addAll(objects(graph, result, HAS_RESULT_VALUE)));
    return owned;
  }

  private static Set<Node> listCells(final Graph graph, final Node entity) {
    final String entityUri = entity.getURI();
    final Set<Node> heads = new HashSet<>();
    graph
        .find(entity, Node.ANY, Node.ANY)
        .forEachRemaining(
            triple -> {
              if (isListCell(entityUri, triple.getObject())) {
                heads.add(triple.getObject());
              }
            });
    final Set<Node> cells = descendants(graph, heads, RDF.rest.asNode());
    cells.removeIf(cell -> !isListCell(entityUri, cell));
    return cells;
  }

  private static boolean isListCell(final String entityUri, final Node value) {
    return value.isURI() && value.getURI().startsWith(entityUri + LIST_CELL_SEGMENT);
  }

  private static Set<Node> descendants(
      final Graph graph, final Set<Node> roots, final Node childPredicate) {
    final Set<Node> reached = new HashSet<>(roots);
    final Deque<Node> pending = new ArrayDeque<>(roots);
    while (!pending.isEmpty()) {
      for (Node child : objects(graph, pending.pop(), childPredicate)) {
        if (reached.add(child)) {
          pending.push(child);
        }
      }
    }
    return reached;
  }

  private static Set<Node> objects(final Graph graph, final Node subject, final Node predicate) {
    final Set<Node> objects = new HashSet<>();
    graph
        .find(subject, predicate, Node.ANY)
        .mapWith(Triple::getObject)
        .forEachRemaining(objects::add);
    return objects;
  }
}
