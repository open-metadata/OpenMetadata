package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyHydratedAssetBinding;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.AuthorizationException;

class OntologyBoundAssetLinksTest {
  private static final int PAGE = OntologyConceptBindingService.MAX_PAGE_SIZE;
  private static final OntologyConceptBindingService.Access ACCESS =
      new OntologyConceptBindingService.Access(null, null);
  private final OntologyConceptBindingService bindings = mock(OntologyConceptBindingService.class);
  private final OntologyConcept concept = new OntologyConcept().withId(UUID.randomUUID());

  private static OntologyHydratedAssetBinding binding(
      final OntologyBindingAssetType type, final UUID id) {
    return new OntologyHydratedAssetBinding().withAssetType(type).withAssetId(id);
  }

  private static OntologyConceptBindingsResponse page(
      final String after, final OntologyHydratedAssetBinding... assets) {
    return new OntologyConceptBindingsResponse().withAssets(List.of(assets)).withAfter(after);
  }

  @Test
  void everyBindingOnEveryPageBecomesOneLinkInAssetOrder() {
    final UUID table = UUID.randomUUID();
    final UUID topic = UUID.randomUUID();
    final UUID dashboard = UUID.randomUUID();
    when(bindings.get(ACCESS, concept.getId(), PAGE, null))
        .thenReturn(
            page(
                "next",
                binding(OntologyBindingAssetType.TABLE, table),
                binding(OntologyBindingAssetType.TOPIC, topic)));
    when(bindings.get(ACCESS, concept.getId(), PAGE, "next"))
        .thenReturn(page(null, binding(OntologyBindingAssetType.DASHBOARD, dashboard)));

    assertEquals(
        List.of(
            URI.create("https://open-metadata.org/entity/table/" + table),
            URI.create("https://open-metadata.org/entity/topic/" + topic),
            URI.create("https://open-metadata.org/entity/dashboard/" + dashboard)),
        new OntologyBoundAssetLinks(bindings, ACCESS).assetsOf(concept));
  }

  @Test
  void aConceptDeletedSinceTheCaptureOrHiddenFromTheCallerHasNoLinks() {
    when(bindings.get(any(), eq(concept.getId()), eq(PAGE), isNull()))
        .thenThrow(new EntityNotFoundException("gone"));
    final OntologyConcept hidden = new OntologyConcept().withId(UUID.randomUUID());
    when(bindings.get(any(), eq(hidden.getId()), eq(PAGE), isNull()))
        .thenThrow(new AuthorizationException("denied"));
    final var links = new OntologyBoundAssetLinks(bindings, ACCESS);

    assertEquals(List.of(), links.assetsOf(concept));
    assertEquals(List.of(), links.assetsOf(hidden));
  }

  @Test
  void theLinkBudgetIsSharedAcrossConcepts() {
    final OntologyConcept other = new OntologyConcept().withId(UUID.randomUUID());
    when(bindings.get(ACCESS, concept.getId(), PAGE, null))
        .thenReturn(page(null, binding(OntologyBindingAssetType.TABLE, UUID.randomUUID())));
    when(bindings.get(ACCESS, other.getId(), PAGE, null))
        .thenReturn(
            page(
                null,
                binding(OntologyBindingAssetType.TABLE, UUID.randomUUID()),
                binding(OntologyBindingAssetType.TABLE, UUID.randomUUID())));
    final var links = new OntologyBoundAssetLinks(bindings, ACCESS, 2);

    assertEquals(1, links.assetsOf(concept).size());
    assertThrows(BadRequestException.class, () -> links.assetsOf(other));
  }
}
