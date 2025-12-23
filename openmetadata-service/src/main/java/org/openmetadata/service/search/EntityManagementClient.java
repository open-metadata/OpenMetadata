package org.openmetadata.service.search;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.EntityReference;

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

  /**
   * Updates entities by FQN prefix by replacing old parent FQN with new parent FQN.
   *
   * @param indexName the name of the index
   * @param oldParentFQN the old parent FQN to be replaced
   * @param newParentFQN the new parent FQN to replace with
   * @param prefixFieldCondition the field name to match for prefix query
   */
  void updateByFqnPrefix(
      String indexName, String oldParentFQN, String newParentFQN, String prefixFieldCondition);

  /**
   * Updates lineage information for entities.
   *
   * @param indexName the name of the index
   * @param fieldAndValue field and value pair to match entities
   * @param lineageData the lineage data to update
   */
  void updateLineage(
      String indexName, Pair<String, String> fieldAndValue, EsLineageData lineageData);

  /**
   * Deletes entities matching a range query on a specific field.
   *
   * @param index the index name
   * @param fieldName the field name to apply the range query on
   * @param gt greater than value (exclusive), can be null
   * @param gte greater than or equal to value (inclusive), can be null
   * @param lt less than value (exclusive), can be null
   * @param lte less than or equal to value (inclusive), can be null
   * @throws IOException if there's an error during the delete operation
   */
  void deleteByRangeQuery(
      String index, String fieldName, Object gt, Object gte, Object lt, Object lte)
      throws IOException;

  /**
   * Deletes entities matching both a range query and a term query.
   * This combines a range condition on a timestamp field with an exact match on a term field.
   *
   * @param index the index name
   * @param rangeFieldName the field name to apply the range query on
   * @param gt greater than value (exclusive), can be null
   * @param gte greater than or equal to value (inclusive), can be null
   * @param lt less than value (exclusive), can be null
   * @param lte less than or equal to value (inclusive), can be null
   * @param termKey the field name for the term query
   * @param termValue the value for the term query
   * @throws IOException if there's an error during the delete operation
   */
  void deleteByRangeAndTerm(
      String index,
      String rangeFieldName,
      Object gt,
      Object gte,
      Object lt,
      Object lte,
      String termKey,
      String termValue)
      throws IOException;

  /**
   * Updates column FQNs in upstream lineage data across all documents in the index.
   * This method updates both toColumn and fromColumns fields in the lineage column mappings.
   *
   * @param indexName the name of the index
   * @param originalUpdatedColumnFqnMap map of original column FQN to updated column FQN
   */
  void updateColumnsInUpstreamLineage(
      String indexName, HashMap<String, String> originalUpdatedColumnFqnMap);

  /**
   * Deletes columns from upstream lineage data across all documents in the index.
   * This method removes column FQNs from both toColumn and fromColumns fields in the lineage
   * column mappings.
   *
   * @param indexName the name of the index
   * @param deletedColumns list of column FQNs to be deleted
   */
  void deleteColumnsInUpstreamLineage(String indexName, List<String> deletedColumns);

  /**
   * Updates glossary term tags by FQN prefix in the specified index.
   * This method finds all documents matching the prefix condition and updates glossary term tags
   * that start with the old FQN prefix to use the new FQN prefix.
   *
   * @param indexName the name of the index
   * @param oldFqnPrefix the old fully qualified name prefix to be replaced
   * @param newFqnPrefix the new fully qualified name prefix to replace with
   * @param prefixFieldCondition the field to match on (e.g., "fullyQualifiedName")
   */
  void updateGlossaryTermByFqnPrefix(
      String indexName, String oldFqnPrefix, String newFqnPrefix, String prefixFieldCondition);

  /**
   * Updates data product references in search indexes when a data product is renamed.
   * This method finds all assets that have the data product in their dataProducts array
   * and updates the fullyQualifiedName to the new value.
   *
   * @param oldFqn the old fully qualified name of the data product
   * @param newFqn the new fully qualified name of the data product
   */
  void updateDataProductReferences(String oldFqn, String newFqn);

  /**
   * Reindexes multiple entities across indices.
   * This method takes a list of entity references, fetches the full entity data,
   * rebuilds the search index documents, and performs a bulk update.
   *
   * @param entities list of entity references to reindex
   */
  void reindexEntities(List<EntityReference> entities) throws IOException;

  /**
   * Gets schema entity relationship information for a database schema.
   * This method searches for tables within a schema and retrieves their relationships.
   *
   * @param schemaFqn the fully qualified name of the schema
   * @param queryFilter optional query filter to apply
   * @param includeSourceFields comma-separated list of source fields to include
   * @param offset pagination offset for table results
   * @param limit pagination limit for table results
   * @param from pagination offset for relationships
   * @param size pagination limit for relationships
   * @param deleted whether to include deleted entities
   * @return SearchSchemaEntityRelationshipResult containing tables and their relationships
   * @throws IOException if there's an error during the search operation
   */
  SearchSchemaEntityRelationshipResult getSchemaEntityRelationship(
      String schemaFqn,
      String queryFilter,
      String includeSourceFields,
      int offset,
      int limit,
      int from,
      int size,
      boolean deleted)
      throws IOException;
}
