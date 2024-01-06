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

import { CustomPropertyType } from '../common/Utils/CustomProperty';
import { CustomPropertySupportedEntityList } from '../constants/CustomProperty.constant';
import ContainerClass from './base/ContainerClass';
import DashboardClass from './base/DashboardClass';
import DashboardDataModelClass from './base/DataModelClass';
import MlModelClass from './base/MlModelClass';
import PipelineClass from './base/PipelineClass';
import SearchIndexClass from './base/SearchIndexClass';
import TopicClass from './base/TopicClass';

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

    it(`Assign domain`, () => {
      entity.assignDomain();
    });

    it(`Update domain`, () => {
      entity.updateDomain();
    });

    it(`Remove domain`, () => {
      entity.removeDomain();
    });

    it(`Assign user Owner`, () => {
      entity.assignOwner(OWNER1);
    });

    it(`Update user Owner`, () => {
      entity.updateOwner(OWNER2);
    });

    it(`Remove user Owner`, () => {
      entity.removeOwner(OWNER2);
    });

    it(`Assign team as Owner`, () => {
      entity.assignTeamOwner(TEAM_OWNER_1);
    });

    it(`Update team as Owner`, () => {
      entity.updateTeamOwner(TEAM_OWNER_2);
    });

    it(`Remove team as Owner`, () => {
      entity.removeTeamOwner(TEAM_OWNER_2);
    });

    it(`Assign tier`, () => {
      entity.assignTier('Tier1');
    });

    it(`Update tier`, () => {
      entity.updateTier('Tier5');
    });

    it(`Remove tier`, () => {
      entity.removeTier();
    });

    it(`Update description`, () => {
      entity.updateDescription();
    });

    it(`Assign tags`, () => {
      entity.assignTags();
    });

    it(`Update Tags`, () => {
      entity.updateTags();
    });

    it(`Remove Tags`, () => {
      entity.removeTags();
    });

    it(`Assign GlossaryTerm`, () => {
      entity.assignGlossary();
    });

    it(`Update GlossaryTerm`, () => {
      entity.updateGlossary();
    });

    it(`Remove GlossaryTerm`, () => {
      entity.removeGlossary();
    });

    it(`Create annoucement`, () => {
      entity.createAnnouncement();
    });

    it(`Remove annoucement`, () => {
      entity.removeAnnouncement();
    });

    it(`Create inactive annoucement`, () => {
      entity.createInactiveAnnouncement();
    });

    it(`Remove inactive annoucement`, () => {
      entity.removeInactiveAnnouncement();
    });

    it(`UpVote entity`, () => {
      entity.upVote();
    });

    it(`DownVote entity`, () => {
      entity.downVote();
    });

    // Create custom property only for supported entities
    if (CustomPropertySupportedEntityList.includes(entity.endPoint)) {
      Object.values(CustomPropertyType).forEach((type) => {
        it(`Set ${type} Custom Property `, () => {
          entity.setCustomProperty(
            entity.customPropertyValue[type].property,
            entity.customPropertyValue[type].value
          );
        });

        it(`Update ${type} Custom Property`, () => {
          entity.updateCustomProperty(
            entity.customPropertyValue[type].property,
            entity.customPropertyValue[type].newValue
          );
        });
      });
    }

    it(`Update displayName`, () => {
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
