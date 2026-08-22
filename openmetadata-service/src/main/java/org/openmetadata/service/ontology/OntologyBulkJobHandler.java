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

package org.openmetadata.service.ontology;

import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyBulkJobArguments;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.JobHandler;
import org.openmetadata.service.ontology.OntologyBulkServiceFactory.Components;

public final class OntologyBulkJobHandler implements JobHandler {
  private final OntologyBulkExecutionService service;
  private final OntologyBulkJobManager jobManager;
  private final GlossaryLoader glossaryLoader;

  public static OntologyBulkJobHandler createDefault() {
    final Components components = OntologyBulkServiceFactory.createDefault();
    return new OntologyBulkJobHandler(
        components.service(), components.jobManager(), repositoryLoader());
  }

  public int recoverStaleJobs() {
    return jobManager.markStaleJobsFailed();
  }

  OntologyBulkJobHandler(
      final OntologyBulkExecutionService service,
      final OntologyBulkJobManager jobManager,
      final GlossaryLoader glossaryLoader) {
    this.service = service;
    this.jobManager = jobManager;
    this.glossaryLoader = glossaryLoader;
  }

  @Override
  public void runJob(final BackgroundJob job) throws BackgroundJobException {
    try {
      final OntologyBulkJobArguments arguments = jobManager.arguments(job);
      jobManager.markRunning(job.getId());
      jobManager.checkpoint(job.getId());
      execute(job, arguments);
    } catch (OntologyBulkJobCancelledException exception) {
      jobManager.cancel(job.getId());
    } catch (RuntimeException exception) {
      final String message = failureMessage(exception);
      jobManager.fail(job.getId(), message);
      throw new BackgroundJobException(job.getId(), message, exception);
    }
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return false;
  }

  private void execute(final BackgroundJob job, final OntologyBulkJobArguments arguments) {
    final Glossary glossary = glossaryLoader.load(arguments.getRequest().getGlossaryId());
    final OntologyBulkResultArtifact artifact =
        service.execute(null, glossary, arguments.getRequest(), job.getCreatedBy());
    jobManager.complete(job.getId(), artifact, artifact.getTotalRows());
  }

  private static String failureMessage(final RuntimeException exception) {
    final String message = exception.getMessage();
    return message == null || message.isBlank() ? "Ontology bulk operation failed" : message;
  }

  private static GlossaryLoader repositoryLoader() {
    final GlossaryRepository repository =
        (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
    return id -> repository.get(null, id, repository.getFields(""));
  }

  @FunctionalInterface
  interface GlossaryLoader {
    Glossary load(UUID id);
  }
}
