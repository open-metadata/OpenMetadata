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

import java.lang.reflect.Method;
import org.jdbi.v3.core.extension.ExtensionHandler;
import org.jdbi.v3.sqlobject.Handler;
import org.jdbi.v3.sqlobject.HandlerDecorator;

/**
 * A capture decorator that also wraps Jdbi's extension handlers. Since Jdbi 3.38 a SQL object
 * method runs through an {@link ExtensionHandler}, and {@link HandlerDecorator}'s default
 * customization leaves any handler that is not a legacy {@link Handler} undecorated, which would
 * let every captured write run uncaptured.
 */
interface CaptureDecorator extends HandlerDecorator {
  @Override
  default ExtensionHandler customize(
      final ExtensionHandler delegate, final Class<?> sqlObjectType, final Method method) {
    final Handler base =
        delegate instanceof Handler handler
            ? handler
            : (target, arguments, handles) -> delegate.invoke(handles, target, arguments);
    final Handler decorated = decorateHandler(base, sqlObjectType, method);
    return decorated == base ? delegate : decorated;
  }
}
