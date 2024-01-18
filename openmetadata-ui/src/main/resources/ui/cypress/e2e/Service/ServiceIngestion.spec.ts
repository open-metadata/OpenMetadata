/*
 *  Copyright 2024 Collate.
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
import AirflowIngestionClass from '../../common/Services/AirflowIngestionClass';
import BigQueryIngestionClass from '../../common/Services/BigQueryIngestionClass';
import KafkaIngestionClass from '../../common/Services/KafkaIngestionClass';
import MetabaseIngestionClass from '../../common/Services/MetabaseIngestionClass';
import MlFlowIngestionClass from '../../common/Services/MlFlowIngestionClass';
import MysqlIngestionClass from '../../common/Services/MysqlIngestionClass';
import S3IngestionClass from '../../common/Services/S3IngestionClass';
import SnowflakeIngestionClass from '../../common/Services/SnowflakeIngestionClass';
import SupersetIngestionClass from '../../common/Services/SupersetIngestionClass';
import { goToServiceListingPage } from '../../common/Utils/Services';

const services = [
  new S3IngestionClass(),
  new MetabaseIngestionClass(),
  new MysqlIngestionClass(),
  new AirflowIngestionClass(),
  new BigQueryIngestionClass(),
  new KafkaIngestionClass(),
  new MlFlowIngestionClass(),
  new SnowflakeIngestionClass(),
  new SupersetIngestionClass(),
];

services.forEach((service) => {
  describe(`${service.serviceType} Ingestion`, () => {
    beforeEach(() => {
      cy.login();
      goToServiceListingPage(service.category);
    });

    it(`Create & Ingest ${service.serviceType} service`, () => {
      service.createService();
    });

    it(`Update description and verify description after re-run`, () => {
      service.updateService();
    });

    it(`Delete ${service.serviceType} service`, () => {
      service.deleteService();
    });
  });
});
