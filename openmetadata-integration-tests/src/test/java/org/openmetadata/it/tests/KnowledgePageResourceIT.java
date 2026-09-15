package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.knowledge.PageService;

@Execution(ExecutionMode.CONCURRENT)
public class KnowledgePageResourceIT extends BaseEntityIT<Page, CreatePage> {
  private static final String RELATED_ENTITIES = "relatedEntities";
  private static final String EDITORS = "editors";
  private static final String PARENT = "parent";

  {
    // The Page schema has neither a deletion marker nor an extension payload.
    supportsSoftDelete = false;
    supportsIncludeDeleted = false;
    supportsCustomExtension = false;
    // Data-product asset queries require deleted=false, which page search documents lack.
    supportsDataProductAssetsSearch = false;
  }

  @Override
  protected CreatePage createMinimalRequest(TestNamespace ns) {
    return createRequest(ns.prefix("article"), ns);
  }

  @Override
  protected CreatePage createRequest(String name, TestNamespace ns) {
    return new CreatePage()
        .withName(name)
        .withDescription("Knowledge page mutation fixture")
        .withPageType(PageType.ARTICLE)
        .withPage(new Article());
  }

  @Override
  protected PageService getEntityService() {
    return SdkClients.adminClient().pages();
  }

  @Override
  protected Page createEntity(CreatePage request) {
    return getEntityService().create(request);
  }

  @Override
  protected Page getEntity(String id) {
    return getEntityService().get(id);
  }

  @Override
  protected Page getEntityByName(String fqn) {
    return getEntityService().getByName(fqn);
  }

  @Override
  protected Page patchEntity(String id, Page page) {
    return getEntityService().update(id, page);
  }

  @Override
  protected void deleteEntity(String id) {
    getEntityService().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    getEntityService().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    getEntityService().delete(id, Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "page";
  }

  @Override
  protected String getResourcePath() {
    return "/v1/contextCenter/pages/";
  }

  @Override
  protected String getSearchIndexName() {
    return "knowledge_page_search_index";
  }

  @Override
  protected void validateCreatedEntity(Page page, CreatePage request) {
    assertEquals(request.getName(), page.getName());
    assertEquals(request.getDescription(), page.getDescription());
    assertEquals(request.getPageType(), page.getPageType());
  }

  @Override
  protected ListResponse<Page> listEntities(ListParams params) {
    return getEntityService().list(params);
  }

  @Override
  protected Page getEntityWithFields(String id, String fields) {
    return getEntityService().get(id, fields);
  }

  @Override
  protected Page getEntityByNameWithFields(String fqn, String fields) {
    return getEntityService().getByName(fqn, fields);
  }

  @Override
  protected Page getEntityIncludeDeleted(String id) {
    return getEntityService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return getEntityService().getVersionList(id);
  }

  @Override
  protected Page getVersion(UUID id, Double version) {
    return getEntityService().getVersion(id, version);
  }

  @Test
  void articlePatchReplacesRelationshipsAndRecordsEditor(TestNamespace ns) {
    final var related = createEntity(createRequest(ns.prefix("related"), ns));
    final var page = createEntity(createMinimalRequest(ns));
    final var team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam().withName(ns.prefix("editorTeam")).withTeamType(TeamType.GROUP));
    final String editorName = ns.shortPrefix("pageEditor");
    final var editor =
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser()
                    .withName(editorName)
                    .withEmail(editorName + "@example.com")
                    .withIsAdmin(true));
    final var editorPages =
        SdkClients.createClient(editor.getName(), editor.getEmail(), new String[] {"admin"})
            .pages();
    replace(editorPages, page, "/relatedEntities", List.of(team.getEntityReference()));
    replace(editorPages, page, "/page/relatedArticles", List.of(related.getEntityReference()));

    final var updated =
        getEntityWithFields(page.getId().toString(), RELATED_ENTITIES + "," + EDITORS);
    assertEquals(List.of(team.getId()), ids(updated.getRelatedEntities()));
    assertEquals(List.of(related.getId()), ids(article(updated).getRelatedArticles()));
    assertTrue(ids(updated.getEditors()).contains(editor.getId()));

    replace(page, "/relatedEntities", List.of());
    replace(page, "/page/relatedArticles", List.of());
    final var cleared = getEntityWithFields(page.getId().toString(), RELATED_ENTITIES);
    assertTrue(cleared.getRelatedEntities().isEmpty());
    assertTrue(article(cleared).getRelatedArticles().isEmpty());
  }

  @Test
  void quickLinkPutPreservesHistoryAndCachedAliases(TestNamespace ns) {
    final URI originalUrl = URI.create("https://example.com/original");
    final URI updatedUrl = URI.create("https://example.com/updated");
    final var page =
        createEntity(
            createMinimalRequest(ns)
                .withPageType(PageType.QUICK_LINK)
                .withPage(new QuickLink().withUrl(originalUrl)));
    assertEquals(originalUrl, link(getEntityByName(page.getFullyQualifiedName())).getUrl());
    final var updated =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                "/v1/contextCenter/pages",
                createRequest(page.getName(), ns)
                    .withPageType(PageType.QUICK_LINK)
                    .withPage(new QuickLink().withUrl(updatedUrl)),
                Page.class);
    assertEquals(updatedUrl, link(updated).getUrl());
    assertEquals(updatedUrl, link(getEntity(page.getId().toString())).getUrl());
    assertEquals(updatedUrl, link(getEntityByName(page.getFullyQualifiedName())).getUrl());
    assertTrue(updated.getVersion() > page.getVersion());
    assertEquals(originalUrl, link(getVersion(page.getId(), page.getVersion())).getUrl());
  }

  @Test
  void parentMovesInvalidateOldNamesAndPreserveIdentity(TestNamespace ns) {
    final var first = createEntity(createRequest(ns.prefix("parentA"), ns));
    final var second = createEntity(createRequest(ns.prefix("parentB"), ns));
    final var child =
        createEntity(createRequest(ns.prefix("child"), ns).withParent(first.getEntityReference()));
    assertEquals(child.getId(), getEntityByName(child.getFullyQualifiedName()).getId());
    final var moved = replace(child, "/parent", second.getEntityReference());
    assertEquals(child.getId(), moved.getId());
    assertEquals(
        second.getId(), getEntityWithFields(child.getId().toString(), PARENT).getParent().getId());
    assertEquals(child.getId(), getEntityByName(moved.getFullyQualifiedName()).getId());
    assertMissingName(child.getFullyQualifiedName());

    final var root =
        getEntityService()
            .patch(child.getId(), JsonUtils.readTree("[{\"op\":\"remove\",\"path\":\"/parent\"}]"));
    assertEquals(child.getName(), root.getFullyQualifiedName());
    assertNull(getEntityWithFields(child.getId().toString(), PARENT).getParent());
    assertEquals(child.getId(), getEntityByName(root.getFullyQualifiedName()).getId());
    assertMissingName(moved.getFullyQualifiedName());
    assertFalse(Boolean.TRUE.equals(root.getDeleted()));
  }

  private Page replace(Page page, String path, Object value) {
    return replace(getEntityService(), page, path, value);
  }

  private Page replace(PageService service, Page page, String path, Object value) {
    return service.patch(
        page.getId(),
        JsonUtils.readTree(
            JsonUtils.pojoToJson(List.of(Map.of("op", "add", "path", path, "value", value)))));
  }

  private void assertMissingName(String fullyQualifiedName) {
    final var failure = assertThrows(ApiException.class, () -> getEntityByName(fullyQualifiedName));
    assertEquals(404, failure.getStatusCode());
  }

  private Article article(Page page) {
    return JsonUtils.convertValue(page.getPage(), Article.class);
  }

  private QuickLink link(Page page) {
    return JsonUtils.convertValue(page.getPage(), QuickLink.class);
  }

  private List<UUID> ids(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).toList();
  }
}
