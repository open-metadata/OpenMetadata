package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * A binding change re-projects the bound asset, whose projection carries the binding edges, once
 * the change has committed, and not when the change is refused.
 */
class OntologyConceptBindingProjectionTest {
  private static final OntologyConceptBindingService.Access ACCESS =
      new OntologyConceptBindingService.Access(null, null);
  private final OntologyConceptBindingStore store = mock(OntologyConceptBindingStore.class);
  private final EntityRepository<?> concepts = mock(EntityRepository.class);
  private final EntityRepository<?> tables = mock(EntityRepository.class);
  private final OntologyConcept concept =
      new OntologyConcept()
          .withId(UUID.randomUUID())
          .withOntology(new EntityReference().withId(UUID.randomUUID()));
  private final Table table =
      new Table().withId(UUID.randomUUID()).withFullyQualifiedName("svc.db.sales.customers");
  private final List<String> events = new ArrayList<>();
  private final OntologyConceptBindingService service =
      new OntologyConceptBindingService(
          store,
          mock(Authorizer.class),
          type -> Entity.TABLE.equals(type) ? tables : concepts,
          asset -> events.add("refresh " + asset.getType() + " " + asset.getId()));

  @BeforeEach
  void loadTheConceptAndTheAsset() {
    when(concepts.getEntityType()).thenReturn(Entity.ONTOLOGY_CONCEPT);
    when(tables.getEntityType()).thenReturn(Entity.TABLE);
    when(concepts.getFields(anyString())).thenReturn(new Fields(Set.of()));
    when(tables.getFields(anyString())).thenReturn(new Fields(Set.of()));
    when(((EntityRepository) concepts)
            .get(any(), eq(concept.getId()), any(), any(Include.class), anyBoolean()))
        .thenReturn(concept);
    when(((EntityRepository) tables)
            .get(any(), eq(table.getId()), any(), any(Include.class), anyBoolean()))
        .thenReturn(table);
  }

  @Test
  void addingOrRemovingABindingReprojectsTheAssetAfterTheChangeCommits() {
    when(store.update(any(), any()))
        .thenAnswer(
            call -> {
              events.add("commit");
              return 1L;
            });

    service.put(ACCESS, concept.getId(), update());
    service.remove(ACCESS, concept.getId(), Entity.TABLE, table.getId(), 1L);

    final String refresh = "refresh " + Entity.TABLE + " " + table.getId();
    assertEquals(List.of("commit", refresh, "commit", refresh), events);
  }

  @Test
  void aRefusedChangeReprojectsNothing() {
    when(store.update(any(), any()))
        .thenThrow(new ClientErrorException("changed", Response.Status.CONFLICT));

    assertThrows(ClientErrorException.class, () -> service.put(ACCESS, concept.getId(), update()));
    assertThrows(
        ClientErrorException.class,
        () -> service.remove(ACCESS, concept.getId(), Entity.TABLE, table.getId(), 0L));

    assertTrue(events.isEmpty());
  }

  private UpdateOntologyConceptBinding update() {
    return new UpdateOntologyConceptBinding()
        .withExpectedRevision(0L)
        .withAsset(
            new OntologyAssetBinding()
                .withAssetType(OntologyBindingAssetType.TABLE)
                .withAssetId(table.getId()));
  }
}
