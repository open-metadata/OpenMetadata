package org.openmetadata.service.search.security;

import java.util.List;

/**
 * How one kind of search document spells the two things a compiled search policy reads that differ
 * between kinds: which resource the document belongs to, and the id of the entity it describes.
 *
 * <p>Entity documents live in one index per resource and carry their own {@code id}. Vector chunk
 * documents share a single index for every entity type, name their type in {@code entityType} and
 * carry their entity's id as {@code parentId}; every other field a policy reads has the same name on
 * both (ADR:2026-10-23-search-access-policies-apply-to-vector-chunks).
 *
 * @param entityIdField the field holding the id of the entity a document describes
 * @param scopesByIndex whether a rule's resources select documents by index ({@code _index}) rather
 *     than by {@code entityType}
 */
public record SearchDocumentFields(String entityIdField, boolean scopesByIndex) {

  public static final SearchDocumentFields ENTITY_DOCUMENTS =
      new SearchDocumentFields("id.keyword", true);
  public static final SearchDocumentFields CHUNK_DOCUMENTS =
      new SearchDocumentFields("parentId", false);

  private static final String ALL_RESOURCES = "All";

  /**
   * Whether a rule naming {@code resources} applies to every document of this kind. Entity documents
   * keep the exact {@code All} match normal search has always used: a lowercase {@code all} there
   * compiles to the {@code all} alias, which covers every entity index. The chunk index sits under no
   * such alias, so for chunks {@code all} in any case means every document.
   */
  public boolean leavesUnscoped(List<String> resources) {
    boolean namesAll =
        scopesByIndex
            ? resources.contains(ALL_RESOURCES)
            : resources.stream().anyMatch(ALL_RESOURCES::equalsIgnoreCase);
    return resources.isEmpty() || namesAll;
  }
}
