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

package org.openmetadata.it.util;

import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.ApplyOntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyEditLeaseToken;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.sdk.client.OpenMetadataClient;

public final class OntologyChangeSetTestSupport {
  private static final String CHANGE_SET_RESOURCE = "ontologyChangeSet";
  private static final int LEASE_SECONDS = 60;

  private OntologyChangeSetTestSupport() {}

  public static OntologyChangeSet applyOntologyChangeSet(
      final OpenMetadataClient client,
      final OntologyChangeSet changeSet,
      final TestNamespace namespace,
      final String sessionName) {
    final OntologyEditLock lock = acquire(client, changeSet, namespace, sessionName);
    final OntologyEditLeaseToken lease =
        new OntologyEditLeaseToken()
            .withSessionId(lock.getSessionId())
            .withVersion(lock.getVersion());
    return client
        .ontologyChangeSets()
        .apply(changeSet.getId(), new ApplyOntologyChangeSet().withLease(lease));
  }

  public static OntologyChangeSet applyOntologyChangeSet(
      final OpenMetadataClient client,
      final EntityReference changeSetReference,
      final TestNamespace namespace,
      final String sessionName) {
    final OntologyChangeSet changeSet =
        client
            .ontologyChangeSets()
            .get(changeSetReference.getId().toString(), "glossaries,operations");
    return applyOntologyChangeSet(client, changeSet, namespace, sessionName);
  }

  private static OntologyEditLock acquire(
      final OpenMetadataClient client,
      final OntologyChangeSet changeSet,
      final TestNamespace namespace,
      final String sessionName) {
    final AcquireOntologyEditLock request =
        new AcquireOntologyEditLock()
            .withResourceType(CHANGE_SET_RESOURCE)
            .withResourceId(changeSet.getId())
            .withSessionId(boundedSessionId(namespace.prefix(sessionName)))
            .withLeaseSeconds(LEASE_SECONDS);
    return client.ontologyEditLocks().acquire(request);
  }

  /** The edit-lock schema caps sessionId at 64 chars; keep the unique namespace tail. */
  public static String boundedSessionId(final String sessionId) {
    return sessionId.length() <= 64 ? sessionId : sessionId.substring(sessionId.length() - 64);
  }
}
