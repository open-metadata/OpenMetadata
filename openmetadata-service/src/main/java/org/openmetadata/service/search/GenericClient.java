package org.openmetadata.service.search;

import java.io.IOException;
import java.util.List;

/**
 * Interface for generic search client operations.
 * This interface provides methods for managing data streams and other generic operations.
 */
public interface GenericClient {

  /**
   * Get list of data streams matching a prefix.
   *
   * @param prefix the prefix to match data streams
   * @return list of data stream names matching the prefix
   * @throws IOException if the operation fails
   */
  List<String> getDataStreams(String prefix) throws IOException;

  /**
   * Delete a data stream by name.
   *
   * @param dataStreamName the name of the data stream to delete
   * @throws IOException if the operation fails
   */
  void deleteDataStream(String dataStreamName) throws IOException;

  /**
   * Delete an ILM (Index Lifecycle Management) policy.
   *
   * @param policyName the name of the policy to delete
   * @throws IOException if the operation fails
   */
  void deleteILMPolicy(String policyName) throws IOException;

  /**
   * Delete an index template.
   *
   * @param templateName the name of the template to delete
   * @throws IOException if the operation fails
   */
  void deleteIndexTemplate(String templateName) throws IOException;

  /**
   * Delete a component template.
   *
   * @param componentTemplateName the name of the component template to delete
   * @throws IOException if the operation fails
   */
  void deleteComponentTemplate(String componentTemplateName) throws IOException;

  /**
   * Detach ILM policy from indices matching a pattern.
   *
   * @param indexPattern the pattern to match indices
   * @throws IOException if the operation fails
   */
  void dettachIlmPolicyFromIndexes(String indexPattern) throws IOException;
}
