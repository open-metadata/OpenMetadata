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

import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.LLMClientHolder;

/**
 * Feature gates for Ontology AI. Memory derivation is consulted by the API, the memory lifecycle
 * queue, and the job worker, so turning Ontology AI off stops model calls on every path rather than
 * only on the one a user clicks.
 */
public final class OntologyAiAvailability {
  private static final boolean MEMORY_DERIVATION_JOB_TYPE_SUPPORTED =
      supportsMemoryDerivationJobType();

  private OntologyAiAvailability() {}

  public static boolean isEnabled(final RdfConfiguration rdfConfiguration) {
    return rdfConfiguration != null
        && (Boolean.TRUE.equals(rdfConfiguration.getAiEnabled())
            || Boolean.TRUE.equals(rdfConfiguration.getAskCollateEnabled()))
        && LLMClientHolder.isEnabled();
  }

  public static boolean isMemoryDerivationEnabled() {
    return OpenMetadataApplicationConfigHolder.isInitialized()
        && isMemoryDerivationEnabled(
            OpenMetadataApplicationConfigHolder.getInstance().getRdfConfiguration());
  }

  static boolean isMemoryDerivationEnabled(final RdfConfiguration rdfConfiguration) {
    return isEnabled(rdfConfiguration)
        && LLMClientHolder.isOntologyMemoryDerivationEnabled()
        && MEMORY_DERIVATION_JOB_TYPE_SUPPORTED;
  }

  private static boolean supportsMemoryDerivationJobType() {
    // Collate may load its own generated enum until its schema is synchronized.
    for (final BackgroundJob.JobType jobType : BackgroundJob.JobType.values()) {
      if (JobDAO.ONTOLOGY_MEMORY_DERIVATION_JOB_TYPE.equals(jobType.name())) {
        return true;
      }
    }
    return false;
  }
}
