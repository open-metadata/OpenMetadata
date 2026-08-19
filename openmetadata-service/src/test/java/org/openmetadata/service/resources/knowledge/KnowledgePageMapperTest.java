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
  void anAbsentEntityStatusIsLeftForTheRepositoryDefault() {
    Page page = new KnowledgePageMapper().createToEntity(createPage(null), "admin");

    assertNull(page.getEntityStatus());
  }

  /**
   * relatedEntities is supplied so the mapper skips its Organization-team fallback, which needs a
   * live entity registry and is not what these tests are about.
   */
  private static CreatePage createPage(EntityStatus status) {
    return new CreatePage()
        .withName("runbook")
        .withPageType(PageType.ARTICLE)
        .withPage(new Article())
        .withRelatedEntities(
            java.util.List.of(new EntityReference().withId(UUID.randomUUID()).withType("table")))
        .withEntityStatus(status);
  }
}
