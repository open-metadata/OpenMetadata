package org.openmetadata.service.rdf;

import java.net.URI;
import java.util.List;
import org.openmetadata.schema.entity.data.OntologyConcept;

/** The assets bound to a concept that the exporting caller may see. */
@FunctionalInterface
public interface BoundAssetLinks {
  BoundAssetLinks NONE = concept -> List.of();

  List<URI> assetsOf(OntologyConcept concept);
}
