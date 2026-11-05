package org.openmetadata.service.ontology;

import java.util.List;
import java.util.function.Consumer;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.OntologyReleaseStructureReport;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;

/** Evaluates the authorized immutable closure without changing review or publication state. */
public final class OntologyReleaseStructure {
  private final OntologyReleaseReader reader;

  public OntologyReleaseStructure(final OntologyReleaseRepository releases) {
    reader = new OntologyReleaseReader(releases.getDaoCollection());
  }

  public OntologyReleaseStructureReport report(
      final OntologyRelease release, final Consumer<List<? extends OntologyDefinition>> authorize) {
    return OntologyStructureValidator.validate(release, reader.read(release, authorize));
  }
}
