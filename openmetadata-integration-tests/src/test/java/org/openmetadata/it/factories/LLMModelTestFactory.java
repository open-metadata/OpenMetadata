package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.ai.CreateLLMModel;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.services.LLMService;

public class LLMModelTestFactory {

  public static LLMModel createGPT(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("llmModel_" + uniqueId);

    LLMService service = LLMServiceTestFactory.createOpenAI(ns);

    CreateLLMModel request =
        new CreateLLMModel()
            .withName(name)
            .withService(service.getFullyQualifiedName())
            .withBaseModel("gpt-4")
            .withModelProvider("OpenAI")
            .withDescription("Test GPT model");

    return SdkClients.adminClient().llmModels().create(request);
  }

  public static LLMModel createWithService(TestNamespace ns, LLMService service) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("llmModel_" + uniqueId);

    CreateLLMModel request =
        new CreateLLMModel()
            .withName(name)
            .withService(service.getFullyQualifiedName())
            .withBaseModel("gpt-3.5-turbo")
            .withModelProvider("OpenAI")
            .withDescription("Test LLM model");

    return SdkClients.adminClient().llmModels().create(request);
  }

  public static LLMModel getById(String id) {
    return SdkClients.adminClient().llmModels().get(id);
  }
}
