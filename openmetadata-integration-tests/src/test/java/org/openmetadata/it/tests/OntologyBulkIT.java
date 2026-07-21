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

package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.OntologyChangeSetTestSupport.applyOntologyChangeSet;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.OntologyBulkExecutionMode;
import org.openmetadata.schema.api.data.OntologyBulkJob;
import org.openmetadata.schema.api.data.OntologyBulkJobList;
import org.openmetadata.schema.api.data.OntologyBulkJobStatus;
import org.openmetadata.schema.api.data.OntologyBulkOperation;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.api.data.OntologyBulkSubmission;
import org.openmetadata.schema.api.data.OntologyBulkTemplate;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyBulkIT {
  private static final int BACKGROUND_ROW_COUNT = 501;

  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void validatesAppliesAndQueuesTypedBulkAuthoring(final TestNamespace namespace) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Glossary glossary = createGlossary(client, namespace);
    assertTemplate(client.ontologyBulk().template());
    assertSynchronousDryRun(client, glossary, namespace);
    assertDraftApplication(client, glossary, namespace);
    assertBackgroundDryRun(client, glossary, namespace);
  }

  private static void assertTemplate(final OntologyBulkTemplate template) {
    assertEquals(OntologyBulkTemplate.MediaType.TEXT_CSV, template.getMediaType());
    assertEquals(500, template.getMaximumSynchronousRows());
    assertEquals(
        List.of("action", "termId", "name", "displayName", "description", "parentId", "iri"),
        template.getHeaders());
  }

  private static void assertSynchronousDryRun(
      final OpenMetadataClient client, final Glossary glossary, final TestNamespace namespace) {
    final UUID termId = stableId(namespace, "dry-run-term");
    final OntologyBulkSubmission submission =
        client
            .ontologyBulk()
            .submit(
                request(glossary, namespace, csv(termId, namespace.prefix("DryRunTerm")), true));

    assertEquals(OntologyBulkExecutionMode.SYNCHRONOUS, submission.getExecutionMode());
    assertEquals(1, submission.getResult().getValidRows());
    assertEquals(1, submission.getResult().getCreateCount());
    assertNull(submission.getResult().getChangeSet());
  }

  private static void assertDraftApplication(
      final OpenMetadataClient client, final Glossary glossary, final TestNamespace namespace) {
    final UUID termId = stableId(namespace, "applied-term");
    final String termName = namespace.prefix("BulkCreatedTerm");
    final OntologyBulkSubmission submission =
        client.ontologyBulk().submit(request(glossary, namespace, csv(termId, termName), false));
    final OntologyChangeSet draft =
        client
            .ontologyChangeSets()
            .get(submission.getResult().getChangeSet().getId().toString(), "operations");
    namespace.trackRoot(Entity.ONTOLOGY_CHANGE_SET, draft);
    final OntologyChangeSet applied =
        applyOntologyChangeSet(client, draft, namespace, "bulkEditor");
    final GlossaryTerm persisted = client.glossaryTerms().get(termId.toString(), "");

    assertEquals(OntologyBulkExecutionMode.SYNCHRONOUS, submission.getExecutionMode());
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(termName, persisted.getName());
    assertEquals(glossary.getId(), persisted.getGlossary().getId());
  }

  private static void assertBackgroundDryRun(
      final OpenMetadataClient client, final Glossary glossary, final TestNamespace namespace) {
    final OntologyBulkRequest request = request(glossary, namespace, largeCsv(namespace), true);
    final OntologyBulkSubmission submission = client.ontologyBulk().submit(request);
    final AtomicReference<OntologyBulkJob> completed = new AtomicReference<>();

    assertEquals(OntologyBulkExecutionMode.BACKGROUND, submission.getExecutionMode());
    await("ontology bulk background dry-run completion")
        .atMost(Duration.ofSeconds(90))
        .pollInterval(Duration.ofMillis(250))
        .untilAsserted(
            () -> {
              final OntologyBulkJob job = client.ontologyBulk().getJob(submission.getJob().getId());
              assertEquals(OntologyBulkJobStatus.COMPLETED, job.getStatus());
              completed.set(job);
            });
    final OntologyBulkResultArtifact artifact =
        client.ontologyBulk().artifact(completed.get().getId());

    assertEquals(BACKGROUND_ROW_COUNT, artifact.getTotalRows());
    assertEquals(BACKGROUND_ROW_COUNT, artifact.getCreateCount());
    assertEquals(0, artifact.getInvalidRows());
    assertNull(artifact.getChangeSet());
    assertTrue(
        client.ontologyBulk().listJobs(20).getJobs().stream()
            .anyMatch(job -> completed.get().getId().equals(job.getId())));
  }

  @Test
  void deniesCrossUserJobAccess(final TestNamespace namespace) {
    final OpenMetadataClient owner = SdkClients.adminClient();
    final OpenMetadataClient intruder = SdkClients.user1Client();
    final Glossary glossary = createGlossary(owner, namespace);
    final long jobId = createBackgroundJob(owner, glossary, namespace).getId();

    assertForbidden(() -> intruder.ontologyBulk().getJob(jobId));
    assertForbidden(() -> intruder.ontologyBulk().cancelJob(jobId));
    assertForbidden(() -> intruder.ontologyBulk().artifact(jobId));
  }

  @Test
  void cancelJobRequestsCancellation(final TestNamespace namespace) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Glossary glossary = createGlossary(client, namespace);
    final OntologyBulkJob submitted = createBackgroundJob(client, glossary, namespace);
    assertFalse(Boolean.TRUE.equals(submitted.getCancelRequested()));

    final OntologyBulkJob cancelled = client.ontologyBulk().cancelJob(submitted.getId());

    assertEquals(submitted.getId(), cancelled.getId());
    assertTrue(Boolean.TRUE.equals(cancelled.getCancelRequested()));
  }

  @Test
  void listJobsIsCallerScopedAndBounded(final TestNamespace namespace) {
    final OpenMetadataClient owner = SdkClients.adminClient();
    final OpenMetadataClient other = SdkClients.user1Client();
    final Glossary glossary = createGlossary(owner, namespace);
    final long ownedJobId = createBackgroundJob(owner, glossary, namespace).getId();

    assertTrue(containsJob(owner.ontologyBulk().listJobs(100), ownedJobId));
    assertFalse(containsJob(other.ontologyBulk().listJobs(100), ownedJobId));
    assertTrue(owner.ontologyBulk().listJobs(1000).getJobs().size() <= MAXIMUM_JOB_LIST_SIZE);
  }

  private static OntologyBulkJob createBackgroundJob(
      final OpenMetadataClient client, final Glossary glossary, final TestNamespace namespace) {
    final OntologyBulkRequest request = request(glossary, namespace, largeCsv(namespace), true);
    final OntologyBulkSubmission submission = client.ontologyBulk().submit(request);
    assertEquals(OntologyBulkExecutionMode.BACKGROUND, submission.getExecutionMode());
    return submission.getJob();
  }

  private static boolean containsJob(final OntologyBulkJobList jobs, final long jobId) {
    return jobs.getJobs().stream().anyMatch(job -> job.getId() == jobId);
  }

  private static void assertForbidden(final Executable action) {
    final ForbiddenException exception = assertThrows(ForbiddenException.class, action);
    assertEquals(403, exception.getStatusCode());
  }

  private static Glossary createGlossary(
      final OpenMetadataClient client, final TestNamespace namespace) {
    final String name = namespace.prefix("BulkOntology");
    final OntologyConfiguration configuration =
        new OntologyConfiguration()
            .withBaseIri(URI.create("https://example.org/bulk/" + name + '/'))
            .withLayer(OntologyLayer.L_2)
            .withImports(List.of())
            .withPrefixes(List.of())
            .withIriMintingPattern("concept/{term}/{uuid}")
            .withReadOnly(false)
            .withInstalledPacks(List.of());
    final Glossary glossary =
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(name)
                    .withDescription("Typed ontology bulk integration model")
                    .withOntologyConfiguration(configuration));
    return namespace.trackRoot(Entity.GLOSSARY, glossary);
  }

  private static OntologyBulkRequest request(
      final Glossary glossary,
      final TestNamespace namespace,
      final String csv,
      final boolean dryRun) {
    return new OntologyBulkRequest()
        .withGlossaryId(glossary.getId())
        .withOperation(OntologyBulkOperation.CSV_UPSERT)
        .withDryRun(dryRun)
        .withCsv(csv)
        .withChangeSetName(namespace.prefix("BulkDraft") + UUID.randomUUID())
        .withChangeSetDisplayName("Ontology bulk draft")
        .withChangeSetDescription("Review typed ontology bulk changes");
  }

  private static String largeCsv(final TestNamespace namespace) {
    final StringBuilder csv = new StringBuilder(header()).append('\n');
    for (int index = 0; index < BACKGROUND_ROW_COUNT; index++) {
      csv.append(row(stableId(namespace, "background-" + index), namespace.prefix("Term" + index)));
    }
    return csv.toString();
  }

  private static String csv(final UUID termId, final String termName) {
    return header() + '\n' + row(termId, termName);
  }

  private static String row(final UUID termId, final String termName) {
    return "CREATE," + termId + ',' + termName + ',' + termName + ",Bulk-created concept,,\n";
  }

  private static String header() {
    return "action,termId,name,displayName,description,parentId,iri";
  }

  private static UUID stableId(final TestNamespace namespace, final String suffix) {
    return UUID.nameUUIDFromBytes(namespace.prefix(suffix).getBytes(StandardCharsets.UTF_8));
  }
}
