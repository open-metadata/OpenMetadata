package org.openmetadata.service.apps.bundles.insights.search.opensearch;

import java.io.IOException;
import org.apache.http.util.EntityUtils;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.IndexLifecyclePolicyConfig;
import org.openmetadata.service.search.models.IndexMapping;
import os.org.opensearch.client.Request;
import os.org.opensearch.client.Response;
import os.org.opensearch.client.ResponseException;
import os.org.opensearch.client.RestClient;

public class OpenSearchDataInsightsClient implements DataInsightsSearchInterface {
  private final RestClient client;
  private final String resourcePath = "/dataInsights/opensearch";
  private final String lifecyclePolicyName = "di-data-assets-lifecycle";

  public OpenSearchDataInsightsClient(RestClient client) {
    this.client = client;
  }

  private Response performRequest(String method, String path) throws IOException {
    Request request = new Request(method, path);
    return client.performRequest(request);
  }

  private Response performRequest(String method, String path, String payload) throws IOException {
    Request request = new Request(method, path);
    request.setJsonEntity(payload);

    return client.performRequest(request);
  }

  @Override
  public void createLifecyclePolicy(String name, String policy) throws IOException {
    try {
      performRequest("PUT", String.format("/_plugins/_ism/policies/%s", name), policy);
    } catch (ResponseException ex) {
      // Conflict since the Policy already exists
      if (ex.getResponse().getStatusLine().getStatusCode() == 409) {
        performRequest("DELETE", String.format("/_plugins/_ism/policies/%s", name));
        performRequest("PUT", String.format("/_plugins/_ism/policies/%s", name), policy);
      } else {
        throw ex;
      }
    }
  }

  @Override
  public void createComponentTemplate(String name, String template) throws IOException {
    performRequest("PUT", String.format("/_component_template/%s", name), template);
  }

  @Override
  public void createIndexTemplate(String name, String template) throws IOException {
    performRequest("PUT", String.format("/_index_template/%s", name), template);
  }

  @Override
  public void createDataStream(String name) throws IOException {
    performRequest("PUT", String.format("/_data_stream/%s", name));
  }

  @Override
  public Boolean dataAssetDataStreamExists(String name) throws IOException {
    Response response = performRequest("HEAD", String.format("/%s", name));
    return response.getStatusLine().getStatusCode() == 200;
  }

  @Override
  public void createDataAssetsDataStream(
      String name,
      String entityType,
      IndexMapping entityIndexMapping,
      String language,
      int retentionDays)
      throws IOException {
    createLifecyclePolicy(
        lifecyclePolicyName,
        buildLifecyclePolicy(
            readResource(String.format("%s/indexLifecyclePolicy.json", resourcePath)),
            retentionDays));
    createComponentTemplate(
        "di-data-assets-mapping",
        buildMapping(
            entityType,
            entityIndexMapping,
            language,
            readResource(String.format("%s/indexMappingsTemplate.json", resourcePath))));
    createIndexTemplate(
        "di-data-assets", readResource(String.format("%s/indexTemplate.json", resourcePath)));
    createDataStream(name);
  }

  private String buildLifecyclePolicy(String lifecyclePolicy, int retentionDays) {
    return lifecyclePolicy
        .replace("{{retention}}", String.valueOf(retentionDays))
        .replace("{{halfRetention}}", String.valueOf(retentionDays / 2));
  }

  @Override
  public void updateLifecyclePolicy(int retentionDays) throws IOException {
    String currentLifecyclePolicy =
        EntityUtils.toString(
            performRequest("GET", String.format("/_plugins/_ism/policies/%s", lifecyclePolicyName))
                .getEntity());
    if (new IndexLifecyclePolicyConfig(
                lifecyclePolicyName,
                currentLifecyclePolicy,
                IndexLifecyclePolicyConfig.SearchType.OPENSEARCH)
            .getRetentionDays()
        != retentionDays) {
      String updatedLifecyclePolicy =
          buildLifecyclePolicy(
              readResource(String.format("%s/indexLifecyclePolicy.json", resourcePath)),
              retentionDays);
      createLifecyclePolicy(lifecyclePolicyName, updatedLifecyclePolicy);
    }
  }

  @Override
  public void deleteDataAssetDataStream(String name) throws IOException {
    performRequest("DELETE", String.format("_data_stream/%s", name));
  }
}
