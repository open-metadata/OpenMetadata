package org.openmetadata.service.search;

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
}
