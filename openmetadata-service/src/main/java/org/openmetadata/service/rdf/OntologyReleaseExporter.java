package org.openmetadata.service.rdf;

import java.util.List;
import java.util.function.Consumer;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.ontology.OntologyReleaseReader;

/** Exports authorized, verified release content independently of the optional RDF service. */
public final class OntologyReleaseExporter {
  private final OntologyReleaseReader reader;

  public OntologyReleaseExporter(final OntologyReleaseRepository releases) {
    reader = new OntologyReleaseReader(releases.getDaoCollection());
  }

  public String export(
      final OntologyRelease release,
      final RdfSerializationFormat format,
      final Consumer<List<? extends OntologyDefinition>> authorize) {
    final var closure = reader.read(release, authorize);
    final Model model = new OntologyReleaseProjection().build(release, closure);
    try {
      return RdfGraphSerializer.asString(model, format);
    } finally {
      model.close();
    }
  }
}
