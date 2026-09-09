/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.sdk.services.ontology;

import org.openmetadata.schema.api.data.OntologyBulkJob;
import org.openmetadata.schema.api.data.OntologyBulkJobList;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.api.data.OntologyBulkSubmission;
import org.openmetadata.schema.api.data.OntologyBulkTemplate;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/** Typed SDK client for QTT-style ontology bulk authoring and background jobs. */
public final class OntologyBulkService {
  private static final String BASE_PATH = "/v1/ontology/bulk";
  private static final String JOBS_PATH = BASE_PATH + "/jobs";
  private final HttpClient httpClient;

  public OntologyBulkService(final HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public OntologyBulkTemplate template() throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET, BASE_PATH + "/template", null, OntologyBulkTemplate.class);
  }

  public OntologyBulkSubmission submit(final OntologyBulkRequest request)
      throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, BASE_PATH, request, OntologyBulkSubmission.class);
  }

  public OntologyBulkJobList listJobs(final int limit) throws OpenMetadataException {
    final RequestOptions options =
        RequestOptions.builder().queryParam("limit", Integer.toString(limit)).build();
    return httpClient.execute(HttpMethod.GET, JOBS_PATH, null, OntologyBulkJobList.class, options);
  }

  public OntologyBulkJob getJob(final long id) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.GET, jobPath(id), null, OntologyBulkJob.class);
  }

  public OntologyBulkJob cancelJob(final long id) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, jobPath(id) + "/cancel", null, OntologyBulkJob.class);
  }

  public OntologyBulkResultArtifact artifact(final long id) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET, jobPath(id) + "/artifact", null, OntologyBulkResultArtifact.class);
  }

  private static String jobPath(final long id) {
    return JOBS_PATH + "/" + id;
  }
}
