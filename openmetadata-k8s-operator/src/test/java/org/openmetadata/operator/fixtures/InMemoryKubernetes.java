/*
 *  Copyright 2021 Collate
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

package org.openmetadata.operator.fixtures;

import io.fabric8.kubernetes.api.model.Event;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.server.mock.KubernetesCrudDispatcher;
import io.fabric8.kubernetes.client.server.mock.KubernetesMockServer;
import io.fabric8.mockwebserver.Context;
import java.util.HashMap;
import java.util.List;
import okhttp3.mockwebserver.MockWebServer;

/**
 * An in-memory Kubernetes API that stores objects and evaluates label selectors, so label-based
 * pod lookups are tested against real matching rather than mocked client calls.
 */
public final class InMemoryKubernetes implements AutoCloseable {

  private final KubernetesMockServer server;
  private final KubernetesClient client;

  private InMemoryKubernetes(KubernetesMockServer server) {
    this.server = server;
    this.client = server.createClient();
  }

  public static InMemoryKubernetes start() {
    KubernetesMockServer server =
        new KubernetesMockServer(
            new Context(),
            new MockWebServer(),
            new HashMap<>(),
            new KubernetesCrudDispatcher(),
            false);
    server.init();
    return new InMemoryKubernetes(server);
  }

  public KubernetesClient client() {
    return client;
  }

  public List<String> podNames(String namespace) {
    return client.pods().inNamespace(namespace).list().getItems().stream()
        .map(pod -> pod.getMetadata().getName())
        .sorted()
        .toList();
  }

  public List<Event> events(String namespace, String reason) {
    return client.v1().events().inNamespace(namespace).list().getItems().stream()
        .filter(event -> reason.equals(event.getReason()))
        .toList();
  }

  @Override
  public void close() {
    client.close();
    server.destroy();
  }
}
