package org.openmetadata.service.resources.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;

class OntologyChangeSetListScopeTest {
  @Test
  void rowsOnTheSameExistingGlossaryNeedOneCheck() {
    final EntityReference shared = glossary();
    final var checks =
        OntologyChangeSetResource.glossaryScopeChecks(
            List.of(row(shared), row(shared), row(shared, glossary())));

    assertEquals(2, checks.size());
    assertEquals(shared.getId(), checks.iterator().next().glossary().getId());
    assertNull(checks.iterator().next().planned());
  }

  @Test
  void aGlossaryAChangeSetPlansToCreateIsCheckedAsACreate() {
    final EntityReference created = glossary();
    final Glossary planned = new Glossary().withId(created.getId()).withName("planned");
    final OntologyChangeSet row =
        row(created).withOperations(List.of(new OntologyChangeOperation().withGlossary(planned)));

    final var checks = OntologyChangeSetResource.glossaryScopeChecks(List.of(row, row));

    assertEquals(1, checks.size());
    assertEquals("planned", checks.iterator().next().planned().getName());
  }

  @Test
  void nativeRowsAddNoGlossaryCheck() {
    final OntologyChangeSet nativeRow =
        row(glossary()).withOntology(new EntityReference().withId(UUID.randomUUID()));

    assertEquals(0, OntologyChangeSetResource.glossaryScopeChecks(List.of(nativeRow)).size());
  }

  private static OntologyChangeSet row(final EntityReference... glossaries) {
    return new OntologyChangeSet().withGlossaries(List.of(glossaries));
  }

  private static EntityReference glossary() {
    return new EntityReference().withId(UUID.randomUUID()).withType("glossary");
  }
}
