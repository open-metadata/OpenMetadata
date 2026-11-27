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

package org.openmetadata.service.config.source;

/** What reconciling one unit of a setting did. */
public enum MergeOutcome {
  /** A value deliberately changed in the deployment was applied. */
  APPLIED(false),
  /** A default of the deployment changed, for example by an upgrade, and was applied. */
  DEFAULT_CHANGED(false),
  /** A value the stored setting did not have yet was filled from the deployment. */
  BACKFILLED(false),
  /** The deployment and the UI both changed the value; the UI value was kept. */
  CONFLICT(true),
  /** The deployment sets the value deliberately but the stored value differs and is used. */
  DRIFT(true),
  /** A deployment change to the identity provider was ignored: the UI switched providers. */
  IGNORED_FOR_IDENTITY(true),
  /** The deployment value became empty; the stored value was kept. */
  KEPT_OVER_BLANK(true),
  /** A deployment change was ignored because the source of the setting is DB. */
  IGNORED_BY_DB_MODE(true);

  private final boolean warning;

  MergeOutcome(boolean warning) {
    this.warning = warning;
  }

  public boolean isWarning() {
    return warning;
  }
}
