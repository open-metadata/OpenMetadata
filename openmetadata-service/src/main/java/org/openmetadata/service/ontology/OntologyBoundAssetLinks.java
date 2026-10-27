package org.openmetadata.service.ontology;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyHydratedAssetBinding;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.BoundAssetLinks;
import org.openmetadata.service.rdf.OntologyReleaseExporter;
import org.openmetadata.service.security.AuthorizationException;

/**
 * Reads the bindings the caller may see, one concept at a time. A concept deleted since the capture
 * or hidden from the caller has no links, because a release export must not fail on live state that
 * is not part of the release.
 */
public final class OntologyBoundAssetLinks implements BoundAssetLinks {
  static final int MAX_LINKS = 100_000;
  private final OntologyConceptBindingService bindings;
  private final OntologyConceptBindingService.Access access;
  private final int maxLinks;
  private int linked;

  public OntologyBoundAssetLinks(
      final OntologyConceptBindingService bindings,
      final OntologyConceptBindingService.Access access) {
    this(bindings, access, MAX_LINKS);
  }

  OntologyBoundAssetLinks(
      final OntologyConceptBindingService bindings,
      final OntologyConceptBindingService.Access access,
      final int maxLinks) {
    this.bindings = bindings;
    this.access = access;
    this.maxLinks = maxLinks;
  }

  @Override
  public List<URI> assetsOf(final OntologyConcept concept) {
    final List<URI> links = new ArrayList<>();
    try {
      String after = null;
      do {
        final OntologyConceptBindingsResponse page =
            bindings.get(
                access, concept.getId(), OntologyConceptBindingService.MAX_PAGE_SIZE, after);
        page.getAssets().forEach(binding -> links.add(link(binding)));
        after = page.getAfter();
        requireCapacity(links.size());
      } while (after != null);
    } catch (final EntityNotFoundException | AuthorizationException unavailable) {
      return List.of();
    }
    linked += links.size();
    return List.copyOf(links);
  }

  private void requireCapacity(final int pending) {
    if (linked + pending > maxLinks) {
      throw new BadRequestException(
          "A release export holds at most " + maxLinks + " bound asset links");
    }
  }

  private static URI link(final OntologyHydratedAssetBinding binding) {
    return OntologyReleaseExporter.assetIri(binding.getAssetType().value(), binding.getAssetId());
  }
}
