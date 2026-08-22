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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.data.OntologyBulkJob;
import org.openmetadata.schema.api.data.OntologyBulkJobList;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.api.data.OntologyBulkSubmission;
import org.openmetadata.schema.api.data.OntologyBulkTemplate;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

class OntologyBulkServiceTest {
  @Test
  void routesEveryTypedBulkAndBackgroundJobEndpoint() {
    final HttpClient httpClient = mock(HttpClient.class);
    final OntologyBulkService service = new OntologyBulkService(httpClient);
    final OntologyBulkRequest request = new OntologyBulkRequest();
    final OntologyBulkTemplate template = new OntologyBulkTemplate();
    final OntologyBulkSubmission submission = new OntologyBulkSubmission();
    final OntologyBulkJob job = new OntologyBulkJob();
    final OntologyBulkResultArtifact artifact = new OntologyBulkResultArtifact();
    when(httpClient.execute(
            HttpMethod.GET, "/v1/ontology/bulk/template", null, OntologyBulkTemplate.class))
        .thenReturn(template);
    when(httpClient.execute(
            HttpMethod.POST, "/v1/ontology/bulk", request, OntologyBulkSubmission.class))
        .thenReturn(submission);
    when(httpClient.execute(
            HttpMethod.GET, "/v1/ontology/bulk/jobs/42", null, OntologyBulkJob.class))
        .thenReturn(job);
    when(httpClient.execute(
            HttpMethod.PUT, "/v1/ontology/bulk/jobs/42/cancel", null, OntologyBulkJob.class))
        .thenReturn(job);
    when(httpClient.execute(
            HttpMethod.GET,
            "/v1/ontology/bulk/jobs/42/artifact",
            null,
            OntologyBulkResultArtifact.class))
        .thenReturn(artifact);

    assertSame(template, service.template());
    assertSame(submission, service.submit(request));
    assertSame(job, service.getJob(42));
    assertSame(job, service.cancelJob(42));
    assertSame(artifact, service.artifact(42));
  }

  @Test
  void carriesTheBoundedListLimitAsAQueryParameter() {
    final HttpClient httpClient = mock(HttpClient.class);
    final OntologyBulkService service = new OntologyBulkService(httpClient);
    final OntologyBulkJobList jobs = new OntologyBulkJobList();
    final ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
    when(httpClient.execute(
            eq(HttpMethod.GET),
            eq("/v1/ontology/bulk/jobs"),
            isNull(),
            eq(OntologyBulkJobList.class),
            org.mockito.ArgumentMatchers.any(RequestOptions.class)))
        .thenReturn(jobs);

    assertSame(jobs, service.listJobs(35));

    verify(httpClient)
        .execute(
            eq(HttpMethod.GET),
            eq("/v1/ontology/bulk/jobs"),
            isNull(),
            eq(OntologyBulkJobList.class),
            options.capture());
    assertEquals("35", options.getValue().getQueryParams().get("limit"));
  }
}
