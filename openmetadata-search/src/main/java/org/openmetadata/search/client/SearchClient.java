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

package org.openmetadata.search.client;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.search.core.SearchContext;
import org.openmetadata.search.core.SearchResponse;
import org.openmetadata.search.index.SearchIndexCrud;
import org.openmetadata.search.query.Query;

public interface SearchClient {

  void initialize() throws IOException;

  void close() throws IOException;

  boolean isHealthy();

  String getVersion();

  SearchIndexCrud getIndexCrud();

  SearchResponse search(SearchContext context, Query query) throws IOException;

  void indexDocument(String indexName, String documentId, Map<String, Object> document)
      throws IOException;

  void updateDocument(String indexName, String documentId, Map<String, Object> document)
      throws IOException;

  void deleteDocument(String indexName, String documentId) throws IOException;

  void bulkIndex(String indexName, List<Map<String, Object>> documents) throws IOException;

  void refresh(String indexName) throws IOException;

  Map<String, Object> getDocument(String indexName, String documentId) throws IOException;

  long countDocuments(String indexName, Query query) throws IOException;
}
