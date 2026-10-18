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

/** Tag association membership retained transactionally for independent search and RDF expansion. */
public record TagUsageMutation(int formatVersion) implements MutationFacts {
  public TagUsageMutation {
    if (formatVersion != 1) {
      throw new IllegalArgumentException(
          "Unsupported tag usage mutation version: " + formatVersion);
    }
  }

  @Override
  public Kind kind() {
    return Kind.TAG_USAGE;
  }
}
