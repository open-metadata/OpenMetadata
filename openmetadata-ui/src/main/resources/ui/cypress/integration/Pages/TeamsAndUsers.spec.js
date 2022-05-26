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

import { searchEntity } from '../../common/common';
import { DELETE_TERM, NEW_TEAM, NEW_USER, SEARCH_ENTITY_TABLE, TEAMS, TOTAL_SAMPLE_DATA_TEAMS_COUNT } from '../../constants/constants';

describe('TeamsAndUsers page', () => {
  beforeEach(() => {
    cy.goToHomePage();
    cy.get('[data-testid="terms"]').should('be.visible').click();
  });

  const seletctTeam = (name) => {
    cy.get(`[data-testid="team-${name}"]`).should('be.visible').click();
    cy.get(`[data-testid="team-${name}"] > .tw-group`).should(
      'have.class',
      'activeCategory'
    );
  };

  const toastNotification = (msg) => {
    cy.get('.Toastify__toast-body').should('be.visible').contains(msg);

    cy.get('.Toastify__close-button > svg > path').should('be.visible').click();
  };

  const createNewTeam = (data) => {
    cy.get('[data-testid="add-team-button"]').should('be.visible').click();
    cy.get('.tw-modal-container').should('be.visible');
    cy.get('[data-testid="name"]').should('be.visible').type(data.name);
    cy.get('[data-testid="displayName"]')
      .should('be.visible')
      .type(data.display_name);
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .should('be.visible')
      .type(data.description);

    cy.get('[data-testid="saveButton"]')
      .should('be.visible')
      .scrollIntoView()
      .click();

    cy.get(`[data-testid="team-${TEAMS.Cloud_Infra.name}"]`).should(
      'be.visible'
    );
  };

  const deleteNewTeam = (data) => {
    seletctTeam(data.name);
    cy.get('[data-testid="Manage"]').should('be.visible').click();
    cy.get('[data-testid="hard-delete"]')
      .should('be.visible')
      .as('hardDeleteContainer');

    cy.get('@hardDeleteContainer')
      .find('[data-testid="delete-button"]')
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);

    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();

    toastNotification('Team deleted successfully!');
  };

  it('All the required details should render properly', () => {
    cy.get('[data-testid="team-name"]').should(
      'have.length',
      TOTAL_SAMPLE_DATA_TEAMS_COUNT
    );
    cy.get(`[data-testid="team-${TEAMS.Cloud_Infra.name}"] > .tw-group`).should(
      'have.class',
      'activeCategory'
    );
    cy.get('[data-testid="team-heading"]')
      .should('be.visible')
      .invoke('text')
      .then((text) => {
        expect(text).equal(TEAMS.Cloud_Infra.name);
      });
  });

  it('Add new team flow should work properly', () => {
    const newTeams = Object.values(NEW_TEAM);
    newTeams.forEach((team) => {
      createNewTeam(team);
    });

    cy.get('[data-testid="team-name"]').should(
      'have.length',
      TOTAL_SAMPLE_DATA_TEAMS_COUNT + newTeams.length
    );
  });

  it('Description and display name updation should work properly', () => {
    const updatedName = 'Account_department';
    const updatedDescription = 'New description';
    cy.get('[data-testid="edit-synonyms"]').should('be.visible').click();
    cy.get('[data-testid="synonyms"]')
      .should('be.visible')
      .clear()
      .type(updatedName);

    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();

    cy.get('[data-testid="team-heading"]')
      .should('be.visible')
      .invoke('text')
      .then((text) => {
        expect(text).equal(updatedName);
      });

    cy.get('[data-testid="edit-description"] > [data-testid="image"]')
      .should('be.visible')
      .click();
    cy.get('.tw-modal-container').should('be.visible');
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .should('be.visible')
      .clear()
      .type(updatedDescription);

    cy.get('[data-testid="save"]').should('be.visible').click();
    cy.get('[data-testid="viewer-container"]')
      .contains(updatedDescription)
      .should('exist');
  });

  it('Add and remove user to team should work properly', () => {
    const searchString = 'aaron';
    
    cy.wait(1000)
    cy.get('[data-testid="add-new-user"]').should('be.visible'); 
    cy.get('[data-testid="add-new-user"]').click();
    cy.get('.tw-modal-container').should('be.visible');
    cy.get(
      '.tw-modal-body > [data-testid="search-bar-container"] > .tw-flex > [data-testid="searchbar"]'
    )
      .should('be.visible')
      .type(searchString);

    cy.get('.tw-grid').children().its('length').should('be.gt', 0);
    cy.get('[data-testid="checkboxAddUser"]').eq(1).check();

    cy.get('[data-testid="AddUserSave"]').should('be.visible').click();
    cy.get('[data-testid="user-card-container"]').should('be.visible');

    // remove user from team
    cy.get('[data-testid="remove"]').first().should('be.visible').click();
    cy.get('.tw-modal-container').should('be.visible');
    cy.get('[data-testid="body-text"]')
      .contains('Are you sure you want to remove')
      .should('be.visible');

    cy.get('[data-testid="save-button"]').should('be.visible').click();

    cy.get('.tw-modal-container').should('not.exist');
    cy.get('[data-testid="add-new-user"]').should('be.visible');
  });

  it('Delete team flow should work properly', () => {
    const newTeams = Object.values(NEW_TEAM);
    newTeams.forEach((team) => {
      deleteNewTeam(team);
    });
  });

  it('Join team flow should work properly', () => {
    seletctTeam(TEAMS.Customer_Support.name);
    cy.get('[data-testid="team-heading"]')
      .should('be.visible')
      .invoke('text')
      .then((text) => {
        expect(text).equal(TEAMS.Customer_Support.name);
      });

    cy.get('[data-testid="join-teams"]').should('be.visible').click();

    toastNotification('Team joined successfully!');

    // get current user name and search user list
    cy.get(
      '[data-testid="dropdown-profile"] > [data-testid="dropdown-item"] > :nth-child(1) > [data-testid="menu-button"]'
    )
      .should('be.visible')
      .click();
    cy.get('[data-testid="greeting-text"] > a > :nth-child(1)')
      .should('be.visible')
      .invoke('text')
      .then((name) => {
        cy.get('[data-testid="dropdown-item"] > .tw-z-10').click();
        cy.get('[data-testid="searchbar"]').should('be.visible').type(name);
        cy.get('.tw-grid > [data-testid="user-card-container"]')
          .should('be.visible')
          .contains(name)
          .should('exist');
      });
  });

  it('Leave team flow should work properly', () => {
    seletctTeam(TEAMS.Customer_Support.name);
    cy.get('[data-testid="team-heading"]')
      .should('be.visible')
      .invoke('text')
      .then((text) => {
        expect(text).equal(TEAMS.Customer_Support.name);
      });

    cy.get('[data-testid="join-teams"]').should('not.exist');
    cy.get('[data-testid="leave-team-button"]').should('be.visible').click();
    cy.get('.tw-modal-container')
      .should('be.visible')
      .contains(
        `Are you sure you want to leave the team ${TEAMS.Customer_Support.name}?`
      )
      .should('exist');

    cy.get('[data-testid="save-button"]').should('be.visible').click();
    toastNotification('Left the team successfully!');

    // This need to be un-commented once ES issue is resoved
    // cy.get(
    //   '[data-testid="dropdown-profile"] > [data-testid="dropdown-item"] > :nth-child(1) > [data-testid="menu-button"]'
    // )
    //   .should('be.visible')
    //   .click();
    // cy.get('[data-testid="greeting-text"] > a > :nth-child(1)')
    //   .should('be.visible')
    //   .invoke('text')
    //   .then((name) => {
    //     cy.get('[data-testid="dropdown-item"] > .tw-z-10').click();
    //     cy.get('[data-testid="searchbar"]').should('be.visible').type(name);
    //     cy.contains(`There are no users as ${name}.`).should('exist');
    //   });

    cy.get('[data-testid="Users"] > .tw-py-px > [data-testid="filter-count"]')
      .should('be.visible')
      .invoke('text')
      .then((text) => {
        expect(+text).equal(TEAMS.Customer_Support.users);
      });
  });

  it('Assets tab should work properly', () => {
    cy.intercept(
      '/api/v1/search/query?q=*&from=0&size=*&sort_field=last_updated_timestamp&sort_order=desc&index=*'
    ).as('searchApi');
    cy.get('[data-testid="Assets"]').should('be.visible').click();
    cy.get('[data-testid="Assets"]').should('have.class', 'active');
    cy.get('[data-testid="Assets"] > .tw-py-px > [data-testid="filter-count"]')
      .invoke('text')
      .then((text) => {
        expect(+text).equal(0);
      });

    cy.contains('Your team does not have any').should('be.visible');
    cy.get('a > .button-comp').should('be.visible').contains('Explore');
    searchEntity(SEARCH_ENTITY_TABLE.table_1.term);
    cy.intercept(
      '/api/v1/search/query?q=*&from=0&size=10&sort_order=desc&index=*'
    ).as('searchApi');

    cy.wait('@searchApi');
    cy.wait(500); // Wait for result to load after api success
    cy.get('[data-testid="table-link"]')
      .first()
      .contains(SEARCH_ENTITY_TABLE.table_1.term)
      .click();

    cy.get('[data-testid="Manage"]').should('be.visible').click();
    cy.get('[data-testid="owner-dropdown"]').should('be.visible').click();

    cy.get('[data-testid="searchInputText"]')
      .should('be.visible')
      .type(TEAMS.Cloud_Infra.name);

    cy.get('[data-testid="list-item"] > .tw-truncate')
      .should('be.visible')
      .click();

    cy.clickOnLogo();
    cy.get('[data-testid="terms"]').should('be.visible').click();

    cy.get('[data-testid="Assets"]').should('be.visible').click();
    cy.get('[data-testid="Assets"]').should('have.class', 'active');
    cy.get('[data-testid="Assets"] > .tw-py-px > [data-testid="filter-count"]')
      .invoke('text')
      .then((text) => {
        expect(+text).equal(1);
      });
  });

  it('Roles tab should work properly', () => {
    cy.intercept('/api/v1/teams?fields=*').as('teamApi');
    cy.get('[data-testid="Roles"]').should('be.visible').click();
    cy.get('[data-testid="Roles"]').should('have.class', 'active');
    cy.get('[data-testid="Roles"] > .tw-py-px > [data-testid="filter-count"]')
      .invoke('text')
      .then((text) => {
        expect(+text).equal(0);
      });

    cy.contains('There are no roles assigned yet.').should('be.visible');
    cy.get(
      '.tw-ml-5 > [data-testid="dropdown-item"] > div > [data-testid="menu-button"]'
    )
      .should('be.visible')
      .click();
    cy.get('[data-testid="menu-item-Roles"] > .tw-flex')
      .should('be.visible')
      .click();

    cy.get('[data-testid="teams"]').should('be.visible').click();
    cy.get('[data-testid="teams"]').should('have.class', 'active');

    cy.get('[data-testid="add-teams-button"]').should('be.visible').click();

    cy.get('.tw-modal-container').should('be.visible');

    cy.get('[data-testid="checkboxAddUser"]')
      .first()
      .should('be.visible')
      .click();

    cy.get('[data-testid="AddUserSave"]').should('be.visible').click();

    cy.clickOnLogo();
    cy.get('[data-testid="terms"]').should('be.visible').click();

    cy.get('[data-testid="Roles"]').should('be.visible').click();
    cy.get('[data-testid="Roles"]').should('have.class', 'active');
    cy.wait('@teamApi');
    cy.get('[data-testid="Roles"] > .tw-py-px > [data-testid="filter-count"]')
      .invoke('text')
      .then((text) => {
        expect(+text).equal(1);
      });
  });

  it('Add owner flow should work properly', () => {
    cy.get('[data-testid="Manage"]').should('be.visible').click();
    cy.get('[data-testid="Manage"]').should('have.class', 'active');

    cy.get(
      '[data-testid="dropdown-profile"] > [data-testid="dropdown-item"] > :nth-child(1) > [data-testid="menu-button"]'
    )
      .should('be.visible')
      .click();
    cy.get('[data-testid="greeting-text"] > a > :nth-child(1)')
      .should('be.visible')
      .invoke('text')
      .then((name) => {
        cy.get('.tw-z-10').click();

        cy.get('[data-testid="owner-dropdown"]').should('be.visible').click();
        cy.get('[data-testid="searchInputText"]').type(name);
        cy.get('[data-testid="list-item"]').should('be.visible').click();
        cy.get('[data-testid="owner-dropdown"] > .tw-truncate')
          .invoke('text')
          .then((text) => {
            expect(text).equal(name);
          });

        cy.get('[data-testid="owner-name"]')
          .should('be.visible')
          .contains(name);
      });
  });

  it('Create new user should work properly', () => {
    cy.get('[data-testid="users"] > .tw-group > [data-testid="user-type"]')
      .should('be.visible')
      .click();

    cy.get('[data-testid="users"] > .tw-group').should(
      'have.class',
      'activeCategory'
    );

    cy.get('[data-testid="add-user-button"]').should('be.visible').click();
    cy.contains('Create User').should('be.visible');

    cy.get('[data-testid="email"]').should('be.visible').type(NEW_USER.email);
    cy.get('[data-testid="displayName"]')
      .should('be.visible')
      .type(NEW_USER.display_name);
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .should('be.visible')
      .type(NEW_USER.description);

    cy.get(
      ':nth-child(5) > [data-testid="dropdown-item"] > div > [data-testid="menu-button"]'
    )
      .should('be.visible')
      .click();

    cy.get('[data-testid="Cloud_Infra"]').should('be.visible').click();
    cy.get('[data-testid="close-dropdown"]').click();

    cy.get(
      ':nth-child(6) > [data-testid="dropdown-item"] > div > [data-testid="menu-button"]'
    )
      .should('be.visible')
      .click();
    cy.get('[data-testid="Data Consumer"]').should('be.visible').click();
    cy.get('[data-testid="close-dropdown"]').click();

    cy.get('[data-testid="save-user"]').should('be.visible').click();

    cy.get('[data-testid="searchbar"]')
      .should('be.visible')
      .type(NEW_USER.display_name);

    cy.wait(500);

    cy.get('[data-testid="user-card-container"]')
      .first()
      .contains(NEW_USER.display_name)
      .should('exist')
      .click();

    cy.contains(NEW_USER.display_name).should('exist');
    cy.contains(NEW_USER.description).should('exist');
    cy.contains(NEW_USER.email).should('exist');
  });

  it('Delete user should work properly', () => {
    cy.get('[data-testid="users"] > .tw-group > [data-testid="user-type"]')
      .should('be.visible')
      .click();

    cy.get('[data-testid="users"] > .tw-group').should(
      'have.class',
      'activeCategory'
    );
    cy.get('[data-testid="searchbar"]')
      .should('be.visible')
      .type(NEW_USER.display_name);

    cy.wait(500);

    cy.get('[data-testid="user-card-container"]')
      .first()
      .contains(NEW_USER.display_name)
      .should('exist');

    cy.get('[data-testid="remove"] > [data-testid="image"]')
      .should('not.be.visible')
      .click();

    cy.get('.tw-modal-container').should('be.visible');
    cy.contains('Are you sure you want to delete').should('be.visible');
    cy.get('[data-testid="save-button"]').should('be.visible').click();

    cy.get('[data-testid="searchbar"]')
      .should('be.visible')
      .type(NEW_USER.display_name);

    cy.wait(500);

    cy.get('[data-testid="no-data-image"]').should('be.visible');
    cy.contains('No user available').should('be.visible');
  });
});
