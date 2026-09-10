package org.openmetadata.service.rdf;

/** Owned subresources must be replaced along with the entity links that identify them. */
public final class RdfOwnedResources {
  private RdfOwnedResources() {}

  /** Matches owned triples without traversing shared entity references. */
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
        """;
  }
}
