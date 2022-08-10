/*
 *  Copyright 2022 Collate
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

package org.openmetadata.catalog.interfaces.services;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.Set;

/** Interface to be implemented by services connection configuration entities */
public interface ServiceConnectionConfigInterface {

  /** true if the object has fields that are public to the users */
  @JsonIgnore
  default boolean isExposingFields() {
    return false;
  }

  /**
   * fields which are public to the users when calling API service resources e.g. hostPort in connection config of
   * pipeline services
   */
  @JsonIgnore
  default Set<String> getExposedFields() {
    return Set.of();
  }
}
