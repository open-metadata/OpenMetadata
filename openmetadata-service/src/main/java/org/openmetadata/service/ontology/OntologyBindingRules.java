package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptBindings;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.util.ChildFieldResolver;

public final class OntologyBindingRules {
  private static final int MAX_ASSETS = 100;
  private static final int MAX_ASSET_COLUMNS = 100;
  private static final int MAX_CONCEPT_COLUMNS = 500;
  private static final int MAX_PATH_DEPTH = 32;
  private static final int MAX_SEGMENT_LENGTH = 256;
  private static final long MAX_REVISION = 9_007_199_254_740_991L;

  private OntologyBindingRules() {}

  public static void requireRevision(final Long revision) {
    if (revision == null || revision < 0 || revision > MAX_REVISION) {
      throw new BadRequestException(
          "A nonnegative, exactly representable binding revision is required");
    }
  }

  public static void validate(final OntologyAssetBinding asset) {
    if (asset == null || asset.getAssetId() == null || asset.getAssetType() == null) {
      throw new BadRequestException("A supported asset type and UUID are required");
    }
    final var columns = listOrEmpty(asset.getColumns());
    if (columns.size() > MAX_ASSET_COLUMNS
        || (!columns.isEmpty() && asset.getAssetType() != OntologyBindingAssetType.TABLE)) {
      throw new BadRequestException(
          "Only tables support column bindings, with at most 100 per asset");
    }
    columns.forEach(OntologyBindingRules::validateColumn);
    if (new HashSet<>(columns).size() != columns.size()) {
      throw new BadRequestException("Duplicate property and column bindings are not allowed");
    }
  }

  private static void validateColumn(final OntologyColumnBinding binding) {
    if (binding == null || binding.getPropertyId() == null) {
      throw new BadRequestException("A column binding requires a property UUID");
    }
    final var path = listOrEmpty(binding.getColumnPath());
    if (path.isEmpty()
        || path.size() > MAX_PATH_DEPTH
        || path.stream().anyMatch(OntologyBindingRules::invalidSegment)) {
      throw new BadRequestException(
          "Column paths require 1 to 32 nonblank name segments of at most 256 characters");
    }
  }

  private static boolean invalidSegment(final String segment) {
    return segment == null
        || segment.isBlank()
        || segment.length() > MAX_SEGMENT_LENGTH
        || segment.codePoints().anyMatch(Character::isISOControl);
  }

  public static OntologyConceptBindings replace(
      final OntologyConceptBindings current,
      final OntologyAssetBinding asset,
      final Long expectedRevision) {
    requireRevision(expectedRevision);
    validate(asset);
    final var existing = find(current, asset.getAssetType(), asset.getAssetId());
    if (existing != null
        && new HashSet<>(listOrEmpty(existing.getColumns()))
            .equals(new HashSet<>(listOrEmpty(asset.getColumns())))) {
      return current;
    }
    final var assets = new ArrayList<>(current.getAssets());
    assets.removeIf(value -> sameAsset(value, asset.getAssetType(), asset.getAssetId()));
    assets.add(
        new OntologyAssetBinding()
            .withAssetType(asset.getAssetType())
            .withAssetId(asset.getAssetId())
            .withColumns(List.copyOf(listOrEmpty(asset.getColumns()))));
    return changed(current, assets, expectedRevision);
  }

  public static OntologyConceptBindings remove(
      final OntologyConceptBindings current,
      final OntologyBindingAssetType assetType,
      final UUID assetId,
      final Long expectedRevision) {
    requireRevision(expectedRevision);
    final var assets =
        current.getAssets().stream()
            .filter(value -> !sameAsset(value, assetType, assetId))
            .toList();
    return assets.size() == current.getAssets().size()
        ? current
        : changed(current, assets, expectedRevision);
  }

  public static OntologyAssetBinding find(
      final OntologyConceptBindings current, final OntologyBindingAssetType type, final UUID id) {
    return current.getAssets().stream()
        .filter(asset -> sameAsset(asset, type, id))
        .findFirst()
        .orElse(null);
  }

  private static boolean sameAsset(
      final OntologyAssetBinding asset, final OntologyBindingAssetType type, final UUID id) {
    return asset.getAssetType() == type && asset.getAssetId().equals(id);
  }

  private static OntologyConceptBindings changed(
      final OntologyConceptBindings current,
      final List<OntologyAssetBinding> assets,
      final Long expectedRevision) {
    if (!current.getRevision().equals(expectedRevision) || current.getRevision() == MAX_REVISION) {
      throw new ClientErrorException(
          "Concept bindings changed; reload before editing", Response.Status.CONFLICT);
    }
    if (assets.size() > MAX_ASSETS
        || assets.stream().mapToInt(asset -> listOrEmpty(asset.getColumns()).size()).sum()
            > MAX_CONCEPT_COLUMNS) {
      throw new BadRequestException("Concept bindings exceed the 100 asset or 500 column limit");
    }
    return new OntologyConceptBindings()
        .withRevision(current.getRevision() + 1)
        .withAssets(List.copyOf(assets));
  }

  public static Column resolveColumn(final Table table, final List<String> path) {
    List<? extends FieldInterface> candidates = ChildFieldResolver.childrenOf(table, Entity.TABLE);
    FieldInterface selected = null;
    for (final String segment : path) {
      selected =
          candidates.stream()
              .filter(column -> segment.equals(column.getName()))
              .findFirst()
              .orElse(null);
      candidates = selected == null ? List.of() : listOrEmpty(selected.getChildren());
    }
    return selected instanceof Column column ? column : null;
  }

  public static boolean isApplicable(
      final OntologyConcept concept, final OntologyProperty property, final Set<String> ancestors) {
    return !Boolean.TRUE.equals(property.getDeleted())
        && property.getKind() == OntologyPropertyKind.DATA
        && concept.getOntology().getId().equals(property.getOntology().getId())
        && listOrEmpty(property.getDomain()).stream()
            .anyMatch(iri -> ancestors.contains(iri.toString()));
  }
}
