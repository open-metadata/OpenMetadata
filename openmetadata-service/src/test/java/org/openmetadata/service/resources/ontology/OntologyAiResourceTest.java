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

package org.openmetadata.service.resources.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Clock;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.ontology.OntologyAiCatalog;
import org.openmetadata.service.ontology.OntologyAiCompletionGateway;
import org.openmetadata.service.ontology.OntologyAiService;
import org.openmetadata.service.rdf.OntologySparqlQueryValidator;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;

class OntologyAiResourceTest {
  @Test
  void disabledRoutesReturnNotFoundBeforeAuthorizationOrProviderInvocation() {
    final Authorizer authorizer = mock(Authorizer.class);
    final GlossaryRepository repository = mock(GlossaryRepository.class);
    final CountingGateway gateway = new CountingGateway();
    final OntologyAiService service =
        new OntologyAiService(
            false,
            gateway,
            new FailingCatalog(),
            new OntologySparqlQueryValidator(new SparqlFederationGuard(null)),
            Clock.systemUTC());
    final OntologyAiResource resource = new OntologyAiResource(authorizer, service, repository);
    final SecurityContext securityContext = mock(SecurityContext.class);

    assertThrows(
        NotFoundException.class, () -> resource.suggestRelationships(securityContext, null));
    assertThrows(NotFoundException.class, () -> resource.suggestMappings(securityContext, null));
    assertThrows(NotFoundException.class, () -> resource.generateSparql(securityContext, null));
    assertThrows(
        NotFoundException.class, () -> resource.generateDomainDraft(securityContext, null));
    assertEquals(0, gateway.invocationCount);
    verifyNoInteractions(authorizer, repository);
  }

  @Test
  void domainDraftIsDeniedToCallersWithoutEditAllOnTheGlossary() {
    final DraftGateway gateway = new DraftGateway();
    final OntologyAiResource resource = enabledResource(gateway, MetadataOperation.EDIT_ALL, false);

    assertThrows(
        AuthorizationException.class,
        () -> resource.generateDomainDraft(mock(SecurityContext.class), draftRequest()));
    assertEquals(0, gateway.invocationCount);
  }

  @Test
  void domainDraftReachesTheProviderForCallersWithEditAllOnTheGlossary() {
    final DraftGateway gateway = new DraftGateway();
    final OntologyAiResource resource = enabledResource(gateway, MetadataOperation.EDIT_ALL, true);

    assertThrows(
        IllegalStateException.class,
        () -> resource.generateDomainDraft(mock(SecurityContext.class), draftRequest()));
    assertEquals(1, gateway.invocationCount);
  }

  private static OntologyDomainDraftRequest draftRequest() {
    return new OntologyDomainDraftRequest().withGlossary("Finance").withMaxConcepts(3);
  }

  private static OntologyAiResource enabledResource(
      final OntologyAiCompletionGateway gateway,
      final MetadataOperation decided,
      final boolean grantOnlyThat) {
    final Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            invocation -> {
              final OperationContext operation = invocation.getArgument(1);
              final boolean asksForDecided =
                  operation.getOperations(invocation.getArgument(2)).contains(decided);
              if (asksForDecided != grantOnlyThat) {
                throw new AuthorizationException("denied");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    final GlossaryRepository repository = mock(GlossaryRepository.class);
    when(repository.getByName(any(), eq("Finance"), any())).thenReturn(new Glossary());
    final OntologyAiService service =
        new OntologyAiService(
            true,
            gateway,
            new GlossaryOnlyCatalog(),
            new OntologySparqlQueryValidator(new SparqlFederationGuard(null)),
            Clock.systemUTC());
    return new OntologyAiResource(authorizer, service, repository);
  }

  private static final class GlossaryOnlyCatalog implements OntologyAiCatalog {
    @Override
    public Glossary glossary(final String fullyQualifiedName) {
      return new Glossary().withFullyQualifiedName(fullyQualifiedName);
    }

    @Override
    public GlossaryTerm term(final UUID id) {
      throw new AssertionError("unused");
    }

    @Override
    public RelationshipType relationshipType(final UUID id) {
      throw new AssertionError("unused");
    }
  }

  private static final class DraftGateway implements OntologyAiCompletionGateway {
    private int invocationCount;

    @Override
    public Completion<RelationshipCandidate> suggestRelationships(final RelationshipPrompt prompt) {
      throw new AssertionError("unused");
    }

    @Override
    public Completion<MappingCandidate> suggestMappings(final MappingPrompt prompt) {
      throw new AssertionError("unused");
    }

    @Override
    public Completion<SparqlCandidate> generateSparql(final NaturalLanguagePrompt prompt) {
      throw new AssertionError("unused");
    }

    @Override
    public Completion<DomainConceptCandidate> generateDomainDraft(final DomainPrompt prompt) {
      invocationCount++;
      throw new IllegalStateException("provider reached");
    }
  }

  private static final class FailingCatalog implements OntologyAiCatalog {
    @Override
    public Glossary glossary(final String fullyQualifiedName) {
      throw new AssertionError("Disabled routes must not access the ontology catalog");
    }

    @Override
    public GlossaryTerm term(final UUID id) {
      throw new AssertionError("Disabled routes must not access the ontology catalog");
    }

    @Override
    public RelationshipType relationshipType(final UUID id) {
      throw new AssertionError("Disabled routes must not access the ontology catalog");
    }
  }

  private static final class CountingGateway implements OntologyAiCompletionGateway {
    private int invocationCount;

    @Override
    public Completion<RelationshipCandidate> suggestRelationships(final RelationshipPrompt prompt) {
      invocationCount++;
      throw new AssertionError("Disabled routes must not invoke the AI provider");
    }

    @Override
    public Completion<MappingCandidate> suggestMappings(final MappingPrompt prompt) {
      invocationCount++;
      throw new AssertionError("Disabled routes must not invoke the AI provider");
    }

    @Override
    public Completion<SparqlCandidate> generateSparql(final NaturalLanguagePrompt prompt) {
      invocationCount++;
      throw new AssertionError("Disabled routes must not invoke the AI provider");
    }

    @Override
    public Completion<DomainConceptCandidate> generateDomainDraft(final DomainPrompt prompt) {
      invocationCount++;
      throw new AssertionError("Disabled routes must not invoke the AI provider");
    }
  }
}
