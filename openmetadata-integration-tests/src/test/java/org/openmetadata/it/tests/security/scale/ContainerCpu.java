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

package org.openmetadata.it.tests.security.scale;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.async.ResultCallback;
import com.github.dockerjava.api.model.Statistics;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.testcontainers.DockerClientFactory;

/** CPU time a container has used, read from one Docker stats sample. */
final class ContainerCpu {
  private static final long SAMPLE_TIMEOUT_SECONDS = 10;

  private ContainerCpu() {}

  /** Nanoseconds of CPU time used by the container since it started. */
  static long usedNanos(String containerId) {
    DockerClient docker = DockerClientFactory.lazyClient();
    AtomicReference<Statistics> sample = new AtomicReference<>();
    ResultCallback.Adapter<Statistics> callback =
        new ResultCallback.Adapter<>() {
          @Override
          public void onNext(Statistics statistics) {
            sample.set(statistics);
          }
        };
    try {
      docker.statsCmd(containerId).withNoStream(true).exec(callback);
      callback.awaitCompletion(SAMPLE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while reading container CPU", interrupted);
    }
    return sample.get().getCpuStats().getCpuUsage().getTotalUsage();
  }
}
