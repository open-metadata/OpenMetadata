package org.openmetadata.service.resources.knowledge;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
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
    Page page =
        new KnowledgePageMapper().createToEntity(createPage(EntityStatus.ARCHIVED), "admin");

    assertEquals(EntityStatus.ARCHIVED, page.getEntityStatus());
  }

  @Test
  void anOmittedEntityStatusIsCarriedThroughUnchanged() {
    // Omits entityStatus entirely instead of setting it to null. Asserts propagation rather than a
    // literal value on purpose: createPage.json declares "default": "Approved" next to a $ref, and
    // whether jsonschema2pojo materializes that default at all depends on schema processing order,
    // so the generated field is null on some builds and Unprocessed on others. Either way the
    // mapper must hand the value through untouched - null then reaches
    // EntityRepository.setDefaultStatus, which fills in Unprocessed.
    CreatePage request =
        withRelatedEntity(
            new CreatePage()
                .withName("runbook")
                .withPageType(PageType.ARTICLE)
                .withPage(new Article()));

    Page page = new KnowledgePageMapper().createToEntity(request, "admin");

    assertEquals(request.getEntityStatus(), page.getEntityStatus());
  }

  @Test
  void anExplicitNullEntityStatusIsLeftForTheRepositoryDefault() {
    // The mapper must not invent a status of its own: a null reaches the repository, which then
    // fills in Unprocessed via setDefaultStatus.
    Page page = new KnowledgePageMapper().createToEntity(createPage(null), "admin");

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
        List.of(new EntityReference().withId(UUID.randomUUID()).withType("table")));
  }
}
