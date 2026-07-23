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
package org.openmetadata.service.util.dbtune;

import org.jdbi.v3.core.Handle;

/**
 * Read-only DBA diagnostic. Inspects the live database for unused indexes, bloat indicators, slow
 * queries, and other signals. Implementations must catch and log per-category errors so a missing
 * extension (e.g. {@code pg_stat_statements} not installed) does not abort the whole diagnose run
 * — surface it in {@link DbTuneDiagnosis#notes()} instead.
 */
public interface Diagnostic {

  DbTuneDiagnosis diagnose(Handle handle);
}
