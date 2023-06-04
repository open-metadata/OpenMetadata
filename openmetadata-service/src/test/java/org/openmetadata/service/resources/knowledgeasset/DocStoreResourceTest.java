// package org.openmetadata.service.resources.quicklink;
//
// import static org.junit.jupiter.api.Assertions.assertEquals;
// import static org.junit.jupiter.api.Assertions.assertNotNull;
// import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
// import static org.openmetadata.service.util.TestUtils.assertListNull;
// import static org.openmetadata.service.util.TestUtils.assertResponse;
//
// import java.io.IOException;
// import java.net.URI;
// import java.util.Map;
// import javax.ws.rs.core.Response;
// import org.apache.http.client.HttpResponseException;
// import org.junit.jupiter.api.Test;
// import org.junit.jupiter.api.TestInfo;
// import org.openmetadata.schema.api.data.CreateKnowledgeAsset;
// import org.openmetadata.schema.entity.data.knowledge.KnowledgeAsset;
// import org.openmetadata.schema.entity.data.knowledge.KnowledgeAssetType;
// import org.openmetadata.service.Entity;
// import org.openmetadata.service.resources.EntityResourceTest;
// import org.openmetadata.service.util.JsonUtils;
//
// class KnowledgeAssetResourceTest extends EntityResourceTest<KnowledgeAsset, CreateKnowledgeAsset> {
//  private final String QUICK_LINK_URL = "http://test.com";
//
//  public KnowledgeAssetResourceTest() {
//    super(
//        Entity.KNOWLEDGE_ASSET,
//        KnowledgeAsset.class,
//        KnowledgeAssetResource.KnowledgeAssetList.class,
//        "knowledgeAssets",
//        KnowledgeAssetResource.FIELDS);
//    supportsSoftDelete = false;
//  }
//
//  @Test
//  void post_valid_quick_link_test_created(TestInfo test) throws IOException {
//    CreateKnowledgeAsset create = createRequest(getEntityName(test));
//    createEntity(create, ADMIN_AUTH_HEADERS);
//    assertNotNull(create);
//  }
//
//  @Test
//  void post_without_uri_400(TestInfo test) {
//    KnowledgeAsset create = createRequest(getEntityName(test)).withUrl(null);
//    assertResponse(
//        () -> createEntity(create, ADMIN_AUTH_HEADERS), Response.Status.BAD_REQUEST, "[url must not be null]");
//  }
//
//  @Test
//  void post_same_quickLink_forSameEntityType_409(TestInfo test) throws HttpResponseException {
//    CreateKnowledgeAsset create = createRequest(getEntityName(test));
//    createEntity(create, ADMIN_AUTH_HEADERS);
//
//    CreateKnowledgeAsset create1 = createRequest(getEntityName(test));
//
//    assertResponse(() -> createEntity(create1, ADMIN_AUTH_HEADERS), Response.Status.CONFLICT, "Entity already
// exists");
//  }
//
//  @Test
//  void patch_uri_200_ok(TestInfo test) throws IOException {
//    CreateKnowledgeAsset create = createRequest(test);
//    KnowledgeAsset quickLink = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
//
//    String json = JsonUtils.pojoToJson(quickLink);
//    String updatedUrl = "http://testcase.com";
//    quickLink.withUrl(URI.create(updatedUrl));
//    KnowledgeAsset updatedQuickLink = patchEntity(quickLink.getId(), json, quickLink, ADMIN_AUTH_HEADERS);
//
//    KnowledgeAsset getQuickLink = getEntity(quickLink.getId(), ADMIN_AUTH_HEADERS);
//
//    assertEquals(getQuickLink.getUrl(), URI.create(updatedUrl));
//  }
//
//  @Override
//  public CreateKnowledgeAsset createRequest(String name) {
//    return new
// CreateKnowledgeAsset().withName(name).withOwner(USER1_REF).withKnowledgeAssetType(KnowledgeAssetType.QUICK_LINK).withKnowledgeAssetContent(new QuickLink());
//  }
//
//  @Override
//  public void validateCreatedEntity(KnowledgeAsset createdEntity, CreateKnowledgeAsset request, Map<String, String>
// authHeaders)
//      throws HttpResponseException {
//    assertEquals(request.getUrl(), createdEntity.getUrl());
//  }
//
//  @Override
//  public void compareEntities(KnowledgeAsset expected, KnowledgeAsset updated, Map<String, String> authHeaders)
//      throws HttpResponseException {}
//
//  @Override
//  public KnowledgeAsset validateGetWithDifferentFields(KnowledgeAsset entity, boolean byName) throws
// HttpResponseException {
//    String fields = "";
//    entity =
//        byName
//            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
//            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
//    assertListNull(entity.getOwner(), entity.getFollowers(), entity.getTags());
//    fields = "owner,tags,followers";
//    entity =
//        byName
//            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
//            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
//    return entity;
//  }
//
//  @Override
//  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {}
// }
