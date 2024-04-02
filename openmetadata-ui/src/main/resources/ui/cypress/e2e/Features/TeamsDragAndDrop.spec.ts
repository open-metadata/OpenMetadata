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
import { interceptURL, toastNotification } from '../../common/common';
import {
  dragAndDropElement,
  openDragDropDropdown,
} from '../../common/Utils/DragAndDrop';
import {
  addTeam,
  commonTeamDetails,
  confirmationDragAndDropTeam,
  deleteTeamPermanently,
} from '../../common/Utils/Teams';
import { uuid } from '../../constants/constants';
import { SidebarItem } from '../../constants/Entity.interface';
import { GlobalSettingOptions } from '../../constants/settings.constant';

const teamNameGroup = `team-ct-test-${uuid()}`;
const teamNameBusiness = `team-ct-test-${uuid()}`;
const teamNameDivision = `team-ct-test-${uuid()}`;
const teamNameDepartment = `team-ct-test-${uuid()}`;

const TEAM_TYPE_BY_NAME = {
  [teamNameBusiness]: 'BusinessUnit',
  [teamNameDivision]: 'Division',
  [teamNameDepartment]: 'Department',
  [teamNameGroup]: 'Group',
};

const DRAG_AND_DROP_TEAM_DETAILS = [
  {
    name: teamNameBusiness,
    updatedName: `${teamNameBusiness}-updated`,
    teamType: 'BusinessUnit',
    description: `This is ${teamNameBusiness} description`,
    ...commonTeamDetails,
  },
  {
    name: teamNameDivision,
    updatedName: `${teamNameDivision}-updated`,
    teamType: 'Division',
    description: `This is ${teamNameDivision} description`,
    ...commonTeamDetails,
  },
  {
    name: teamNameDepartment,
    updatedName: `${teamNameDepartment}-updated`,
    teamType: 'Department',
    description: `This is ${teamNameDepartment} description`,
    ...commonTeamDetails,
  },
  {
    name: teamNameGroup,
    updatedName: `${teamNameGroup}-updated`,
    teamType: 'Group',
    description: `This is ${teamNameGroup} description`,
    ...commonTeamDetails,
  },
];

describe(
  'Teams drag and drop should work properly',
  { tags: 'Settings' },
  () => {
    beforeEach(() => {
      interceptURL('GET', `/api/v1/users?fields=*`, 'getUserDetails');
      interceptURL('GET', `/api/v1/permissions/team/name/*`, 'permissions');
      cy.login();

      cy.sidebarClick(SidebarItem.SETTINGS);

      // Clicking on teams
      cy.settingClick(GlobalSettingOptions.TEAMS);
    });

    before(() => {
      cy.login();
      cy.sidebarClick(SidebarItem.SETTINGS);
      // Clicking on teams
      cy.settingClick(GlobalSettingOptions.TEAMS);

      DRAG_AND_DROP_TEAM_DETAILS.map((team) => {
        addTeam(team);
        cy.reload();
        // asserting the added values
        cy.get(`[data-row-key="${team.name}"]`)
          .scrollIntoView()
          .should('be.visible');
        cy.get(`[data-row-key="${team.name}"]`).should(
          'contain',
          team.description
        );
      });
    });

    after(() => {
      cy.login();
      cy.sidebarClick(SidebarItem.SETTINGS);

      // Clicking on teams
      cy.settingClick(GlobalSettingOptions.TEAMS);

      [
        teamNameBusiness,
        teamNameDivision,
        teamNameDepartment,
        teamNameGroup,
      ].map((teamName) => {
        deleteTeamPermanently(teamName);
      });
    });

    it('Should fail when drop team type is Group', () => {
      [teamNameBusiness, teamNameDepartment, teamNameDivision].map((team) => {
        dragAndDropElement(team, teamNameGroup);
        toastNotification(
          `You cannot move to this team as Team Type ${TEAM_TYPE_BY_NAME[team]} can't be Group children`
        );

        cy.get('.Toastify__toast-body', { timeout: 10000 }).should('not.exist');
      });
    });

    it('Should fail when droppable team type is Department', () => {
      [teamNameBusiness, teamNameDivision].map((team) => {
        dragAndDropElement(team, teamNameDepartment);
        toastNotification(
          `You cannot move to this team as Team Type ${TEAM_TYPE_BY_NAME[team]} can't be Department children`
        );
        cy.get('.Toastify__toast-body', { timeout: 10000 }).should('not.exist');
      });
    });

    it('Should fail when draggable team type is BusinessUnit and droppable team type is Division', () => {
      dragAndDropElement(teamNameBusiness, teamNameDivision);
      toastNotification(
        `You cannot move to this team as Team Type BusinessUnit can't be Division children`
      );
    });

    [teamNameBusiness, teamNameDivision, teamNameDepartment].map(
      (droppableTeamName, index) => {
        it(`Should drag and drop on  ${TEAM_TYPE_BY_NAME[droppableTeamName]} team type`, () => {
          // nested team will be shown once anything is moved under it
          if (index !== 0) {
            openDragDropDropdown(
              [teamNameBusiness, teamNameDivision, teamNameDepartment][
                index - 1
              ]
            );
          }

          dragAndDropElement(teamNameGroup, droppableTeamName);

          confirmationDragAndDropTeam(teamNameGroup, droppableTeamName);

          // verify the team is moved under the business team
          openDragDropDropdown(droppableTeamName);
          cy.get(
            `.ant-table-row-level-1[data-row-key="${teamNameGroup}"]`
          ).should('be.visible');
        });
      }
    );

    it(`Should drag and drop team on table level`, () => {
      // open department team dropdown as it is moved under it from last test
      openDragDropDropdown(teamNameDepartment);

      dragAndDropElement(teamNameGroup, '.ant-table-thead > tr', true);
      confirmationDragAndDropTeam(teamNameGroup, 'Organization');

      // verify the team is moved under the table level
      cy.get(`.ant-table-row-level-0[data-row-key="${teamNameGroup}"]`)
        .scrollIntoView()
        .should('be.visible');
    });
  }
);
