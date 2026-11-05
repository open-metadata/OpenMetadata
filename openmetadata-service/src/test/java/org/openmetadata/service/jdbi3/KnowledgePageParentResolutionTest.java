package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * {@code storeRelationships} reads {@code parent.getId()} directly, so a parent that arrives as a
 * name-only reference has to be resolved during {@code prepare} - otherwise the CONTAINS row is
 * written with a null id and the page is silently orphaned.
 */
class KnowledgePageParentResolutionTest {

  private static final String PARENT_FQN = "Engineering";

  @Test
  void aNameOnlyParentIsResolvedToAReferenceCarryingAnId() {
    Page page =
        article()
            .withParent(
                new EntityReference().withType(Entity.PAGE).withFullyQualifiedName(PARENT_FQN));
    UUID parentId = UUID.randomUUID();

    prepare(page, resolved(parentId));

    assertEquals(parentId, page.getParent().getId());
    assertEquals(PARENT_FQN, page.getParent().getFullyQualifiedName());
  }

  @Test
  void aPageWithoutAParentIsLeftAlone() {
    Page page = article();

    prepare(page, resolved(UUID.randomUUID()));

    assertNull(page.getParent());
  }

  @Test
  void aParentThatAlreadyHasAnIdIsLeftAlone() {
    EntityReference parent = resolved(UUID.randomUUID());
    Page page = article().withParent(parent);
    KnowledgePageRepository repository = mock(KnowledgePageRepository.class, CALLS_REAL_METHODS);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      repository.prepare(page, true);

      assertEquals(parent, page.getParent());
      entity.verifyNoInteractions();
    }
  }

  private static void prepare(Page page, EntityReference resolvedParent) {
    KnowledgePageRepository repository = mock(KnowledgePageRepository.class, CALLS_REAL_METHODS);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      // Mirrors the real helper, which hands a null reference straight back rather than looking
      // anything up - a stub returning the resolved parent for every argument would hide that.
      entity
          .when(() -> Entity.getEntityReference(any(), eq(Include.NON_DELETED)))
          .thenAnswer(call -> call.getArgument(0) == null ? null : resolvedParent);
      repository.prepare(page, false);
    }
  }

  private static EntityReference resolved(UUID id) {
    return new EntityReference()
        .withId(id)
        .withType(Entity.PAGE)
        .withFullyQualifiedName(PARENT_FQN);
  }

  private static Page article() {
    return new Page().withName("runbook").withPageType(PageType.ARTICLE).withPage(new Article());
  }
}
