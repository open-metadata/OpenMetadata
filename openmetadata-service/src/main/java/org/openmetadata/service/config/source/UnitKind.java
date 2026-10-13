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

/** How a field of a setting is reconciled between the deployment and the stored value. */
public enum UnitKind {
  /** Merged on its own: a deployment change applies unless the field was changed in the UI. */
  INDEPENDENT,
  /** Always taken from the deployment; the UI never edits it. */
  DEPLOYMENT_OWNED,
  /** Names the identity provider. Applied together with the provider's dependent fields. */
  IDP_IDENTITY,
  /** Only meaningful for the identity provider it was configured for. */
  IDP_DEPENDENT,
  /** A list of independent entries, merged entry by entry. */
  SET_MERGE
}
