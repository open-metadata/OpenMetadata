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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.ProviderType;

final class OntologyBulkDraftFactory {
  private final ChangeSetStore changeSetStore;

  OntologyBulkDraftFactory(final ChangeSetStore changeSetStore) {
    this.changeSetStore = changeSetStore;
  }

  OntologyChangeSet create(
      final UriInfo uriInfo,
      final Glossary glossary,
      final OntologyBulkRequest request,
      final List<OntologyChangeOperation> operations,
      final String user) {
    final OntologyChangeSet draft = draft(glossary, request, operations);
    return changeSetStore.create(uriInfo, draft, user, null);
  }

  private static OntologyChangeSet draft(
      final Glossary glossary,
      final OntologyBulkRequest request,
      final List<OntologyChangeOperation> operations) {
    return new OntologyChangeSet()
        .withId(UUID.randomUUID())
        .withName(request.getChangeSetName())
        .withDisplayName(displayName(request))
        .withDescription(request.getChangeSetDescription())
        .withGlossaries(List.of(glossary.getEntityReference()))
        .withState(OntologyChangeSetState.DRAFT)
        .withOperations(List.copyOf(operations))
        .withUndoCursor(operations.size())
        .withProvider(ProviderType.USER);
  }

  private static String displayName(final OntologyBulkRequest request) {
    final String displayName =
        nullOrEmpty(request.getChangeSetDisplayName())
                || request.getChangeSetDisplayName().isBlank()
            ? request.getChangeSetName()
            : request.getChangeSetDisplayName();
    return displayName;
  }

  @FunctionalInterface
  interface ChangeSetStore {
    OntologyChangeSet create(
        UriInfo uriInfo, OntologyChangeSet changeSet, String user, String impersonatedBy);
  }
}
