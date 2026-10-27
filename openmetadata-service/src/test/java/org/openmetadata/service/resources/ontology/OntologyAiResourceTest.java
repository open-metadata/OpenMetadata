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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Clock;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.ontology.OntologyAiCatalog;
import org.openmetadata.service.ontology.OntologyAiCompletionGateway;
import org.openmetadata.service.ontology.OntologyAiService;
import org.openmetadata.service.rdf.OntologySparqlQueryValidator;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.security.Authorizer;

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
