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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.schema.entity.services.ServiceType;

class PasswordFieldWalkerTest {

  @Test
  void visitsEveryCredentialWithItsPathAndStoresWhatTheVisitorReturns() {
    Credentials credentials = new Credentials();
    credentials.setPassword("top");
    credentials.setEndpoint(new Endpoint("nested"));
    credentials.setServers(List.of(new Server("alpha", "first"), new Server("beta", "second")));
    List<List<String>> visited = new ArrayList<>();

    PasswordFieldWalker.walk(
        credentials,
        List.of("root"),
        (fieldPath, value) -> {
          visited.add(fieldPath);
          return value.toUpperCase();
        });

    assertEquals(
        List.of(
            List.of("root", "endpoint", "token"),
            List.of("root", "password"),
            List.of("root", "servers", "alpha", "apikey"),
            List.of("root", "servers", "beta", "apikey")),
        visited.stream()
            .sorted((left, right) -> left.toString().compareTo(right.toString()))
            .toList());
    assertEquals("TOP", credentials.getPassword());
    assertEquals("NESTED", credentials.getEndpoint().getToken());
    assertEquals("SECOND", credentials.getServers().getLast().getApiKey());
  }

  @Test
  void aVisitorReturningTheSameValueLeavesTheFieldAlone() {
    Credentials credentials = new Credentials();
    credentials.setPassword("unchanged");

    PasswordFieldWalker.walk(credentials, List.of(), (fieldPath, value) -> value);

    assertEquals("unchanged", credentials.getPassword());
  }

  @Test
  void typedAndRawPasswordMapsVisitTheSameEntries() {
    Map<String, Object> config =
        Map.of(
            "type",
            "Kafka",
            "bootstrapServers",
            "localhost:9092",
            "consumerConfig",
            Map.of(
                "sasl.password", "secret", "CustomToken", "dynamic-secret", "fetch.min.bytes", 1));
    Map<String, Object> legacy = new HashMap<>(config);
    legacy.put("obsolete", true);
    List<List<String>> typedPaths = new ArrayList<>();
    List<List<String>> rawPaths = new ArrayList<>();

    PasswordFieldWalker.walk(
        SecretsUtil.convert(config, "Kafka", "kafka", ServiceType.MESSAGING),
        List.of(),
        (path, secret) -> {
          typedPaths.add(path);
          return secret;
        });
    PasswordFieldWalker.walk(
        SecretsUtil.convertForRead(legacy, "Kafka", ServiceType.MESSAGING),
        List.of(),
        (path, secret) -> {
          rawPaths.add(path);
          return secret;
        });

    assertEquals(
        List.of(
            List.of("consumerconfig", "additionalproperties", "CustomToken"),
            List.of("consumerconfig", "saslpassword")),
        typedPaths.stream().sorted(Comparator.comparing(Object::toString)).toList());
    assertEquals(new HashSet<>(typedPaths), new HashSet<>(rawPaths));
  }

  public static final class Credentials {
    private String password;
    private Endpoint endpoint;
    private List<Server> servers = List.of();

    @PasswordField
    public String getPassword() {
      return password;
    }

    public void setPassword(String password) {
      this.password = password;
    }

    public Endpoint getEndpoint() {
      return endpoint;
    }

    public void setEndpoint(Endpoint endpoint) {
      this.endpoint = endpoint;
    }

    public List<Server> getServers() {
      return servers;
    }

    public void setServers(List<Server> servers) {
      this.servers = servers;
    }
  }

  public static final class Endpoint {
    private String token;

    Endpoint(String token) {
      this.token = token;
    }

    @PasswordField
    public String getToken() {
      return token;
    }

    public void setToken(String token) {
      this.token = token;
    }
  }

  public static final class Server {
    private final String name;
    private String apiKey;

    Server(String name, String apiKey) {
      this.name = name;
      this.apiKey = apiKey;
    }

    public String getName() {
      return name;
    }

    @PasswordField
    public String getApiKey() {
      return apiKey;
    }

    public void setApiKey(String apiKey) {
      this.apiKey = apiKey;
    }
  }
}
