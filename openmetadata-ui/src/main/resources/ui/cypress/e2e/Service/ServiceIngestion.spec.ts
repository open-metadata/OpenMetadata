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
import AirflowIngestionClass from '../../common/Entities/AirflowIngestionClass';
import MetabaseIngestionClass from '../../common/Entities/MetabaseIngestionClass';
import MysqlIngestionClass from '../../common/Entities/MysqlIngestionClass';
import S3StorageIngestionClass from '../../common/Entities/S3StorageClass';
import { goToServiceListingPage } from '../../common/Utils/Services';

const services = [
  new S3StorageIngestionClass(),
  new MetabaseIngestionClass(),
  new MysqlIngestionClass(),
  new AirflowIngestionClass(),
];

services.forEach((service) => {
  describe(`${service.category} Ingestion`, () => {
    beforeEach(() => {
      cy.login();
      goToServiceListingPage(service.category);
    });

    it(`Create & Ingest ${service.category} service`, () => {
      service.createService();
    });

    it(`Update description and verify description after re-run`, () => {
      service.updateService();
    });

    it(`Delete ${service.category} service`, () => {
      service.deleteService();
    });
  });
});
