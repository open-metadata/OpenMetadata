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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.DeleteOntologyResource;
import org.openmetadata.schema.api.data.OntologyDeleteResult;
import org.openmetadata.schema.api.data.OntologyImpactReport;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyImpactIT {
  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void requiresFreshImpactAndReassignsChildrenBeforeDelete(final TestNamespace namespace) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Glossary glossary = GlossaryTestFactory.createSimple(namespace);
    final GlossaryTerm parent = createTerm(client, glossary, namespace.prefix("parent"), null);
    final GlossaryTerm child =
        createTerm(client, glossary, namespace.prefix("child"), parent.getFullyQualifiedName());

    final OntologyImpactReport impact =
        client.ontologyImpacts().previewGlossaryTermDelete(parent.getId());
    final DeleteOntologyResource request =
        new DeleteOntologyResource()
            .withImpactToken(impact.getImpactToken())
            .withReassignChildrenTo(glossary.getEntityReference())
            .withCascadeConfirmed(false)
            .withHardDelete(false);
    final OntologyDeleteResult result =
        client.ontologyImpacts().deleteGlossaryTerm(parent.getId(), request);

    assertEquals(
        List.of(child.getId()), impact.getChildren().stream().map(EntityReference::getId).toList());
    assertEquals(1, result.getReassignedChildren());
    assertFalse(result.getCascaded());
    final GlossaryTerm reassigned =
        client.glossaryTerms().get(child.getId().toString(), "parent,glossary");
    assertNull(reassigned.getParent());
    assertEquals(glossary.getId(), reassigned.getGlossary().getId());
  }

  private static GlossaryTerm createTerm(
      final OpenMetadataClient client,
      final Glossary glossary,
      final String name,
      final String parent) {
    final CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("Ontology impact test term")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parent);
    return client.glossaryTerms().create(request);
  }
}
