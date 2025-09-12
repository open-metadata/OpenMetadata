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

package org.openmetadata.search.index;

import java.io.IOException;

public interface SearchIndexCrud {

  boolean indexExists(String indexName);

  void createIndex(String indexName, String indexMappingContent) throws IOException;

  void addIndexAlias(String indexName, String... aliasName) throws IOException;

  void createAliases(String indexName, String aliasName, String... parentAliases)
      throws IOException;

  void updateIndex(String indexName, String indexMappingContent) throws IOException;

  void deleteIndex(String indexName) throws IOException;

  void deleteAlias(String indexName, String aliasName) throws IOException;
}
