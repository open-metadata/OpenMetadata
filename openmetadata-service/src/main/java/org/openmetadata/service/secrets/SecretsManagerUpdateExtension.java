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

/**
 * SPI for credentials stored outside OpenMetadata's own entities. Distributions register
 * implementations via {@code
 * META-INF/services/org.openmetadata.service.secrets.SecretsManagerUpdateExtension}, and {@link
 * SecretsManagerUpdateService} runs them after its own entities, so {@code migrate} and {@code
 * migrate-secrets} update every stored credential without OpenMetadata knowing where the others
 * live.
 *
 * <p>An extension runs on every invocation, so it must leave credentials that are already up to
 * date as they are.
 */
public interface SecretsManagerUpdateExtension {

  /** Stable name used in logs. */
  String name();

  /** Brings the extension's stored credentials up to date with the configured secrets manager. */
  void updateSecrets();
}
