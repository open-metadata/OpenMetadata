package org.openmetadata.service.search;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
  void createEntity(String indexName, String docId, String doc) throws IOException;

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
  void createTimeSeriesEntity(String indexName, String docId, String doc) throws IOException;

  /**
   * Deletes an entity from the specified index.
   *
   * @param indexName the name of the index
   * @param docId the document ID to delete
   */
  void deleteEntity(String indexName, String docId) throws IOException;

  /**
   * Deletes entities from indices based on field values.
   *
   * @param indexNames the list of index names
   * @param fieldAndValue list of field-value pairs to match for deletion
   */
  void deleteEntityByFields(List<String> indexNames, List<Pair<String, String>> fieldAndValue)
      throws IOException;

  /**
   * Deletes entities from an index by FQN prefix.
   *
   * @param indexName the name of the index
   * @param fqnPrefix the FQN prefix to match for deletion
   */
  void deleteEntityByFQNPrefix(String indexName, String fqnPrefix) throws IOException;

  /**
   * Deletes entities from an index using a script query.
   *
   * @param indexName the name of the index
   * @param scriptTxt the script text for the deletion query
   * @param params the parameters for the script
   */
  void deleteByScript(String indexName, String scriptTxt, Map<String, Object> params)
      throws IOException;

  /**
   * Soft deletes or restores an entity using a script update.
   *
   * @param indexName the name of the index
   * @param docId the document ID to update
   * @param scriptTxt the script text for the update operation
   */
  void softDeleteOrRestoreEntity(String indexName, String docId, String scriptTxt)
      throws IOException;

  /**
   * Soft deletes or restores child entities using a script update.
   *
   * @param indexNames the list of index names
   * @param scriptTxt the script text for the update operation
   * @param fieldAndValue list of field-value pairs to match for the update
   */
  void softDeleteOrRestoreChildren(
      List<String> indexNames, String scriptTxt, List<Pair<String, String>> fieldAndValue)
      throws IOException;

  /**
   * Updates an entity using a script with parameters.
   *
   * @param indexName the index name
   * @param docId the document ID
   * @param doc the document parameters for the script
   * @param scriptTxt the script text for the update
   */
  void updateEntity(String indexName, String docId, Map<String, Object> doc, String scriptTxt);

  /**
   * Updates child entities matching field and value with a script.
   *
   * @param indexName the index name
   * @param fieldAndValue field-value pair to match documents
   * @param updates pair of script text and parameters
   */
  void updateChildren(
      String indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates);

  /**
   * Updates child entities matching field and value with a script across multiple indices.
   *
   * @param indexNames list of index names
   * @param fieldAndValue field-value pair to match documents
   * @param updates pair of script text and parameters
   */
  void updateChildren(
      List<String> indexNames,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates)
      throws IOException;

  /**
   * Gets a document by ID from the specified index.
   *
   * @param indexName the name of the index
   * @param entityId the document ID to retrieve
   * @return Response containing the document if found
   * @throws IOException if there's an error during retrieval
   */
  Response getDocByID(String indexName, String entityId) throws IOException;

  /**
   * Updates entity relationship data in documents matching field and value.
   *
   * @param indexName the name of the index
   * @param fieldAndValue field-value pair to match documents
   * @param entityRelationshipData the relationship data to update
   */
  void updateEntityRelationship(
      String indexName,
      Pair<String, String> fieldAndValue,
      Map<String, Object> entityRelationshipData);

  /**
   * Reindexes specific entities from source indices to destination index with optional pipeline.
   *
   * @param sourceIndices list of source index names
   * @param destinationIndex destination index name
   * @param pipelineName pipeline name to apply during reindexing
   * @param entityType the type of entities being reindex
   * @param entityIds list of entity UUIDs to reindex
   */
  void reindexWithEntityIds(
      List<String> sourceIndices,
      String destinationIndex,
      String pipelineName,
      String entityType,
      List<UUID> entityIds);
}
