package org.openmetadata.service.search;

import static org.openmetadata.service.exception.CatalogExceptionMessage.NOT_IMPLEMENTED_METHOD;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;
import org.openmetadata.service.exception.CustomExceptionMessage;

/**
 * Interface for generic search client operations.
 * This interface provides methods for managing data streams and other generic operations.
 */
public interface GenericClient {

  String NOT_IMPLEMENTED_ERROR_TYPE = "NOT_IMPLEMENTED";

  /**
   * Get list of data streams matching a prefix.
   *
   * @param prefix the prefix to match data streams
   * @return list of data stream names matching the prefix
   * @throws IOException if the operation fails
   */
  default List<String> getDataStreams(String prefix) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Delete a data stream by name.
   *
   * @param dataStreamName the name of the data stream to delete
   * @throws IOException if the operation fails
   */
  default void deleteDataStream(String dataStreamName) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Delete an ILM (Index Lifecycle Management) policy.
   *
   * @param policyName the name of the policy to delete
   * @throws IOException if the operation fails
   */
  default void deleteILMPolicy(String policyName) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Delete an index template.
   *
   * @param templateName the name of the template to delete
   * @throws IOException if the operation fails
   */
  default void deleteIndexTemplate(String templateName) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Delete a component template.
   *
   * @param componentTemplateName the name of the component template to delete
   * @throws IOException if the operation fails
   */
  default void deleteComponentTemplate(String componentTemplateName) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Detach ILM policy from indices matching a pattern.
   *
   * @param indexPattern the pattern to match indices
   * @throws IOException if the operation fails
   */
  default void dettachIlmPolicyFromIndexes(String indexPattern) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Remove ILM policy from a component template while preserving all other settings.
   * This is only implemented for Elasticsearch as OpenSearch handles ILM differently.
   *
   * @param componentTemplateName the name of the component template
   * @throws IOException if the operation fails
   */
  default void removeILMFromComponentTemplate(String componentTemplateName) throws IOException {
    // Default implementation does nothing as this is only needed for Elasticsearch
  }

  /**
   * Get the health status of the search cluster.
   *
   * @return SearchHealthStatus indicating whether the cluster is healthy or unhealthy
   * @throws IOException if the operation fails
   */
  SearchHealthStatus getSearchHealthStatus() throws IOException;
}
