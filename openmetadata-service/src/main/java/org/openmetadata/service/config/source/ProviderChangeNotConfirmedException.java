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

/**
 * Switching the security settings to ENV would replace the identity provider configured in the UI
 * with a different one from the deployment, which signs everyone out and can lock them out.
 */
public class ProviderChangeNotConfirmedException extends IllegalStateException {
  public ProviderChangeNotConfirmedException(String message) {
    super(message);
  }
}
