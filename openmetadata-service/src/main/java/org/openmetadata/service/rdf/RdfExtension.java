package org.openmetadata.service.rdf;

/** Owned extension subresources must be replaced along with the entity's extension link. */
public final class RdfExtension {
  private RdfExtension() {}

  /** Matches extension triples owned by {@code ?entity}, binding {@code ?subject ?p ?o}. */
  public static String ownedTriplesPattern() {
    return """
        ?entity <https://open-metadata.org/ontology/hasExtension> ?extension .
        { ?extension ?p ?o . BIND(?extension AS ?subject) }
        UNION {
          ?extension <https://open-metadata.org/ontology/hasExtensionProperty> ?subject .
          ?subject ?p ?o
        }
        """;
  }
}
