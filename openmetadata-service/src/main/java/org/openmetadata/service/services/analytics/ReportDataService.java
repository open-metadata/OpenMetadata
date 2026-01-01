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

package org.openmetadata.service.services.analytics;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.ReportDataRepository;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Singleton
public class ReportDataService {

  @Getter private final ReportDataRepository repository;
  private final Authorizer authorizer;

  @Inject
  public ReportDataService(ReportDataRepository repository, Authorizer authorizer) {
    this.repository = repository;
    this.authorizer = authorizer;
  }
}
