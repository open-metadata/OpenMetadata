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
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.OntologyPatternInstantiationResult;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.ontology.OntologyPatternDraftFactory.Draft;

public final class OntologyPatternInstantiationService {
  private final OntologyPatternDraftFactory draftFactory;
  private final ChangeSetStore changeSetStore;

  public static OntologyPatternInstantiationService createDefault(
      final OntologyChangeSetRepository repository,
      final RelationshipTypeResolver relationshipTypes,
      final Clock clock) {
    final OntologyPatternCatalog catalog = new OntologyPatternCatalog();
    final OntologyPatternDraftFactory factory =
        new OntologyPatternDraftFactory(
            catalog,
            new OntologyPatternRequestValidator(),
            new OntologyIriMinter(),
            relationshipTypes::require,
            clock);
    return new OntologyPatternInstantiationService(factory, repository);
  }

  OntologyPatternInstantiationService(
      final OntologyPatternDraftFactory draftFactory,
      final OntologyChangeSetRepository repository) {
    this(
        draftFactory,
        (uriInfo, changeSet, user) -> repository.create(uriInfo, changeSet, user, null));
  }

  OntologyPatternInstantiationService(
      final OntologyPatternDraftFactory draftFactory, final ChangeSetStore changeSetStore) {
    this.draftFactory = draftFactory;
    this.changeSetStore = changeSetStore;
  }

  public OntologyPatternInstantiationResult instantiate(
      final UriInfo uriInfo,
      final Glossary glossary,
      final InstantiateOntologyPattern request,
      final String user) {
    final Draft draft = draftFactory.create(glossary, request, user);
    final OntologyChangeSet persisted =
        changeSetStore.create(uriInfo, changeSet(glossary, request, draft), user);
    return new OntologyPatternInstantiationResult()
        .withPatternType(request.getPatternType())
        .withChangeSet(persisted.getEntityReference())
        .withTerms(draft.terms())
        .withRelationships(draft.relationships());
  }

  private static OntologyChangeSet changeSet(
      final Glossary glossary, final InstantiateOntologyPattern request, final Draft draft) {
    return new OntologyChangeSet()
        .withId(UUID.randomUUID())
        .withName(request.getChangeSetName())
        .withDisplayName(changeSetDisplayName(request))
        .withDescription(request.getChangeSetDescription())
        .withGlossaries(List.of(glossary.getEntityReference()))
        .withState(OntologyChangeSetState.DRAFT)
        .withOperations(draft.operations())
        .withUndoCursor(draft.operations().size())
        .withProvider(ProviderType.USER);
  }

  private static String changeSetDisplayName(final InstantiateOntologyPattern request) {
    final String displayName =
        nullOrEmpty(request.getChangeSetDisplayName())
                || request.getChangeSetDisplayName().isBlank()
            ? request.getChangeSetName()
            : request.getChangeSetDisplayName();
    return displayName;
  }

  @FunctionalInterface
  interface ChangeSetStore {
    OntologyChangeSet create(UriInfo uriInfo, OntologyChangeSet changeSet, String user);
  }
}
