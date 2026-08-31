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
import org.openmetadata.schema.api.data.BuildOntologySubset;
import org.openmetadata.schema.api.data.OntologySubsetResult;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.ontology.OntologySubsetDraftFactory.Draft;
import org.openmetadata.service.ontology.OntologySubsetTermSelector.SourceTerm;

public final class OntologySubsetService {
  private final OntologySubsetValidator validator;
  private final OntologySubsetTermSelector termSelector;
  private final OntologySubsetDraftFactory draftFactory;
  private final ChangeSetStore changeSetStore;

  public static OntologySubsetService createDefault(
      final GlossaryTermRepository termRepository,
      final OntologyChangeSetRepository changeSetRepository,
      final RelationshipTypeResolver relationshipTypes,
      final Clock clock) {
    final OntologySubsetTermSelector selector =
        new OntologySubsetTermSelector(new RepositoryOntologySubsetTermLookup(termRepository));
    final OntologySubsetDraftFactory factory =
        new OntologySubsetDraftFactory(new OntologyIriMinter(), relationshipTypes::require, clock);
    return new OntologySubsetService(
        new OntologySubsetValidator(), selector, factory, changeSetRepository::create);
  }

  OntologySubsetService(
      final OntologySubsetValidator validator,
      final OntologySubsetTermSelector termSelector,
      final OntologySubsetDraftFactory draftFactory,
      final ChangeSetStore changeSetStore) {
    this.validator = validator;
    this.termSelector = termSelector;
    this.draftFactory = draftFactory;
    this.changeSetStore = changeSetStore;
  }

  public OntologySubsetResult build(
      final UriInfo uriInfo,
      final Glossary source,
      final Glossary target,
      final BuildOntologySubset request,
      final String user) {
    validator.validate(source, target, request);
    final List<SourceTerm> sourceTerms = termSelector.select(source, request);
    final Draft draft =
        draftFactory.create(
            source,
            target,
            sourceTerms,
            Boolean.TRUE.equals(request.getIncludeRelationships()),
            user);
    final OntologyChangeSet changeSet =
        changeSetStore.create(uriInfo, changeSet(target, request, draft), user, null);
    return result(source, target, changeSet, draft);
  }

  private static OntologyChangeSet changeSet(
      final Glossary target, final BuildOntologySubset request, final Draft draft) {
    return new OntologyChangeSet()
        .withId(UUID.randomUUID())
        .withName(request.getChangeSetName())
        .withDisplayName(displayName(request))
        .withDescription(request.getChangeSetDescription())
        .withGlossaries(List.of(target.getEntityReference()))
        .withState(OntologyChangeSetState.DRAFT)
        .withOperations(draft.operations())
        .withUndoCursor(draft.operations().size())
        .withProvider(ProviderType.USER);
  }

  private static String displayName(final BuildOntologySubset request) {
    final String displayName =
        nullOrEmpty(request.getChangeSetDisplayName())
                || request.getChangeSetDisplayName().isBlank()
            ? request.getChangeSetName()
            : request.getChangeSetDisplayName();
    return displayName;
  }

  private static OntologySubsetResult result(
      final Glossary source,
      final Glossary target,
      final OntologyChangeSet changeSet,
      final Draft draft) {
    return new OntologySubsetResult()
        .withSourceGlossary(source.getEntityReference())
        .withTargetGlossary(target.getEntityReference())
        .withSourceGlossaryVersion(source.getVersion())
        .withChangeSet(changeSet.getEntityReference())
        .withTerms(draft.terms())
        .withRelationships(draft.relationships())
        .withSources(draft.sources());
  }

  @FunctionalInterface
  interface ChangeSetStore {
    OntologyChangeSet create(
        UriInfo uriInfo, OntologyChangeSet changeSet, String user, String impersonatedBy);
  }
}
