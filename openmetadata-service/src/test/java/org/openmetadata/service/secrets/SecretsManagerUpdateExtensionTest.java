/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.ServiceConfigurationError;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.SecretsManagerUpdateException;

class SecretsManagerUpdateExtensionTest {

  @Test
  void everyExtensionRuns() {
    List<String> ran = new ArrayList<>();

    SecretsManagerUpdateService.runExtensions(
        List.of(
                extension("first", () -> ran.add("first")),
                extension("second", () -> ran.add("second")))
            .iterator());

    assertEquals(List.of("first", "second"), ran);
  }

  @Test
  void aFailingExtensionDoesNotStopTheOthersButFailsTheUpdate() {
    List<String> ran = new ArrayList<>();
    Iterator<SecretsManagerUpdateExtension> extensions =
        List.of(
                extension(
                    "broken",
                    () -> {
                      throw new IllegalStateException("vault unreachable");
                    }),
                extension("healthy", () -> ran.add("healthy")))
            .iterator();

    SecretsManagerUpdateException failure =
        assertThrows(
            SecretsManagerUpdateException.class,
            () -> SecretsManagerUpdateService.runExtensions(extensions));

    assertEquals(List.of("healthy"), ran);
    assertTrue(failure.getMessage().contains("broken"));
  }

  @Test
  void anExtensionThatCannotBeLoadedDoesNotStopTheOthersButFailsTheUpdate() {
    List<String> ran = new ArrayList<>();
    Iterator<SecretsManagerUpdateExtension> extensions =
        new UnloadableFirst(extension("healthy", () -> ran.add("healthy")));

    assertThrows(
        SecretsManagerUpdateException.class,
        () -> SecretsManagerUpdateService.runExtensions(extensions));

    assertEquals(List.of("healthy"), ran);
  }

  @Test
  void registrationsThatNeverLoadStopDiscovery() {
    Iterator<SecretsManagerUpdateExtension> neverLoads =
        new Iterator<>() {
          @Override
          public boolean hasNext() {
            throw new ServiceConfigurationError("unreadable registration");
          }

          @Override
          public SecretsManagerUpdateExtension next() {
            throw new NoSuchElementException();
          }
        };

    assertThrows(
        SecretsManagerUpdateException.class,
        () -> SecretsManagerUpdateService.runExtensions(neverLoads));
  }

  @Test
  void noExtensionsIsANoOp() {
    assertDoesNotThrow(
        () ->
            SecretsManagerUpdateService.runExtensions(
                List.<SecretsManagerUpdateExtension>of().iterator()));
  }

  private static SecretsManagerUpdateExtension extension(String name, Runnable update) {
    return new SecretsManagerUpdateExtension() {
      @Override
      public String name() {
        return name;
      }

      @Override
      public void updateSecrets() {
        update.run();
      }
    };
  }

  /** Fails to load its first registration, the way {@code ServiceLoader} reports one, then loads. */
  private static final class UnloadableFirst implements Iterator<SecretsManagerUpdateExtension> {
    private final SecretsManagerUpdateExtension loadable;
    private int calls;

    private UnloadableFirst(SecretsManagerUpdateExtension loadable) {
      this.loadable = loadable;
    }

    @Override
    public boolean hasNext() {
      return calls < 2;
    }

    @Override
    public SecretsManagerUpdateExtension next() {
      calls++;
      if (calls == 1) {
        throw new ServiceConfigurationError("provider class not found");
      }
      return loadable;
    }
  }
}
