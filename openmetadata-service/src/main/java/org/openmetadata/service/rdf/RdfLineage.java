package org.openmetadata.service.rdf;

import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;

/** Canonical RDF direction for a SQL lineage edge from a source to its output. */
public final class RdfLineage {
  public static final String UPSTREAM = "https://open-metadata.org/ontology/upstream";
  public static final String DOWNSTREAM = "https://open-metadata.org/ontology/downstream";
  public static final String LEGACY_UPSTREAM = "https://open-metadata.org/ontology/UPSTREAM";
  public static final String DERIVED_FROM = "http://www.w3.org/ns/prov#wasDerivedFrom";

  private RdfLineage() {}

  public static void addToModel(final Model model, final Resource source, final Resource output) {
    output.addProperty(model.createProperty(UPSTREAM), source);
    output.addProperty(model.createProperty(DERIVED_FROM), source);
    source.addProperty(model.createProperty(DOWNSTREAM), output);
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
