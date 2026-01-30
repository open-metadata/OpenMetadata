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
   * Atomically swap aliases from old indices to a new index.
   * This operation removes the specified aliases from any old indices and adds them to the new index
   * in a single atomic operation, ensuring zero-downtime during index promotion.
   *
   * @param oldIndices the set of old index names to remove aliases from
   * @param newIndex the new index name to add aliases to
   * @param aliases the set of aliases to swap
   * @return true if the swap was successful, false otherwise
   */
  boolean swapAliases(Set<String> oldIndices, String newIndex, Set<String> aliases);

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
}
