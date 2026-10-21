package org.openmetadata.sdk.services.ontology;

import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyReleaseDiff;
import org.openmetadata.schema.api.data.OntologyReleaseStructureReport;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/** Read-only access to sealed ontology content; publication uses the governed release lifecycle. */
public final class OntologyReleaseService {
  private static final String BASE_PATH = "/v1/ontologyReleases/";
  private final HttpClient httpClient;

  public OntologyReleaseService(final HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public OntologyRelease get(final UUID id) {
    return httpClient.execute(HttpMethod.GET, BASE_PATH + id, null, OntologyRelease.class);
  }

  public OntologyRelease getVersion(final UUID id, final Double version) {
    return httpClient.execute(
        HttpMethod.GET, BASE_PATH + id + "/versions/" + version, null, OntologyRelease.class);
  }

  public OntologyReleaseStructureReport structure(final UUID id) {
    return httpClient.execute(
        HttpMethod.GET, BASE_PATH + id + "/structure", null, OntologyReleaseStructureReport.class);
  }

  public OntologyReleaseDiff diff(
      final UUID id, final UUID baseReleaseId, final int limit, final String after) {
    final var options = RequestOptions.builder().queryParam("limit", Integer.toString(limit));
    if (baseReleaseId != null) {
      options.queryParam("baseReleaseId", baseReleaseId.toString());
    }
    if (after != null) {
      options.queryParam("after", after);
    }
    return httpClient.execute(
        HttpMethod.GET, BASE_PATH + id + "/diff", null, OntologyReleaseDiff.class, options.build());
  }
}
