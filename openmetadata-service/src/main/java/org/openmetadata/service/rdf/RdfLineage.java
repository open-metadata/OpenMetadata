package org.openmetadata.service.rdf;

import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;

/** Canonical RDF direction for a SQL lineage edge from a source to its output. */
public final class RdfLineage {
  public static final String UPSTREAM = "https://open-metadata.org/ontology/upstream";
  public static final String DOWNSTREAM = "https://open-metadata.org/ontology/downstream";
  public static final String LEGACY_UPSTREAM = "https://open-metadata.org/ontology/UPSTREAM";
  public static final String DERIVED_FROM = "http://www.w3.org/ns/prov#wasDerivedFrom";
  private static final String HAS_LINEAGE_DETAILS =
      "https://open-metadata.org/ontology/hasLineageDetails";
  private static final String HAS_COLUMN_LINEAGE =
      "https://open-metadata.org/ontology/hasColumnLineage";
  private static final String HAD_PLAN = "http://www.w3.org/ns/prov#hadPlan";

  private RdfLineage() {}

  public static void addToModel(final Model model, final Resource source, final Resource output) {
    output.addProperty(model.createProperty(UPSTREAM), source);
    output.addProperty(model.createProperty(DERIVED_FROM), source);
    source.addProperty(model.createProperty(DOWNSTREAM), output);
  }

  /**
   * Matches, as {@code ?subject ?p ?o}, every triple of the lineage details of the edges that
   * {@code ?entity} is an end of: the details node, its column lineage and plan, and the links to
   * it. Column lineage names the columns of both ends, so details left behind would keep a column
   * path through a deleted entity. Details of an edge into {@code ?entity} hang off its source and
   * are named {@code lineageDetails/<source id>/<entity id>}.
   */
  static String incidentDetailsTriplesPattern(final String entityId) {
    return """
        {
          { ?entity <%1$s> ?details }
          UNION {
            ?entity (<%2$s>|<%3$s>|^<%4$s>|^<%5$s>) ?source .
            ?source <%1$s> ?details .
            FILTER(STRENDS(STR(?details), "/%6$s"))
          }
        }
        {
          { ?details ?p ?o . BIND(?details AS ?subject) }
          UNION { ?details (<%7$s>|<%8$s>) ?subject . ?subject ?p ?o }
          UNION { ?subject ?p ?details . BIND(?details AS ?o) }
        }
        """
        .formatted(
            HAS_LINEAGE_DETAILS,
            UPSTREAM,
            DERIVED_FROM,
            DOWNSTREAM,
            LEGACY_UPSTREAM,
            entityId,
            HAS_COLUMN_LINEAGE,
            HAD_PLAN);
  }

  static String legacyDeleteUpdate(final String graph, final String source, final String output) {
    return """
        DELETE { GRAPH <%1$s> { ?deleteSubject ?deletePredicate ?deleteObject } }
        WHERE { GRAPH <%1$s> {
          { VALUES (?deleteSubject ?deletePredicate ?deleteObject) { (<%2$s> <%4$s> <%3$s>) }
            ?deleteSubject ?deletePredicate ?deleteObject }
          UNION { %5$s }
        } }
        """
        .formatted(
            graph,
            source,
            output,
            LEGACY_UPSTREAM,
            legacyReverseDeletePattern("(<" + source + "> <" + output + ">)"));
  }

  static String legacyReverseDeletePattern(final String sourceOutputValues) {
    // Old live writes reversed PROV causation. Preserve a real reciprocal edge
    // if any canonical or legacy direction marker supports it.
    return """
        VALUES (?deleteSubject ?deleteObject) { %1$s }
        ?deleteSubject <%2$s> ?deleteObject .
        FILTER NOT EXISTS { ?deleteObject (<%3$s>|<%4$s>|^<%5$s>) ?deleteSubject }
        BIND(<%2$s> AS ?deletePredicate)
        """
        .formatted(sourceOutputValues, DERIVED_FROM, DOWNSTREAM, LEGACY_UPSTREAM, UPSTREAM);
  }
}
