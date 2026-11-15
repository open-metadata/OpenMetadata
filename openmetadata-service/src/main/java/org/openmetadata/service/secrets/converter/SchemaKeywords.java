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

import java.util.List;

final class SchemaKeywords {
  static final String ROOT = "json/schema/";
  static final String TYPE_INDEX = "META-INF/openmetadata/schema-java-types.properties";
  static final String REF = "$ref";
  static final String PROPERTIES = "properties";
  static final String ADDITIONAL_PROPERTIES = "additionalProperties";
  static final String ITEMS = "items";
  static final String FORMAT = "format";
  static final String PASSWORD = "password";
  static final String TYPE = "type";
  static final String OBJECT = "object";
  static final String ARRAY = "array";
  static final String STRING = "string";
  static final String REQUIRED = "required";
  static final String DEFAULT = "default";
  static final String ENUM = "enum";
  static final String CONST = "const";
  static final String ONE_OF = "oneOf";
  static final String ANY_OF = "anyOf";
  static final String ALL_OF = "allOf";
  static final List<String> COMPOSITIONS = List.of(ONE_OF, ANY_OF, ALL_OF);
  static final String ADDITIONAL_PROPERTIES_ACCESSOR = "AdditionalProperties";

  private SchemaKeywords() {}
}
