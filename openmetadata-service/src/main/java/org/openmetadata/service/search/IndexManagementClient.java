package org.openmetadata.service.search;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.openmetadata.search.IndexMapping;

/**
 * Interface for managing search index operations.
 * This interface provides methods for creating, updating, deleting indices
 * and managing index aliases.
 */
public interface IndexManagementClient {

  /**
   * Check if an index exists.
   *
   * @param indexName the name of the index
   * @return true if the index exists, false otherwise
   */
  boolean indexExists(String indexName);

  /**
   * Create a new index with the given mapping.
   *
   * @param indexMapping the index mapping configuration
   * @param indexMappingContent the JSON content for index mapping
   */
  void createIndex(IndexMapping indexMapping, String indexMappingContent);

  /**
   * Update an existing index with new mapping.
   *
   * @param indexMapping the index mapping configuration
   * @param indexMappingContent the JSON content for index mapping
   */
  void updateIndex(IndexMapping indexMapping, String indexMappingContent);

  /**
   * Delete an index.
   *
   * @param indexMapping the index mapping configuration
   */
  void deleteIndex(IndexMapping indexMapping);

  /**
   * Create aliases for an index.
   *
   * @param indexMapping the index mapping configuration
   */
  void createAliases(IndexMapping indexMapping);

  /**
   * Add one or more aliases to an index.
   *
   * @param indexMapping the index mapping configuration
   * @param aliasName the alias names to add
   */
  void addIndexAlias(IndexMapping indexMapping, String... aliasName);

  /**
   * Create a new index with the given name and mapping content.
   *
   * @param indexName the name of the index to create
   * @param indexMappingContent the JSON content for index mapping
   */
  void createIndex(String indexName, String indexMappingContent);

  /**
   * Delete an index by name.
   *
   * @param indexName the name of the index to delete
   */
  void deleteIndex(String indexName);

  /**
   * Delete an index with exponential backoff retry strategy.
   * This method retries deletion if it fails due to snapshot operations or transient errors.
   *
   * @param indexName the name of the index to delete
   */
  void deleteIndexWithBackoff(String indexName);

  /**
   * Add aliases to an index.
   *
   * @param indexName the name of the index
   * @param aliases the set of aliases to add
   */
  void addAliases(String indexName, Set<String> aliases);

  /**
   * Remove aliases from an index.
   *
   * @param indexName the name of the index
   * @param aliases the set of aliases to remove
   */
  void removeAliases(String indexName, Set<String> aliases);

  /**
   * Atomically swap aliases from old indices to a new index, optionally deleting concrete indices
   * in the same request. Removing the aliases from old indices, deleting any {@code indicesToRemove}
   * (via {@code remove_index}) and adding the aliases to the new index all happen in a single atomic
   * {@code updateAliases} call.
   *
   * <p>{@code indicesToRemove} is for the first-install / post-orphan shape where the canonical name
   * (e.g. {@code table_search_index}) is still a <em>concrete</em> index sharing the alias name.
   * Deleting it separately before the swap would orphan the alias if the alias add then failed;
   * folding the delete into the atomic request means a failure is a no-op — the concrete index and
   * its live aliases survive — instead of leaving the canonical name pointing at nothing.
   *
   * @param oldIndices the set of old index names to remove aliases from
   * @param newIndex the new index name to add aliases to
   * @param aliases the set of aliases to swap
   * @param indicesToRemove concrete indices to delete atomically within the same request
   * @return true if the swap was successful, false otherwise
   */
  boolean swapAliases(
      Set<String> oldIndices, String newIndex, Set<String> aliases, Set<String> indicesToRemove);

  /** Swap aliases without atomically removing any concrete index. */
  default boolean swapAliases(Set<String> oldIndices, String newIndex, Set<String> aliases) {
    return swapAliases(oldIndices, newIndex, aliases, Set.of());
  }

  /**
   * Get all aliases for an index.
   *
   * @param indexName the name of the index
   * @return set of aliases for the index
   */
  Set<String> getAliases(String indexName);

  /**
   * Get all indices that have a specific alias.
   *
   * @param aliasName the name of the alias
   * @return set of indices that have the alias
   */
  Set<String> getIndicesByAlias(String aliasName);

  /**
   * Get all indices that match the given prefix.
   *
   * @param prefix the prefix to match index names against
   * @return set of indices that start with the prefix
   */
  Set<String> listIndicesByPrefix(String prefix);

  record IndexStats(
      String name,
      long documents,
      int primaryShards,
      int replicaShards,
      long sizeInBytes,
      String health,
      Set<String> aliases) {}

  List<IndexStats> getAllIndexStats() throws IOException;

  /**
   * Get the document count for a specific index.
   *
   * @param indexName the name of the index
   * @return the number of documents in the index, or -1 if count cannot be determined
   */
  default long getDocumentCount(String indexName) {
    try {
      for (IndexStats stats : getAllIndexStats()) {
        if (stats.name().equals(indexName)) {
          return stats.documents();
        }
      }
    } catch (Exception e) {
      return -1;
    }
    return 0;
  }
}
