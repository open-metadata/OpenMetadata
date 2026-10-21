package org.openmetadata.schema;

import java.net.URI;

/** Ontology definitions with a stable semantic IRI. */
public interface OntologyEntityInterface extends OntologyDefinition {
  URI getIri();

  void setIri(URI iri);
}
