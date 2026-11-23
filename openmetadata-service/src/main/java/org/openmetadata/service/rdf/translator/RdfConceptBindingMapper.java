package org.openmetadata.service.rdf.translator;

import java.util.Arrays;
import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.service.ontology.OntologyBindingRules;
import org.openmetadata.service.rdf.RdfUtils;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedBinding;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedColumn;

/**
 * Projects an asset's Ontology Studio bindings as edges into the asset: the concept to the asset,
 * and each assigned property to the column it is bound to. The subjects are the IRIs the active
 * release graph gives the concept and the property, the objects the IRIs the catalog projection
 * mints, so one traversal joins the business model and the catalog. The asset owns these edges
 * (RdfOwnedResources#incomingBindingTriplesPattern), so its writes replace and delete them.
 */
public final class RdfConceptBindingMapper {
  // Collate reads these predicate IRIs when querying concept bindings.
  public static final String BOUND_ASSET = "https://open-metadata.org/ontology/boundAsset";
  public static final String BOUND_COLUMN = "https://open-metadata.org/ontology/boundColumn";

  private RdfConceptBindingMapper() {}

  public static boolean isBindable(final String entityType) {
    return Arrays.stream(OntologyBindingAssetType.values())
        .anyMatch(type -> type.value().equals(entityType));
  }

  static void emit(
      final EntityInterface<?> asset,
      final List<ServedBinding> bindings,
      final Resource assetResource,
      final Model model,
      final String baseUri) {
    final Property boundAsset = model.createProperty(BOUND_ASSET);
    final Property boundColumn = model.createProperty(BOUND_COLUMN);
    for (final ServedBinding binding : bindings) {
      model.createResource(binding.conceptIri()).addProperty(boundAsset, assetResource);
      if (asset instanceof Table table) {
        binding.columns().forEach(column -> emitColumn(table, column, boundColumn, model, baseUri));
      }
    }
  }

  /** A path that no longer resolves stays unresolved until it is rebound, and projects nothing. */
  private static void emitColumn(
      final Table table,
      final ServedColumn assignment,
      final Property boundColumn,
      final Model model,
      final String baseUri) {
    final Column column = OntologyBindingRules.resolveColumn(table, assignment.columnPath());
    final String columnUri =
        column == null ? null : RdfUtils.columnUri(baseUri, column.getFullyQualifiedName());
    if (columnUri != null) {
      model
          .createResource(assignment.propertyIri())
          .addProperty(boundColumn, model.createResource(columnUri));
    }
  }
}
