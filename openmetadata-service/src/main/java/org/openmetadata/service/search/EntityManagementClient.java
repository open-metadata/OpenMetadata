package org.openmetadata.service.search;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.tuple.Pair;

/**
 * Interface for entity management operations in search.
 * This interface defines methods for creating, updating, and deleting entities
 * in Elasticsearch/OpenSearch indices.
 */
public interface EntityManagementClient {

  /**
   * Creates or updates an entity in the specified index.
   *
   * @param indexName the name of the index
   * @param docId the document ID
   * @param doc the document content as JSON string
   */
  void createEntity(String indexName, String docId, String doc);

  /**
   * Creates or updates multiple entities in the specified index.
   *
   * @param indexName the name of the index
   * @param docsAndIds list of document ID and content pairs
   * @throws IOException if there's an error during bulk operation
   */
  void createEntities(String indexName, List<Map<String, String>> docsAndIds) throws IOException;

  /**
   * Creates or updates a time series entity in the specified index.
   *
   * @param indexName the name of the index
   * @param docId the document ID
   * @param doc the document content as JSON string
   */
  void createTimeSeriesEntity(String indexName, String docId, String doc);

  /**
   * Deletes an entity from the specified index.
   *
   * @param indexName the name of the index
   * @param docId the document ID to delete
   */
  void deleteEntity(String indexName, String docId);

  /**
   * Deletes entities from indices based on field values.
   *
   * @param indexNames the list of index names
   * @param fieldAndValue list of field-value pairs to match for deletion
   */
  void deleteEntityByFields(List<String> indexNames, List<Pair<String, String>> fieldAndValue);

  /**
   * Deletes entities from an index by FQN prefix.
   *
   * @param indexName the name of the index
   * @param fqnPrefix the FQN prefix to match for deletion
   */
  void deleteEntityByFQNPrefix(String indexName, String fqnPrefix);

  /**
   * Deletes entities from an index using a script query.
   *
   * @param indexName the name of the index
   * @param scriptTxt the script text for the deletion query
   * @param params the parameters for the script
   */
  void deleteByScript(String indexName, String scriptTxt, java.util.Map<String, Object> params);
}
