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

/** Converts JSON-shaped input at a secret-processing boundary. */
public class ClassConverter {
  protected final Class<?> clazz;
  private final SchemaClassConverter engine;

  ClassConverter(Class<?> clazz, SchemaClassConverter engine) {
    this.clazz = clazz;
    this.engine = engine;
  }

  public Object convert(Object object) {
    return engine.convert(object, clazz, false);
  }

  public Object convertForRead(Object object) {
    return engine.convert(object, clazz, true);
  }
}
