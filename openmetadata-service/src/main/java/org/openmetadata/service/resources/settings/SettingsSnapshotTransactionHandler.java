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
package org.openmetadata.service.resources.settings;

import java.sql.SQLException;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.HandleCallback;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.DelegatingTransactionHandler;
import org.jdbi.v3.core.transaction.TransactionHandler;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;

/**
 * Tells {@link SettingsCache} when a transaction starts. Jdbi reaches the handler only for a
 * handle's outermost transaction: a nested {@code inTransaction} on the same handle joins it.
 */
public final class SettingsSnapshotTransactionHandler extends DelegatingTransactionHandler {

  SettingsSnapshotTransactionHandler(TransactionHandler delegate) {
    super(delegate);
  }

  public static void install(Jdbi jdbi) {
    jdbi.setTransactionHandler(
        new SettingsSnapshotTransactionHandler(jdbi.getTransactionHandler()));
  }

  /**
   * Wraps the delegate's handler for this handle. Without it every transaction on the handle would
   * go through the unspecialized delegate, which looks the handle up in a synchronized map.
   */
  @Override
  public TransactionHandler specialize(Handle handle) throws SQLException {
    return new SettingsSnapshotTransactionHandler(getDelegate().specialize(handle));
  }

  @Override
  public <R, X extends Exception> R inTransaction(Handle handle, HandleCallback<R, X> callback)
      throws X {
    return SettingsCache.inTransaction(() -> getDelegate().inTransaction(handle, callback));
  }

  @Override
  public <R, X extends Exception> R inTransaction(
      Handle handle, TransactionIsolationLevel level, HandleCallback<R, X> callback) throws X {
    return SettingsCache.inTransaction(() -> getDelegate().inTransaction(handle, level, callback));
  }
}
