package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ChangeRequestITSupport.deployHookWorkflowFor;
import static org.openmetadata.it.tests.ChangeRequestITSupport.filterScopedTo;
import static org.openmetadata.it.tests.ChangeRequestITSupport.onlyPendingRequest;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.glossary;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.op;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.patch;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.regulatoryScope;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.term;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.withStored;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.service.Entity;

// The Enforce workflow it deploys receives the events of every glossary term, so the class runs
// alone instead of beside the shared-lane tests.
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class GlossaryTermPropertiesApprovalIT {
  @Test
  void aPatchOfPropertyValuesIsHeldLikeAnyOtherGovernedTermEdit(TestNamespace ns) {
    Glossary glossary = glossary(ns, "approval", null);
    GlossaryTerm term =
        term(
            glossary,
            null,
            "Governed",
            List.of(regulatoryScope()),
            Map.of("regulatoryScope", List.of("GDPR")));
    deployHookWorkflowFor(
        ns,
        Entity.GLOSSARY_TERM,
        "\"propertyValues\",\"propertyDefinitions\"",
        "",
        filterScopedTo(Entity.GLOSSARY_TERM, term.getFullyQualifiedName()));

    patch(
        SdkClients.adminClient(), term, op("add", "/propertyValues/regulatoryScope", "[\"CCPA\"]"));

    assertEquals(List.of("GDPR"), withStored(term).getPropertyValues().get("regulatoryScope"));
    ChangeRequest held = onlyPendingRequest(term.getId());
    assertTrue(
        held.getActiveRevision().getOps().stream()
            .anyMatch(operation -> operation.getField().startsWith("propertyValues")),
        held.getActiveRevision().getOps().toString());
  }
}
