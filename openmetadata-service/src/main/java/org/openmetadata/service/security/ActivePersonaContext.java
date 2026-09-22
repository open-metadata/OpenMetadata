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

package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

public final class ActivePersonaContext {
  private static final ThreadLocal<String> ACTIVE_PERSONA = new ThreadLocal<>();

  private ActivePersonaContext() {}

  public static void setActivePersona(String activePersona) {
    if (nullOrEmpty(activePersona)) {
      ACTIVE_PERSONA.remove();
    } else {
      ACTIVE_PERSONA.set(activePersona);
    }
  }

  public static String getActivePersona() {
    return ACTIVE_PERSONA.get();
  }

  public static void clear() {
    ACTIVE_PERSONA.remove();
  }
}
