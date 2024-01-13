/*
 *  Copyright 2023 Collate.
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

import { CustomPropertySupportedEntityList } from '../../constants/CustomProperty.constant';
import ContainerClass from './../../common/Entities/ContainerClass';
import DashboardClass from './../../common/Entities/DashboardClass';
import DashboardDataModelClass from './../../common/Entities/DataModelClass';
import MlModelClass from './../../common/Entities/MlModelClass';
import PipelineClass from './../../common/Entities/PipelineClass';
import SearchIndexClass from './../../common/Entities/SearchIndexClass';
import TopicClass from './../../common/Entities/TopicClass';
import { CustomPropertyType } from './../../common/Utils/CustomProperty';

// Run tests over all entities except Database, Schema, Table and Store Procedure
// Those tests are covered in cypress/new-tests/Database.spec.js
const entities = [
  new DashboardClass(),
  new PipelineClass(),
  new TopicClass(),
  new MlModelClass(),
  new ContainerClass(),
  new SearchIndexClass(),
  new DashboardDataModelClass(),
] as const;

const OWNER1 = 'Aaron Johnson';
const OWNER2 = 'Cynthia Meyer';

const TEAM_OWNER_1 = 'Marketplace';
const TEAM_OWNER_2 = 'DevOps';

entities.forEach((entity) => {
  describe(`${entity.getName()} page`, () => {
    before(() => {
      cy.login();

      entity.prepareForTests();
    });

    after(() => {
      cy.login();

      entity.cleanup();
    });

    beforeEach(() => {
      cy.login();
      entity.visitEntity();
    });

    it(`Domain assign, update & delete`, () => {
      entity.assignDomain();
      entity.updateDomain();
      entity.removeDomain();
    });

    it(`User as Owner assign, update & delete`, () => {
      entity.userOwnerFlow(OWNER1, OWNER2);
    });

    it(`Team as Owner assign, update & delete`, () => {
      entity.teamOwnerFlow(TEAM_OWNER_1, TEAM_OWNER_2);
    });

    it(`Tier assign, update & delete`, () => {
      entity.tierFlow('Tier1', 'Tier5');
    });

    it(`Update description`, () => {
      entity.updateDescription();
    });

    it(`Tags assign, update & delete`, () => {
      entity.assignTags();
      entity.updateTags();
      entity.removeTags();
    });

    it(`GlossaryTerm assign, update & delete`, () => {
      entity.assignGlossary();
      entity.updateGlossary();
      entity.removeGlossary();
    });

    it(`Annoucement create & delete`, () => {
      entity.createAnnouncement();
      entity.removeAnnouncement();
    });

    it(`Inactive annoucement create & delete`, () => {
      entity.createInactiveAnnouncement();
      entity.removeInactiveAnnouncement();
    });

    it(`UpVote & DownVote entity`, () => {
      entity.upVote();
      entity.downVote();
    });

    // Create custom property only for supported entities
    if (CustomPropertySupportedEntityList.includes(entity.endPoint)) {
      const properties = Object.values(CustomPropertyType).join(', ');

      it(`Set ${properties} Custom Property `, () => {
        Object.values(CustomPropertyType).forEach((type) => {
          entity.setCustomProperty(
            entity.customPropertyValue[type].property,
            entity.customPropertyValue[type].value
          );
        });
      });

      it(`Update ${properties} Custom Property`, () => {
        Object.values(CustomPropertyType).forEach((type) => {
          entity.updateCustomProperty(
            entity.customPropertyValue[type].property,
            entity.customPropertyValue[type].newValue
          );
        });
      });
    }

    it(`follow unfollow entity`, () => {
      entity.followUnfollowEntity();
    });

    it.skip(`Update displayName`, () => {
      entity.renameEntity();
    });

    it(`Soft delete`, () => {
      entity.softDeleteEntity();
    });

    it(`Hard delete`, () => {
      entity.hardDeleteEntity();
    });
  });
});
