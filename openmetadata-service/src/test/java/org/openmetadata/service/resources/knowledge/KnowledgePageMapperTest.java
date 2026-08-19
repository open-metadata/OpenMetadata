package org.openmetadata.service.resources.knowledge;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;

class KnowledgePageMapperTest {

  @Test
  void theRequestedEntityStatusReachesTheEntity() {
    // CreatePage carries entityStatus, but the mapper never copied it, so every article was
    // persisted as Unprocessed no matter what the caller asked for.
    // EntityRepository.setDefaultStatus
    // only fills in Unprocessed when the value is still null, so carrying it here is enough.
    Page page =
        new KnowledgePageMapper().createToEntity(createPage(EntityStatus.ARCHIVED), "admin");

    assertEquals(EntityStatus.ARCHIVED, page.getEntityStatus());
  }

  @Test
  void anOmittedEntityStatusIsLeftForTheRepositoryDefault() {
    // Omits entityStatus entirely rather than setting it to null, so this still holds if the DTO
    // ever starts carrying a value of its own. createPage.json declares "default": "Approved", but
    // jsonschema2pojo does not materialize a default that sits alongside a $ref — the generated
    // field is initialised to null (see the assertion below). Were that to change, the mapper would
    // start persisting Approved instead of letting the repository default to Unprocessed.
    CreatePage request =
        new CreatePage().withName("runbook").withPageType(PageType.ARTICLE).withPage(new Article());
    assertNull(request.getEntityStatus(), "CreatePage must not supply an entityStatus of its own");

    Page page = new KnowledgePageMapper().createToEntity(withRelatedEntity(request), "admin");

    assertNull(page.getEntityStatus());
  }

  private static CreatePage createPage(EntityStatus status) {
    return withRelatedEntity(
            new CreatePage()
                .withName("runbook")
                .withPageType(PageType.ARTICLE)
                .withPage(new Article()))
        .withEntityStatus(status);
  }

  /**
   * Supplies relatedEntities so the mapper skips its Organization-team fallback, which needs a live
   * entity registry and is not what these tests are about.
   */
  private static CreatePage withRelatedEntity(CreatePage request) {
    return request.withRelatedEntities(
        java.util.List.of(new EntityReference().withId(UUID.randomUUID()).withType("table")));
  }
}
