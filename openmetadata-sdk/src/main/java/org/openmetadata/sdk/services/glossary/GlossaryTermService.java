package org.openmetadata.sdk.services.glossary;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public class GlossaryTermService extends EntityServiceBase<GlossaryTerm> {
  public GlossaryTermService(HttpClient httpClient) {
    super(httpClient, "/v1/glossaryTerms");
  }

  @Override
  protected Class<GlossaryTerm> getEntityClass() {
    return GlossaryTerm.class;
  }

  public static class GlossaryTermList extends ResultList<GlossaryTerm> {
    // Used for deserialization
  }

  // Create glossaryterm using CreateGlossaryTerm request
  public GlossaryTerm create(CreateGlossaryTerm request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, GlossaryTerm.class);
  }

  // Search glossary terms with pagination and filters
  public ResultList<GlossaryTerm> search(
      String query, String glossaryFqn, String entityStatus, Integer limit, Integer offset)
      throws OpenMetadataException {
    Map<String, String> queryParams = new HashMap<>();

    if (query != null) {
      queryParams.put("q", query);
    }
    if (glossaryFqn != null) {
      queryParams.put("glossaryFqn", glossaryFqn);
    }
    if (entityStatus != null) {
      queryParams.put("entityStatus", entityStatus);
    }
    if (limit != null) {
      queryParams.put("limit", limit.toString());
    }
    if (offset != null) {
      queryParams.put("offset", offset.toString());
    }

    RequestOptions requestOptions = RequestOptions.builder().queryParams(queryParams).build();
    return httpClient.execute(
        HttpMethod.GET, basePath + "/search", null, GlossaryTermList.class, requestOptions);
  }
}
