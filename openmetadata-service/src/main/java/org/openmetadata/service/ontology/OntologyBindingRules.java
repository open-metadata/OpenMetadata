package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.util.ChildFieldResolver;

public final class OntologyBindingRules {
  public static final int MAX_ASSET_COLUMNS = 100;
  public static final int MAX_CONCEPT_COLUMNS = 500;
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

  /** Column bindings compare as a set, so resending them in another order is the same binding. */
  public static boolean sameColumns(
      final List<OntologyColumnBinding> stored, final List<OntologyColumnBinding> requested) {
    return new HashSet<>(listOrEmpty(stored)).equals(new HashSet<>(listOrEmpty(requested)));
  }

  /** The revision a changed write commits, or 409 when the writer did not see the current one. */
  public static long nextRevision(final long current, final long expected) {
    if (current != expected || current == MAX_REVISION) {
      throw new ClientErrorException(
          "Concept bindings changed; reload before editing", Response.Status.CONFLICT);
    }
    return current + 1;
  }

  public static void requireColumnCapacity(final int boundColumns) {
    if (boundColumns > MAX_CONCEPT_COLUMNS) {
      throw new BadRequestException("Concept bindings exceed the 500 column limit");
    }
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
