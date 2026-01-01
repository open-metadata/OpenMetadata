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

package org.openmetadata.service.services.docstore;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.DocumentRepository;
import org.openmetadata.service.resources.docstore.DocStoreMapper;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Singleton
public class DocStoreService {

  @Getter private final DocumentRepository repository;
  @Getter private final DocStoreMapper mapper;
  private final Authorizer authorizer;

  @Inject
  public DocStoreService(DocumentRepository repository, Authorizer authorizer) {
    this.repository = repository;
    this.authorizer = authorizer;
    this.mapper = new DocStoreMapper(authorizer);
  }

  public void initialize() {
    repository.initSeedDataFromResources();
  }
}
