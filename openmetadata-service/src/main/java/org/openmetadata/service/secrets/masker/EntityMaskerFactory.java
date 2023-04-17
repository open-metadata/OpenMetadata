/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.secrets.masker;

import com.google.common.annotations.VisibleForTesting;
import lombok.Getter;
import org.openmetadata.schema.security.SecurityConfiguration;

public class EntityMaskerFactory {

  @Getter private static EntityMasker entityMasker;

  private EntityMaskerFactory() {}

  /** Expected to be called only once when the Application starts */
  public static EntityMasker createEntityMasker(SecurityConfiguration config) {
    if (entityMasker != null) {
      return entityMasker;
    }
    if (Boolean.TRUE.equals(config.getMaskPasswordsAPI())) {
      entityMasker = PasswordEntityMasker.getInstance();
    } else {
      entityMasker = NoopEntityMasker.getInstance();
    }
    return entityMasker;
  }

  @VisibleForTesting
  public static void setEntityMasker(EntityMasker entityMasker) {
    EntityMaskerFactory.entityMasker = entityMasker;
  }
}
