/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.drive.memory.MemoryDeriver;

class AiProviderHolderTest {

  @AfterEach
  void resetHolder() {
    AiProviderHolder.reset();
  }

  @Test
  void fallsBackToLlmProviderWhenCollateClassAbsent() {
    AiProvider provider = AiProviderHolder.get();

    assertInstanceOf(LlmAiProvider.class, provider);
  }

  @Test
  void usesInjectedProviderForTesting() {
    AiProvider injected = mock(AiProvider.class);

    AiProviderHolder.setForTesting(injected);

    assertSame(injected, AiProviderHolder.get());
  }

  @Test
  void resolvesProviderNamedBySystemProperty() {
    System.setProperty(AiProviderHolder.PROVIDER_CLASS_PROPERTY, FakeProvider.class.getName());
    try {
      AiProviderHolder.reset();

      assertInstanceOf(FakeProvider.class, AiProviderHolder.get());
    } finally {
      System.clearProperty(AiProviderHolder.PROVIDER_CLASS_PROPERTY);
    }
  }

  public static final class FakeProvider implements AiProvider {
    @Override
    public DocumentMemoryExtractor documentExtractor() {
      return null;
    }

    @Override
    public MemoryDeriver memoryDeriver() {
      return null;
    }
  }
}
