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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.DeleteOntologyResource;
import org.openmetadata.schema.api.data.OntologyDeleteResult;
import org.openmetadata.schema.api.data.OntologyImpactReport;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyImpactIT {
  private static final String PROTECTED_TAG = "PII.Sensitive";

  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void requiresFreshImpactAndReassignsChildrenBeforeDelete(final TestNamespace namespace) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Glossary glossary =
        GlossaryTestFactory.createWithName(namespace, namespace.uniqueShortId());
    final GlossaryTerm parent = createTerm(client, glossary, namespace.prefix("parent"), null);
    final GlossaryTerm child =
        createTerm(client, glossary, namespace.prefix("child"), parent.getFullyQualifiedName());
    final OpenMetadataClient caller =
        restrictedClient(namespace, MetadataOperation.EDIT_GLOSSARY_TERMS);

    final OntologyImpactReport impact =
        caller.ontologyImpacts().previewGlossaryTermDelete(parent.getId());
    final DeleteOntologyResource request =
        new DeleteOntologyResource()
            .withImpactToken(impact.getImpactToken())
            .withReassignChildrenTo(glossary.getEntityReference())
            .withCascadeConfirmed(false)
            .withHardDelete(false);
    final OntologyDeleteResult result =
        caller.ontologyImpacts().deleteGlossaryTerm(parent.getId(), request);

    assertEquals(
        List.of(child.getId()), impact.getChildren().stream().map(EntityReference::getId).toList());
    assertEquals(1, result.getReassignedChildren());
    assertFalse(result.getCascaded());
    final GlossaryTerm reassigned =
        client.glossaryTerms().get(child.getId().toString(), "parent,glossary");
    assertNull(reassigned.getParent());
    assertEquals(glossary.getId(), reassigned.getGlossary().getId());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void rejectsReassignmentOfProtectedDescendantBeforeMovingAnyChild(
      final boolean protectGrandchild, final TestNamespace namespace) {
    final Hierarchy hierarchy = createHierarchy(namespace, protectGrandchild);
    final OpenMetadataClient caller =
        restrictedClient(namespace, MetadataOperation.EDIT_GLOSSARY_TERMS);
    final DeleteOntologyResource request =
        deleteRequest(caller, hierarchy.parent())
            .withReassignChildrenTo(hierarchy.glossary().getEntityReference());

    assertThrows(
        ForbiddenException.class,
        () -> caller.ontologyImpacts().deleteGlossaryTerm(hierarchy.parent().getId(), request));

    assertUnchanged(hierarchy.parent());
    assertUnchanged(hierarchy.child());
    assertUnchanged(hierarchy.protectedTerm());
  }

  @ParameterizedTest
  @CsvSource({"false,false", "false,true", "true,false", "true,true"})
  void rejectsCascadeWithProtectedDescendant(
      final boolean hardDelete, final boolean protectGrandchild, final TestNamespace namespace) {
    final Hierarchy hierarchy = createHierarchy(namespace, protectGrandchild);
    final OpenMetadataClient caller = restrictedClient(namespace, MetadataOperation.DELETE);
    assertThrows(
        ForbiddenException.class,
        () ->
            caller.ontologyImpacts().previewGlossaryTermDelete(hierarchy.protectedTerm().getId()));
    final DeleteOntologyResource request =
        deleteRequest(caller, hierarchy.parent())
            .withCascadeConfirmed(true)
            .withHardDelete(hardDelete);

    assertThrows(
        ForbiddenException.class,
        () -> caller.ontologyImpacts().deleteGlossaryTerm(hierarchy.parent().getId(), request));

    assertUnchanged(hierarchy.parent());
    assertUnchanged(hierarchy.child());
    assertUnchanged(hierarchy.protectedTerm());
  }

  @Test
  void rejectsHardCascadeOfAlreadySoftDeletedDescendant(final TestNamespace namespace) {
    final Hierarchy hierarchy = createHierarchy(namespace, true);
    final OpenMetadataClient admin = SdkClients.adminClient();
    admin
        .glossaryTerms()
        .delete(
            hierarchy.child().getId().toString(),
            Map.of("recursive", "true", "hardDelete", "false"));
    final GlossaryTerm deletedChild = getIncludingDeleted(hierarchy.child());
    final GlossaryTerm deletedGrandchild = getIncludingDeleted(hierarchy.protectedTerm());
    assertTrue(deletedChild.getDeleted());
    assertTrue(deletedGrandchild.getDeleted());
    final OpenMetadataClient caller = restrictedClient(namespace, MetadataOperation.DELETE);
    final DeleteOntologyResource request =
        deleteRequest(caller, hierarchy.parent()).withCascadeConfirmed(true).withHardDelete(true);

    assertThrows(
        ForbiddenException.class,
        () -> caller.ontologyImpacts().deleteGlossaryTerm(hierarchy.parent().getId(), request));

    assertUnchanged(hierarchy.parent());
    assertUnchanged(deletedChild);
    assertUnchanged(deletedGrandchild);
  }

  @Test
  void enforcesOwnerBasedDescendantPolicy(final TestNamespace namespace) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Glossary glossary =
        GlossaryTestFactory.createWithName(namespace, namespace.uniqueShortId());
    final GlossaryTerm parent = createTerm(admin, glossary, namespace.prefix("parent"), null);
    final GlossaryTerm child =
        admin
            .glossaryTerms()
            .create(
                termRequest(
                        glossary, namespace.prefix("ownedChild"), parent.getFullyQualifiedName())
                    .withOwners(List.of(admin.users().getByName("admin").getEntityReference())));
    final OpenMetadataClient caller =
        restrictedClient(namespace, MetadataOperation.DELETE, "!noOwner()");
    final DeleteOntologyResource request =
        deleteRequest(caller, parent).withCascadeConfirmed(true).withHardDelete(true);

    assertThrows(
        ForbiddenException.class,
        () -> caller.ontologyImpacts().deleteGlossaryTerm(parent.getId(), request));

    assertUnchanged(parent);
    assertUnchanged(child);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void permitsCascadeWhenCallerCanDeleteEveryDescendant(
      final boolean hardDelete, final TestNamespace namespace) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Glossary glossary =
        GlossaryTestFactory.createWithName(namespace, namespace.uniqueShortId());
    final GlossaryTerm parent = createTerm(admin, glossary, namespace.prefix("parent"), null);
    final GlossaryTerm child =
        createTerm(admin, glossary, namespace.prefix("child"), parent.getFullyQualifiedName());
    final GlossaryTerm grandchild =
        createTerm(admin, glossary, namespace.prefix("grandchild"), child.getFullyQualifiedName());
    final OpenMetadataClient caller = restrictedClient(namespace, MetadataOperation.DELETE);
    final DeleteOntologyResource request =
        deleteRequest(caller, parent).withCascadeConfirmed(true).withHardDelete(hardDelete);

    final OntologyDeleteResult result =
        caller.ontologyImpacts().deleteGlossaryTerm(parent.getId(), request);

    assertTrue(result.getCascaded());
    assertEquals(hardDelete, result.getHardDeleted());
    for (final GlossaryTerm term : List.of(parent, child, grandchild)) {
      if (hardDelete) {
        final ApiException exception =
            assertThrows(ApiException.class, () -> getIncludingDeleted(term));
        assertEquals(404, exception.getStatusCode());
      } else {
        assertTrue(getIncludingDeleted(term).getDeleted());
      }
    }
  }

  private static Hierarchy createHierarchy(
      final TestNamespace namespace, final boolean protectGrandchild) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Glossary glossary =
        GlossaryTestFactory.createWithName(namespace, namespace.uniqueShortId());
    final GlossaryTerm parent = createTerm(admin, glossary, namespace.prefix("parent"), null);
    final GlossaryTerm child =
        createTerm(admin, glossary, namespace.prefix("child"), parent.getFullyQualifiedName());
    final GlossaryTerm protectedTerm =
        admin
            .glossaryTerms()
            .create(
                termRequest(
                        glossary,
                        namespace.prefix("protected"),
                        (protectGrandchild ? child : parent).getFullyQualifiedName())
                    .withTags(
                        List.of(
                            new TagLabel()
                                .withTagFQN(PROTECTED_TAG)
                                .withSource(TagLabel.TagSource.CLASSIFICATION)
                                .withLabelType(TagLabel.LabelType.MANUAL)
                                .withState(TagLabel.State.CONFIRMED))));
    return new Hierarchy(glossary, parent, child, protectedTerm);
  }

  private static OpenMetadataClient restrictedClient(
      final TestNamespace namespace, final MetadataOperation deniedOperation) {
    return restrictedClient(namespace, deniedOperation, "matchAnyTag('" + PROTECTED_TAG + "')");
  }

  private static OpenMetadataClient restrictedClient(
      final TestNamespace namespace,
      final MetadataOperation deniedOperation,
      final String condition) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final String name = namespace.shortPrefix("impactUser");
    final Policy policy =
        namespace.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(name + "Policy")
                        .withRules(policyRules(deniedOperation, condition))));
    final Role role =
        namespace.trackRoot(
            Entity.ROLE,
            admin
                .roles()
                .create(
                    new CreateRole()
                        .withName(name + "Role")
                        .withPolicies(List.of(policy.getFullyQualifiedName()))));
    final User user =
        namespace.trackRoot(
            Entity.USER,
            admin
                .users()
                .create(
                    new CreateUser()
                        .withName(name)
                        .withEmail(name + "@test.openmetadata.org")
                        .withRoles(List.of(role.getId()))));
    return SdkClients.createClient(user.getName(), user.getEmail(), new String[] {});
  }

  private static List<Rule> policyRules(
      final MetadataOperation deniedOperation, final String condition) {
    return List.of(
        new Rule()
            .withName("AllowTermOperations")
            .withEffect(Rule.Effect.ALLOW)
            .withResources(List.of(Entity.GLOSSARY, Entity.GLOSSARY_TERM))
            .withOperations(
                List.of(MetadataOperation.DELETE, MetadataOperation.EDIT_GLOSSARY_TERMS)),
        new Rule()
            .withName("DenyProtectedTerms")
            .withEffect(Rule.Effect.DENY)
            .withResources(List.of(Entity.GLOSSARY_TERM))
            .withOperations(List.of(deniedOperation))
            .withCondition(condition));
  }

  private static DeleteOntologyResource deleteRequest(
      final OpenMetadataClient caller, final GlossaryTerm parent) {
    return new DeleteOntologyResource()
        .withImpactToken(
            caller.ontologyImpacts().previewGlossaryTermDelete(parent.getId()).getImpactToken())
        .withCascadeConfirmed(false)
        .withHardDelete(false);
  }

  private static GlossaryTerm getIncludingDeleted(final GlossaryTerm term) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .get(term.getId().toString(), "parent,glossary", "all");
  }

  private static void assertUnchanged(final GlossaryTerm original) {
    final GlossaryTerm current = getIncludingDeleted(original);
    assertEquals(original.getDeleted(), current.getDeleted());
    assertEquals(original.getVersion(), current.getVersion());
    assertEquals(original.getFullyQualifiedName(), current.getFullyQualifiedName());
    assertEquals(
        original.getParent() == null ? null : original.getParent().getId(),
        current.getParent() == null ? null : current.getParent().getId());
  }

  private record Hierarchy(
      Glossary glossary, GlossaryTerm parent, GlossaryTerm child, GlossaryTerm protectedTerm) {}

  private static GlossaryTerm createTerm(
      final OpenMetadataClient client,
      final Glossary glossary,
      final String name,
      final String parent) {
    return client.glossaryTerms().create(termRequest(glossary, name, parent));
  }

  private static CreateGlossaryTerm termRequest(
      final Glossary glossary, final String name, final String parent) {
    return new CreateGlossaryTerm()
        .withName(name)
        .withDescription("Ontology impact test term")
        .withGlossary(glossary.getFullyQualifiedName())
        .withParent(parent);
  }
}
