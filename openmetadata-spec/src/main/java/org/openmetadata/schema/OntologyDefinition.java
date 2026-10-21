package org.openmetadata.schema;

import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;

/** Independently stored ontology content and immutable release snapshots. */
public interface OntologyDefinition extends EntityInterface<EntityStatus> {
  default EntityReference getOntology() {
    return null;
  }

  default void setOntology(EntityReference ontology) {
    throw new UnsupportedOperationException("An ontology has no owning ontology");
  }
}
