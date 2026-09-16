package org.openmetadata.sdk.services.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.ai.CreateLLMModel;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Unit tests for {@link LLMModelService}.
 *
 * <p>The server's {@code @PUT /v1/llmModels} endpoint binds the request body to {@code @Valid
 * CreateLLMModel}, which declares {@code service} as a {@code @NotNull String} (FQN). The entity
 * {@link LLMModel} instead declares {@code service} as an {@code EntityReference} (JSON object).
 * The inherited {@code EntityServiceBase#upsert(T)} PUTs an {@link LLMModel}, whose serialized
 * {@code service} object Jackson cannot coerce into the {@code String} the Create contract
 * expects, throwing {@code MismatchedInputException} before {@code @Valid} runs.
 *
 * <p>These tests pin the contract: a Create-typed {@link LLMModelService#upsert(CreateLLMModel)}
 * must issue {@code PUT /v1/llmModels} carrying the {@link CreateLLMModel} request (the server
 * contract), mirroring the existing {@link LLMModelService#create(CreateLLMModel)} POST overload.
 */
class LLMModelServiceTest {

  private static final String BASE_PATH = "/v1/llmModels";
  private static final String SERVICE_FQN = "OpenAI.gpt-provider";
  private static final String MODEL_NAME = "gpt-x";

  @Mock private HttpClient httpClient;

  private LLMModelService llmModelService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    llmModelService = new LLMModelService(httpClient);
  }

  private static CreateLLMModel createRequest() {
    CreateLLMModel request = new CreateLLMModel();
    request.setName(MODEL_NAME);
    request.setService(SERVICE_FQN);
    request.setBaseModel("gpt-3.5-turbo");
    request.setModelProvider("OpenAI");
    return request;
  }

  private static LLMModel response() {
    return new LLMModel()
        .withId(UUID.fromString("a1b2c3d4-e5f6-7890-abcd-ef1234567890"))
        .withName(MODEL_NAME);
  }

  /**
   * The bug fix: {@code upsert(CreateLLMModel)} must PUT the Create-typed request contract — not the
   * entity — so the server's {@code @Valid CreateLLMModel} binding succeeds.
   */
  @Test
  void upsertPutsCreateContractToBasePath() throws OpenMetadataException {
    CreateLLMModel request = createRequest();
    LLMModel expected = response();

    when(httpClient.execute(eq(HttpMethod.PUT), eq(BASE_PATH), eq(request), eq(LLMModel.class)))
        .thenReturn(expected);

    LLMModel result = llmModelService.upsert(request);

    assertNotNull(result);
    assertSame(expected, result);
    assertEquals(MODEL_NAME, result.getName());
    verify(httpClient).execute(HttpMethod.PUT, BASE_PATH, request, LLMModel.class);
  }

  /**
   * The body handed to {@code HttpClient.execute} for PUT must be the {@link CreateLLMModel}
   * request object (whose {@code service} serializes as a JSON {@code String}), proving the call
   * resolves to the new Create-typed overload rather than the inherited {@code upsert(LLMModel)}.
   */
  @Test
  void upsertSendsCreateLLMModelBodyNotEntity() throws OpenMetadataException {
    CreateLLMModel request = createRequest();
    ArgumentCaptor<Object> bodyCaptor = ArgumentCaptor.forClass(Object.class);

    when(httpClient.execute(
            eq(HttpMethod.PUT), eq(BASE_PATH), bodyCaptor.capture(), eq(LLMModel.class)))
        .thenReturn(response());

    llmModelService.upsert(request);

    Object capturedBody = bodyCaptor.getValue();
    assertNotNull(capturedBody);
    assertEquals(CreateLLMModel.class, capturedBody.getClass());
    assertSame(request, capturedBody);
  }

  /**
   * Regression guard: {@link LLMModelService#create(CreateLLMModel)} must continue to POST the
   * Create-typed request contract (the same-shape path the bug fix mirrors for PUT).
   */
  @Test
  void createPostsCreateContractToBasePath() throws OpenMetadataException {
    CreateLLMModel request = createRequest();
    LLMModel expected = response();

    when(httpClient.execute(eq(HttpMethod.POST), eq(BASE_PATH), eq(request), eq(LLMModel.class)))
        .thenReturn(expected);

    LLMModel result = llmModelService.create(request);

    assertNotNull(result);
    assertSame(expected, result);
    verify(httpClient).execute(HttpMethod.POST, BASE_PATH, request, LLMModel.class);
  }

  /**
   * The two overloads must be independent: {@code create} uses POST, {@code upsert} uses PUT, both
   * against {@code /v1/llmModels} with a {@link CreateLLMModel} body.
   */
  @Test
  void createAndUpsertUseDistinctHttpMethods() throws OpenMetadataException {
    CreateLLMModel request = createRequest();
    LLMModel expected = response();

    when(httpClient.execute(eq(HttpMethod.POST), eq(BASE_PATH), any(), eq(LLMModel.class)))
        .thenReturn(expected);
    when(httpClient.execute(eq(HttpMethod.PUT), eq(BASE_PATH), any(), eq(LLMModel.class)))
        .thenReturn(expected);

    llmModelService.create(request);
    llmModelService.upsert(request);

    verify(httpClient).execute(HttpMethod.POST, BASE_PATH, request, LLMModel.class);
    verify(httpClient).execute(HttpMethod.PUT, BASE_PATH, request, LLMModel.class);
  }
}
