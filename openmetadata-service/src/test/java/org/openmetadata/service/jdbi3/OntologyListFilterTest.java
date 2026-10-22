package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Include;

class OntologyListFilterTest {
  @Test
  void bindsTheOwningOntologyForListAndCountQueries() {
    String id = "value' OR 1=1 --";
    ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("ontologyId", id);

    assertTrue(filter.getCondition().contains("ontologyId = :ontologyIdParam"));
    assertTrue(
        filter
            .getCondition("ontology_concept_entity")
            .contains("ontology_concept_entity.ontologyId = :ontologyIdParam"));
    assertTrue(
        filter
            .getCondition("ontology_property_entity")
            .contains("ontology_property_entity.ontologyId = :ontologyIdParam"));
    assertTrue(
        filter
            .getCondition("ontology_release_entity")
            .contains("ontology_release_entity.ontologyId = :ontologyIdParam"));
    assertFalse(filter.getCondition().contains(id));
    assertEquals(id, filter.getQueryParams().get("ontologyIdParam"));
    assertFalse(filter.getCondition("glossary_term_entity").contains("ontologyId"));
  }
}
