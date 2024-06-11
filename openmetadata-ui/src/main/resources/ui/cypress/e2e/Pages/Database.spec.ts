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

import EntityClass from '../../common/Entities/EntityClass';
import { CustomPropertyTypeByName } from '../../common/Utils/CustomProperty';
import { updateJWTTokenExpiryTime } from '../../common/Utils/Login';
import { JWT_EXPIRY_TIME_MAP } from '../../constants/constants';
import DatabaseClass from './../../common/Entities/DatabaseClass';
import DatabaseSchemaClass from './../../common/Entities/DatabaseSchemaClass';
import StoreProcedureClass from './../../common/Entities/StoredProcedureClass';
import TableClass from './../../common/Entities/TableClass';

const entities = [
  new DatabaseClass(),
  new DatabaseSchemaClass(),
  new TableClass(),
  new StoreProcedureClass(),
] as const;

const OWNER1 = 'Aaron Johnson';
const OWNER2 = 'Cynthia Meyer';

const TEAM_OWNER_1 = 'Marketplace';
const TEAM_OWNER_2 = 'DevOps';

describe('Database hierarchy details page', { tags: 'DataAssets' }, () => {
  before(() => {
    cy.login();

    updateJWTTokenExpiryTime(JWT_EXPIRY_TIME_MAP['2 hours']);
    EntityClass.preRequisitesForTests();
  });

  after(() => {
    cy.login();

    updateJWTTokenExpiryTime(JWT_EXPIRY_TIME_MAP['1 hour']);
    EntityClass.postRequisitesForTests();
  });

  entities.forEach((entity) => {
    describe(`${entity.getName()} page`, () => {
      before(() => {
        cy.login();

        entity.prepareForTests();
      });

      after(() => {
        cy.login();

        entity.cleanup();
        cy.logout();
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

      it(`Update displayName`, () => {
        entity.renameEntity();
      });

      it(`Announcement create & delete`, () => {
        entity.createAnnouncement();
        entity.replyAnnouncement();
        entity.removeAnnouncement();
      });

      it(`Inactive announcement create & delete`, () => {
        entity.createInactiveAnnouncement();
        entity.removeInactiveAnnouncement();
      });

      Object.values(CustomPropertyTypeByName).forEach((type) => {
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

      it(`UpVote & DownVote entity`, () => {
        entity.upVote();
        entity.downVote();
      });

      it(`follow unfollow entity`, () => {
        entity.followUnfollowEntity();
      });

      it(`Soft delete`, () => {
        entity.softDeleteEntity();
      });

      it(`Hard delete`, () => {
        entity.hardDeleteEntity();
      });
    });
  });
});
