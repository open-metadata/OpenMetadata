package org.openmetadata.service.rdf;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.rdf.OwlEntityDeclarations.EntityKind;

/** Exports authorized, verified release content independently of the optional RDF service. */
public final class OntologyReleaseExporter {
  private static final String ASSET_BASE = "https://open-metadata.org/entity/";
  private final OntologyReleaseReader reader;

  public OntologyReleaseExporter(final OntologyReleaseRepository releases) {
    reader = new OntologyReleaseReader(releases.getDaoCollection());
  }

  public String export(
      final OntologyRelease release,
      final OntologyExportFormat format,
      final OntologyExportOptions options,
      final Consumer<List<? extends OntologyDefinition>> authorize,
      final BoundAssetLinks assetLinks) {
    requireSupported(format, options);
    return render(release, reader.read(release, authorize), format, options, assetLinks);
  }

  static String render(
      final OntologyRelease release,
      final List<OntologyReleaseMember> members,
      final OntologyExportFormat format,
      final OntologyExportOptions options,
      final BoundAssetLinks assetLinks) {
    requireSupported(format, options);
    return format.isGraph()
        ? graph(release, members, format, options, assetLinks)
        : csv(release, members, options);
  }

  private static void requireSupported(
      final OntologyExportFormat format, final OntologyExportOptions options) {
    if (!format.isGraph() && options.includeBoundAssets()) {
      throw new BadRequestException(
          "Bound asset links cannot be written to " + format.externalName());
    }
  }

  private static String graph(
      final OntologyRelease release,
      final List<OntologyReleaseMember> members,
      final OntologyExportFormat format,
      final OntologyExportOptions options,
      final BoundAssetLinks assetLinks) {
    final Model model = project(release, members, format, options);
    try {
      if (options.includeBoundAssets()) {
        addBoundAssets(model, release, members, assetLinks);
      }
      return RdfGraphSerializer.asString(model, format.serialization());
    } finally {
      model.close();
    }
  }

  private static Model project(
      final OntologyRelease release,
      final List<OntologyReleaseMember> members,
      final OntologyExportFormat format,
      final OntologyExportOptions options) {
    return switch (format) {
      case SKOS -> new OntologySkosProjection(false).build(release, members);
      case SKOS_XL -> new OntologySkosProjection(true).build(release, members);
      default -> new OntologyReleaseProjection().build(release, members, options.includeInverses());
    };
  }

  private static void addBoundAssets(
      final Model model,
      final OntologyRelease release,
      final List<OntologyReleaseMember> members,
      final BoundAssetLinks assetLinks) {
    OwlEntityDeclarations.declare(
        model, OntologyRdfVocabulary.BOUND_ASSET, EntityKind.ANNOTATION_PROPERTY);
    members.stream()
        .filter(member -> member.getMemberKind() == MemberKind.CONCEPT)
        .map(member -> (OntologyConcept) OntologyReleaseReader.definition(release, member))
        .forEach(
            concept ->
                assetLinks
                    .assetsOf(concept)
                    .forEach(
                        asset ->
                            model
                                .createResource(concept.getIri().toString())
                                .addProperty(
                                    OntologyRdfVocabulary.BOUND_ASSET,
                                    model.createResource(asset.toString()))));
  }

  private static String csv(
      final OntologyRelease release,
      final List<OntologyReleaseMember> members,
      final OntologyExportOptions options) {
    final List<OntologyDefinition> definitions =
        members.stream().map(member -> OntologyReleaseReader.definition(release, member)).toList();
    final List<OntologyProperty> properties = ofType(definitions, OntologyProperty.class);
    if (!options.includeInverses()) {
      properties.forEach(property -> property.setInverse(null));
    }
    final Ontology root = OntologyReleaseReader.root(release, members);
    return NativeOntologyCsvCodec.write(
        new NativeOntologyDocument(
            new NativeOntologyDocument.Header(
                root.getIri(), root.getDisplayName(), root.getDescription()),
            ofType(definitions, OntologyConcept.class),
            properties,
            ofType(definitions, OntologyAxiom.class)));
  }

  private static <T extends OntologyDefinition> List<T> ofType(
      final List<OntologyDefinition> definitions, final Class<T> type) {
    return definitions.stream().filter(type::isInstance).map(type::cast).toList();
  }

  /** The IRI an asset has in the RDF store, so exported links meet the same node there. */
  public static URI assetIri(final String assetType, final UUID assetId) {
    return URI.create(ASSET_BASE + assetType + "/" + assetId);
  }
}
