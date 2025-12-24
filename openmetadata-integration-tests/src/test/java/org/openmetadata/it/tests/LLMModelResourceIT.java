package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.LLMServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.ai.CreateLLMModel;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
public class LLMModelResourceIT extends BaseEntityIT<LLMModel, CreateLLMModel> {

  {
    supportsSearchIndex = false; // LLMModel doesn't have a search index
  }

  @Override
  protected CreateLLMModel createMinimalRequest(TestNamespace ns) {
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");
    request.setDescription("Test LLM model created by integration test");

    return request;
  }

  @Override
  protected CreateLLMModel createRequest(String name, TestNamespace ns) {
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");

    return request;
  }

  @Override
  protected LLMModel createEntity(CreateLLMModel createRequest) {
    return SdkClients.adminClient().llmModels().create(createRequest);
  }

  @Override
  protected LLMModel getEntity(String id) {
    return SdkClients.adminClient().llmModels().get(id);
  }

  @Override
  protected LLMModel getEntityByName(String fqn) {
    return SdkClients.adminClient().llmModels().getByName(fqn);
  }

  @Override
  protected LLMModel patchEntity(String id, LLMModel entity) {
    return SdkClients.adminClient().llmModels().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().llmModels().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().llmModels().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().llmModels().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "llmmodel";
  }

  @Override
  protected void validateCreatedEntity(LLMModel entity, CreateLLMModel createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "LLMModel must have a service");
    assertEquals(createRequest.getBaseModel(), entity.getBaseModel());
    assertEquals(createRequest.getModelProvider(), entity.getModelProvider());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain LLM model name");
  }

  @Override
  protected ListResponse<LLMModel> listEntities(ListParams params) {
    return SdkClients.adminClient().llmModels().list(params);
  }

  @Override
  protected LLMModel getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().llmModels().get(id, fields);
  }

  @Override
  protected LLMModel getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().llmModels().getByName(fqn, fields);
  }

  @Override
  protected LLMModel getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().llmModels().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().llmModels().getVersionList(id);
  }

  @Override
  protected LLMModel getVersion(UUID id, Double version) {
    return SdkClients.adminClient().llmModels().getVersion(id.toString(), version);
  }

  @Test
  void post_llmModelWithoutRequiredService_4xx(TestNamespace ns) {
    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_no_service"));
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating LLM model without service should fail");
  }

  @Test
  void post_llmModelWithAllFields_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_full"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-4");
    request.setModelProvider("OpenAI");
    request.setModelVersion("1.0");
    request.setDescription("Complete LLM model with all fields");

    LLMModel llmModel = createEntity(request);
    assertNotNull(llmModel);
    assertEquals("gpt-4", llmModel.getBaseModel());
    assertEquals("OpenAI", llmModel.getModelProvider());
    assertEquals("1.0", llmModel.getModelVersion());
    assertEquals("Complete LLM model with all fields", llmModel.getDescription());
  }

  @Test
  void patch_llmModelBaseModel_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_patch_base"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");

    LLMModel llmModel = createEntity(request);
    assertEquals("gpt-3.5-turbo", llmModel.getBaseModel());

    llmModel.setBaseModel("gpt-4");
    LLMModel patched = patchEntity(llmModel.getId().toString(), llmModel);
    assertEquals("gpt-4", patched.getBaseModel());
  }

  @Test
  void patch_llmModelVersion_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_patch_version"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");
    request.setModelVersion("1.0");

    LLMModel llmModel = createEntity(request);
    assertEquals("1.0", llmModel.getModelVersion());

    llmModel.setModelVersion("1.1");
    LLMModel patched = patchEntity(llmModel.getId().toString(), llmModel);
    assertEquals("1.1", patched.getModelVersion());
  }

  @Test
  void patch_llmModelProvider_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_patch_provider"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");

    LLMModel llmModel = createEntity(request);
    assertEquals("OpenAI", llmModel.getModelProvider());

    llmModel.setModelProvider("Anthropic");
    LLMModel patched = patchEntity(llmModel.getId().toString(), llmModel);
    assertEquals("Anthropic", patched.getModelProvider());
  }

  @Test
  void test_llmModelVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_version"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");
    request.setDescription("Initial description");

    LLMModel llmModel = createEntity(request);
    Double initialVersion = llmModel.getVersion();

    llmModel.setDescription("Updated description");
    LLMModel updated = patchEntity(llmModel.getId().toString(), llmModel);
    assertTrue(updated.getVersion() >= initialVersion);

    EntityHistory history = getVersionHistory(llmModel.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_llmModelSoftDeleteAndRestore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_soft_delete"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");

    LLMModel llmModel = createEntity(request);
    String llmModelId = llmModel.getId().toString();

    deleteEntity(llmModelId);

    LLMModel deleted = getEntityIncludeDeleted(llmModelId);
    assertTrue(deleted.getDeleted());

    restoreEntity(llmModelId);

    LLMModel restored = getEntity(llmModelId);
    assertFalse(restored.getDeleted() != null && restored.getDeleted());
  }

  @Test
  void test_llmModelHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_hard_delete"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");

    LLMModel llmModel = createEntity(request);
    String llmModelId = llmModel.getId().toString();

    hardDeleteEntity(llmModelId);

    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(llmModelId),
        "Hard deleted model should not be retrievable");
  }

  @Test
  void test_listLLMModelsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    for (int i = 0; i < 3; i++) {
      CreateLLMModel request = new CreateLLMModel();
      request.setName(ns.prefix("list_llmmodel_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setBaseModel("gpt-3.5-turbo");
      request.setModelProvider("OpenAI");
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<LLMModel> models = listEntities(params);

    assertNotNull(models);
    assertTrue(models.getData().size() >= 3);
  }

  @Test
  void test_llmModelWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_with_owner"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");
    request.setOwners(java.util.List.of(testUser1().getEntityReference()));

    LLMModel llmModel = createEntity(request);
    assertNotNull(llmModel.getOwners());
    assertFalse(llmModel.getOwners().isEmpty());
    assertEquals(testUser1().getId(), llmModel.getOwners().get(0).getId());
  }

  @Test
  void test_llmModelDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_display"));
    request.setDisplayName("My Custom LLM Model");
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");

    LLMModel llmModel = createEntity(request);
    assertEquals("My Custom LLM Model", llmModel.getDisplayName());

    llmModel.setDisplayName("Updated LLM Model Name");
    LLMModel updated = patchEntity(llmModel.getId().toString(), llmModel);
    assertEquals("Updated LLM Model Name", updated.getDisplayName());
  }

  @Test
  void test_llmModelByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_by_name"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");

    LLMModel llmModel = createEntity(request);
    String fqn = llmModel.getFullyQualifiedName();

    LLMModel fetched = getEntityByName(fqn);
    assertEquals(llmModel.getId(), fetched.getId());
    assertEquals(llmModel.getName(), fetched.getName());
  }

  @Test
  void test_llmModelFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_fqn_test"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");

    LLMModel llmModel = createEntity(request);
    assertNotNull(llmModel.getFullyQualifiedName());
    assertTrue(llmModel.getFullyQualifiedName().contains(service.getName()));
    assertTrue(llmModel.getFullyQualifiedName().contains(llmModel.getName()));
  }

  @Test
  void test_llmModelListWithPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    for (int i = 0; i < 5; i++) {
      CreateLLMModel request = new CreateLLMModel();
      request.setName(ns.prefix("paginated_llmmodel_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setBaseModel("gpt-3.5-turbo");
      request.setModelProvider("OpenAI");
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<LLMModel> page1 = listEntities(params);

    assertNotNull(page1);
    assertNotNull(page1.getData());
    assertEquals(2, page1.getData().size());
    assertNotNull(page1.getPaging());
  }

  @Test
  void test_llmModelWithDifferentProviders(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    String[] providers = {"OpenAI", "Anthropic", "Google", "Cohere"};
    for (String provider : providers) {
      CreateLLMModel request = new CreateLLMModel();
      request.setName(ns.prefix("llmmodel_" + provider.toLowerCase()));
      request.setService(service.getFullyQualifiedName());
      request.setBaseModel("model-v1");
      request.setModelProvider(provider);

      LLMModel llmModel = createEntity(request);
      assertNotNull(llmModel);
      assertEquals(provider, llmModel.getModelProvider());
    }
  }

  @Test
  void test_llmModelConfiguration(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request = new CreateLLMModel();
    request.setName(ns.prefix("llmmodel_config"));
    request.setService(service.getFullyQualifiedName());
    request.setBaseModel("gpt-4");
    request.setModelProvider("OpenAI");
    request.setModelVersion("2024.1");
    request.setDescription("LLM model with configuration");

    LLMModel llmModel = createEntity(request);
    assertNotNull(llmModel);
    assertEquals("gpt-4", llmModel.getBaseModel());
    assertEquals("OpenAI", llmModel.getModelProvider());
    assertEquals("2024.1", llmModel.getModelVersion());

    LLMModel fetched = getEntity(llmModel.getId().toString());
    assertEquals(llmModel.getBaseModel(), fetched.getBaseModel());
    assertEquals(llmModel.getModelProvider(), fetched.getModelProvider());
    assertEquals(llmModel.getModelVersion(), fetched.getModelVersion());
  }
}
