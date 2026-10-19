package org.openmetadata.service.ontology;

import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.llm.LLMClientHolder;

/** Feature gate for Ontology AI: the RDF switch and an enabled completion model must both be on. */
public final class OntologyAiAvailability {
  private OntologyAiAvailability() {}

  public static boolean isEnabled(final RdfConfiguration rdfConfiguration) {
    return rdfConfiguration != null
        && (Boolean.TRUE.equals(rdfConfiguration.getAiEnabled())
            || Boolean.TRUE.equals(rdfConfiguration.getAskCollateEnabled()))
        && LLMClientHolder.isEnabled();
  }
}
