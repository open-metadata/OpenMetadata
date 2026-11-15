package org.openmetadata.service.rdf;

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
          ?entity <https://open-metadata.org/ontology/hasColumn> ?topColumn .
          ?topColumn (<https://open-metadata.org/ontology/hasChildColumn>)* ?subject .
          ?subject ?p ?o
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
        """;
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
    owned.addAll(descendants(graph, objects(graph, entity, HAS_COLUMN), HAS_CHILD_COLUMN));
    owned.addAll(listCells(graph, entity));
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
