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

package org.openmetadata.service.projection;

import java.sql.Connection;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.spi.JdbiPlugin;

/** Installs the pre-commit capture boundary without registering any catalog write decorators. */
public final class ProjectionCapturePlugin extends JdbiPlugin.Singleton {
  @Override
  public Connection customizeConnection(final Connection connection) {
    return ProjectionCaptureConnection.wrap(connection);
  }

  @Override
  public Handle customizeHandle(final Handle handle) {
    requireBuffer(handle).attach(handle);
    return handle;
  }

  static ProjectionCaptureBuffer buffer(final Handle handle) {
    return handle.getConnection() instanceof CaptureConnection connection
        ? connection.projectionCaptureBuffer()
        : null;
  }

  static ProjectionCaptureBuffer requireBuffer(final Handle handle) {
    final ProjectionCaptureBuffer buffer = buffer(handle);
    if (buffer == null) {
      throw new IllegalStateException(
          "Projection capture requires ProjectionCapturePlugin on the writer's JDBI instance");
    }
    return buffer;
  }

  /** The state follows the connection even when a SQL object's extension context replaces its config. */
  interface CaptureConnection extends Connection {
    ProjectionCaptureBuffer projectionCaptureBuffer();
  }
}
