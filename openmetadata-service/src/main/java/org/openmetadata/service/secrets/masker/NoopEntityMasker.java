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

import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;

public class NoopEntityMasker extends EntityMasker {

  private static NoopEntityMasker INSTANCE;

  private NoopEntityMasker() {}

  public static NoopEntityMasker getInstance() {
    if (INSTANCE == null) {
      INSTANCE = new NoopEntityMasker();
    }
    return INSTANCE;
  }

  @Override
  public Object maskServiceConnectionConfig(Object connectionConfig, String connectionType, ServiceType serviceType) {
    return connectionConfig;
  }

  @Override
  public void maskAuthenticationMechanism(String name, AuthenticationMechanism authenticationMechanism) {
    // do nothing
  }

  @Override
  public void maskIngestionPipeline(IngestionPipeline ingestionPipeline) {
    // do nothing
  }

  @Override
  public Object unmaskServiceConnectionConfig(
      Object connectionConfig, Object originalConnectionConfig, String connectionType, ServiceType serviceType) {
    return connectionConfig;
  }

  @Override
  public void unmaskIngestionPipeline(
      IngestionPipeline ingestionPipeline, IngestionPipeline originalIngestionPipeline) {
    // do nothing
  }

  @Override
  public void unmaskAuthenticationMechanism(
      String name,
      AuthenticationMechanism authenticationMechanism,
      AuthenticationMechanism originalAuthenticationMechanism) {
    // do nothing
  }
}
