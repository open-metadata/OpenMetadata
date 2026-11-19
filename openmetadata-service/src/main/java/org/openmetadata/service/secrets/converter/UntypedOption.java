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

package org.openmetadata.service.secrets.converter;

/**
 * Stands in a candidate list for a {@code oneOf} option that has no generated class, such as an
 * inline definition. A value that matches no other candidate may be that option, so it is kept as
 * it is. Remove it once the option has a schema file of its own and its class is listed instead.
 */
public final class UntypedOption {
  private UntypedOption() {}
}
