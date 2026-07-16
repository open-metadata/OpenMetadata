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
package org.openmetadata.service.rdf;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.service.Entity;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

public final class RdfIndexingFields {

  private RdfIndexingFields() {}

  public static List<String> forEntityType(String entityType) {
    List<String> fields = ReindexingUtil.getSearchIndexFields(entityType);
    if (fields.contains("*")) {
      return fields;
    }
    List<String> rdfFields = new ArrayList<>(fields);
    rdfFields.remove(Entity.FIELD_VOTES);
    return rdfFields;
  }
}
