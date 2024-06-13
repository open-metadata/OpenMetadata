/*
 *  Copyright 2022 Collate.
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

import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyMultipleResponseStatusCode,
  verifyResponseStatusCode,
} from '../../common/common';
import {
  addOwnerInGlossary,
  checkDisplayName,
  createGlossary,
  createGlossaryTerms,
  deleteGlossary,
  selectActiveGlossary,
  verifyGlossaryDetails,
} from '../../common/GlossaryUtils';
import { dragAndDropElement } from '../../common/Utils/DragAndDrop';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { confirmationDragAndDropGlossary } from '../../common/Utils/Glossary';
import { getToken } from '../../common/Utils/LocalStorage';
import {
  addOwner,
  generateRandomUser,
  removeOwner,
} from '../../common/Utils/Owner';
import { assignTags, removeTags } from '../../common/Utils/Tags';
import { GLOSSARY_DROPDOWN_ITEMS } from '../../constants/advancedSearchQuickFilters.constants';
import {
  COLUMN_NAME_FOR_APPLY_GLOSSARY_TERM,
  DELETE_TERM,
  SEARCH_ENTITY_TABLE,
} from '../../constants/constants';
import { EntityType, SidebarItem } from '../../constants/Entity.interface';
import {
  GLOSSARY_1,
  GLOSSARY_2,
  GLOSSARY_3,
  GLOSSARY_OWNER_LINK_TEST_ID,
} from '../../constants/glossary.constant';
import { GlobalSettingOptions } from '../../constants/settings.constant';

const CREDENTIALS = generateRandomUser();
const userName = `${CREDENTIALS.firstName}${CREDENTIALS.lastName}`;

const CREDENTIALS_2 = generateRandomUser();
const userName2 = `${CREDENTIALS_2.firstName}${CREDENTIALS_2.lastName}`;

let createdUserId = '';
let createdUserId_2 = '';

const visitGlossaryTermPage = (
  termName: string,
  fqn: string,
  fetchPermission?: boolean
) => {
  interceptURL(
    'GET',
    `/api/v1/search/query?q=*&from=0&size=*&index=glossary_term_search_index`,
    'getGlossaryTerm'
  );
  interceptURL(
    'GET',
    '/api/v1/permissions/glossaryTerm/*',
    'waitForTermPermission'
  );

  cy.get(`[data-row-key="${Cypress.$.escapeSelector(fqn)}"]`)
    .scrollIntoView()
    .should('be.visible')
    .contains(termName)
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@getGlossaryTerms', 200);

  if (fetchPermission) {
    verifyResponseStatusCode('@waitForTermPermission', 200);
  }
  cy.get('.ant-tabs .glossary-overview-tab').should('be.visible').click();
};

const checkAssetsCount = (assetsCount) => {
  cy.get('[data-testid="assets"] [data-testid="filter-count"]')
    .scrollIntoView()
    .should('have.text', assetsCount);
};

const addAssetToGlossaryTerm = (glossaryTerm, glossary) => {
  goToGlossaryPage();
  selectActiveGlossary(glossary.name);
  goToAssetsTab(glossaryTerm.name, glossaryTerm.fullyQualifiedName, true);

  checkAssetsCount(0);
  cy.contains('Adding a new Asset is easy, just give it a spin!').should(
    'be.visible'
  );

  cy.get('[data-testid="glossary-term-add-button-menu"]').click();
  cy.get('.ant-dropdown-menu .ant-dropdown-menu-title-content')
    .contains('Assets')
    .click();

  cy.get('[data-testid="asset-selection-modal"] .ant-modal-title').should(
    'contain',
    'Add Assets'
  );

  glossaryTerm.assets.forEach((asset) => {
    interceptURL('GET', '/api/v1/search/query*', 'searchAssets');
    cy.get('[data-testid="asset-selection-modal"] [data-testid="searchbar"]')
      .click()
      .clear()
      .type(asset.name);

    verifyResponseStatusCode('@searchAssets', 200);

    cy.get(
      `[data-testid="table-data-card_${asset.fullyQualifiedName}"] input[type="checkbox"]`
    ).click();
  });

  cy.get('[data-testid="save-btn"]').click();
  checkAssetsCount(glossaryTerm.assets.length);
};

const removeAssetsFromGlossaryTerm = (glossaryTerm, glossary) => {
  goToGlossaryPage();
  selectActiveGlossary(glossary.name);
  goToAssetsTab(glossaryTerm.name, glossaryTerm.fullyQualifiedName, true);
  checkAssetsCount(glossaryTerm.assets.length);
  glossaryTerm.assets.forEach((asset, index) => {
    interceptURL('GET', '/api/v1/search/query*', 'searchAssets');
    cy.get(`[data-testid="manage-button-${asset.fullyQualifiedName}"]`).click();
    cy.get('[data-testid="delete-button"]').click();
    cy.get("[data-testid='save-button']").click();

    cy.get('[data-testid="overview"]').click();
    cy.get('[data-testid="assets"]').click();

    // go assets tab
    verifyResponseStatusCode('@searchAssets', 200);

    checkAssetsCount(glossaryTerm.assets.length - (index + 1));
  });
};

const deleteGlossaryTerm = ({ name, fullyQualifiedName }) => {
  visitGlossaryTermPage(name, fullyQualifiedName);

  cy.get('[data-testid="manage-button"]').should('be.visible').click();
  cy.get('[data-testid="delete-button"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get('[data-testid="delete-confirmation-modal"]')
    .should('exist')
    .then(() => {
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[data-testid="modal-header"]').should('be.visible');
    });
  cy.get('[data-testid="modal-header"]')
    .should('be.visible')
    .should('contain', name);
  cy.get('[data-testid="confirmation-text-input"]')
    .should('be.visible')
    .type(DELETE_TERM);

  cy.get('[data-testid="confirm-button"]')
    .should('be.visible')
    .should('not.disabled')
    .click();

  toastNotification('"Glossary Term" deleted successfully!');
  cy.get('[data-testid="delete-confirmation-modal"]').should('not.exist');
  cy.get('[data-testid="glossary-left-panel"]')
    .should('be.visible')
    .should('not.contain', name);
};

const goToAssetsTab = (
  name: string,
  fqn: string,
  fetchPermission?: boolean
) => {
  visitGlossaryTermPage(name, fqn, fetchPermission);

  cy.get('[data-testid="assets"]').should('be.visible').click();
  cy.get('.ant-tabs-tab-active').contains('Assets').should('be.visible');
};

const updateSynonyms = (uSynonyms) => {
  cy.get('[data-testid="synonyms-container"]')
    .scrollIntoView()
    .should('be.visible');
  cy.get('[data-testid="synonyms-container"]')
    .find('[data-testid="edit-button"]', { timeout: 10000 })
    .scrollIntoView()
    .should('be.visible')
    .click();
  cy.get('[data-testid="synonyms-container"] .ant-select-selector')
    .should('be.visible')
    .find('.ant-select-selection-item-remove')
    .should('exist')
    .click({ force: true, multiple: true });
  cy.get('.ant-select-selection-overflow')
    .should('exist')
    .type(uSynonyms.join('{enter}'))
    .type('{enter}');
  cy.get('[data-testid="save-synonym-btn"]').scrollIntoView().click();
  verifyResponseStatusCode('@saveGlossaryTermData', 200);
  cy.get('[data-testid="synonyms-container"]')
    .as('synonyms-container')
    .should('be.visible');
  uSynonyms.forEach((synonym) => {
    cy.get('@synonyms-container').contains(synonym).should('be.visible');
  });
};

const updateTerms = (newTerm: string) => {
  interceptURL(
    'GET',
    '/api/v1/search/query?q=*&index=glossary_term_search_index*',
    'getGlossaryTerm'
  );
  cy.get('[data-testid="related-term-container"]')
    .scrollIntoView()
    .should('be.visible');
  cy.get('[data-testid="related-term-add-button"]')
    .scrollIntoView()
    .should('be.visible')
    .click({ force: true });
  cy.get('.ant-select-selection-overflow')
    .should('be.visible')
    .click()
    .type(newTerm);
  verifyResponseStatusCode('@getGlossaryTerm', 200, { requestTimeout: 10000 });
  cy.get('.ant-select-dropdown').filter(':visible').contains(newTerm).click();
  cy.get('[data-testid="saveAssociatedTag"]').click();
  verifyResponseStatusCode('@saveGlossaryTermData', 200, {
    requestTimeout: 10000,
  });

  cy.get('[data-testid="related-term-container"]')
    .contains(newTerm)
    .should('be.visible');
};

const updateReferences = (newRef: { name: string; url: string }) => {
  cy.get('[data-testid="section-References"]')
    .find('[data-testid="edit-button"]')
    .scrollIntoView()
    .click();
  cy.get('[data-testid="add-references-button"]').should('be.visible').click();
  cy.get('#references_1_name').should('be.visible').type(newRef.name);
  cy.get('#references_1_endpoint').should('be.visible').type(newRef.url);
  cy.get('[data-testid="save-btn"]').scrollIntoView().click();
  verifyResponseStatusCode('@saveGlossaryTermData', 200);
  cy.get('[data-testid="references-container"]')
    .contains(newRef.name)
    .should('be.visible')
    .invoke('attr', 'href')
    .should('eq', newRef.url);
};

const updateDescription = (newDescription, isGlossary) => {
  if (isGlossary) {
    interceptURL('PATCH', '/api/v1/glossaries/*', 'saveGlossary');
  } else {
    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveData');
  }

  cy.get('[data-testid="edit-description"]').scrollIntoView().click();
  cy.get('.ant-modal-wrap').should('be.visible');
  cy.get(descriptionBox).should('be.visible').as('description');
  cy.get('@description').clear();
  cy.get('@description').type(newDescription);
  cy.get('[data-testid="save"]').scrollIntoView().click();
  if (isGlossary) {
    verifyResponseStatusCode('@saveGlossary', 200);
  } else {
    verifyResponseStatusCode('@saveData', 200);
  }
  cy.get('.ant-modal-wrap').should('not.exist');

  cy.get('[data-testid="viewer-container"]')
    .contains(newDescription)
    .should('be.visible');
};

const upVoting = (api: string) => {
  cy.get('[data-testid="up-vote-btn"]').click();

  cy.wait(api).then(({ request, response }) => {
    expect(request.body.updatedVoteType).to.equal('votedUp');

    expect(response.statusCode).to.equal(200);
  });

  cy.get('[data-testid="up-vote-count"]').contains(1);
};

const downVoting = (api: string) => {
  cy.get('[data-testid="down-vote-btn"]').click();

  cy.wait(api).then(({ request, response }) => {
    expect(request.body.updatedVoteType).to.equal('votedDown');
    expect(response.statusCode).to.equal(200);
  });

  cy.get('[data-testid="down-vote-count"]').contains(1);

  // after voting down, the selected up-voting will cancel and count goes down
  cy.get('[data-testid="up-vote-count"]').contains(0);
};

// goes to initial stage after down voting glossary or glossary term
const initialVoting = (api: string) => {
  cy.get('[data-testid="down-vote-btn"]').click();

  cy.wait(api).then(({ request, response }) => {
    expect(request.body.updatedVoteType).to.equal('unVoted');
    expect(response.statusCode).to.equal(200);
  });

  cy.get('[data-testid="up-vote-count"]').contains(0);
  cy.get('[data-testid="down-vote-count"]').contains(0);
};

const voteGlossary = (isGlossary?: boolean) => {
  if (isGlossary) {
    interceptURL('PUT', '/api/v1/glossaries/*/vote', 'voteGlossary');
  } else {
    interceptURL('PUT', '/api/v1/glossaryTerms/*/vote', 'voteGlossaryTerm');
  }
  upVoting(isGlossary ? '@voteGlossary' : '@voteGlossaryTerm');
  downVoting(isGlossary ? '@voteGlossary' : '@voteGlossaryTerm');
  initialVoting(isGlossary ? '@voteGlossary' : '@voteGlossaryTerm');
};

const goToGlossaryPage = () => {
  interceptURL('GET', '/api/v1/glossaryTerms*', 'getGlossaryTerms');
  interceptURL('GET', '/api/v1/glossaries?fields=*', 'fetchGlossaries');
  cy.sidebarClick(SidebarItem.GLOSSARY);
};

const approveGlossaryTermWorkflow = ({ glossary, glossaryTerm }) => {
  goToGlossaryPage();

  selectActiveGlossary(glossary.name);

  const { name, fullyQualifiedName } = glossaryTerm;

  visitGlossaryTermPage(name, fullyQualifiedName);

  cy.get('[data-testid="activity_feed"]').click();

  interceptURL('GET', '/api/v1/feed*', 'activityFeed');

  cy.get('[data-testid="global-setting-left-panel"]').contains('Tasks').click();

  verifyResponseStatusCode('@activityFeed', 200);

  interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'resolveTask');

  cy.get('[data-testid="approve-task"]').click();

  verifyResponseStatusCode('@resolveTask', 200);

  // Verify toast notification
  toastNotification('Task resolved successfully');

  verifyResponseStatusCode('@activityFeed', 200);

  goToGlossaryPage();
  selectActiveGlossary(glossary.name);

  cy.get(`[data-testid="${fullyQualifiedName}-status"]`)
    .should('be.visible')
    .contains('Approved');
};

const addGlossaryTermsInEntityField = ({
  entityTerm,
  entityField,
  glossaryTerms,
}) => {
  const glossaryContainer = `[data-row-key$="${entityTerm}.${entityField}"] [data-testid="glossary-container"]`;

  cy.get(`${glossaryContainer} [data-testid="entity-tags"] .ant-tag`)
    .scrollIntoView()
    .click();

  const tagSelector = `${glossaryContainer} [data-testid="tag-selector"]`;
  cy.get(tagSelector).click();

  glossaryTerms.forEach((term) => {
    cy.get(`${tagSelector} .ant-select-selection-search input`).type(term.name);

    cy.get(
      `.ant-select-dropdown [data-testid='tag-${term.fullyQualifiedName}']`
    ).click();
    cy.get(`[data-testid="selected-tag-${term.fullyQualifiedName}"]`).should(
      'exist'
    );
  });

  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
};

const checkTagsSortingAndHighlighting = ({ termFQN }) => {
  cy.get('[data-testid="tags-viewer"] [data-testid="tags"]')
    .first()
    .as('firstTag');

  cy.get('@firstTag').within(() => {
    cy.get(`[data-testid="tag-${termFQN}"]`).should('exist');
  });
  cy.get('@firstTag').should('have.class', 'tag-highlight');
};

const checkSummaryListItemSorting = ({ termFQN, columnName }) => {
  cy.get('#right-panelV1 [data-testid="summary-list"]')
    .as('summaryList')
    .scrollIntoView();

  cy.get('@summaryList').within(() => {
    cy.get('[data-testid="summary-list-item"]')
      .first()
      .within(() => {
        cy.get('[data-testid="entity-title"]')
          .first() // checking for first entity title as collapse type will have more then 1 entity-title present
          .should('have.text', columnName);

        checkTagsSortingAndHighlighting({ termFQN });
      });
  });
};

const deleteUser = () => {
  cy.getAllLocalStorage().then((storageData) => {
    const token = getToken(storageData);

    cy.request({
      method: 'DELETE',
      url: `/api/v1/users/${createdUserId}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });

    cy.request({
      method: 'DELETE',
      url: `/api/v1/users/${createdUserId_2}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
};

const verifyStatusFilterInExplore = (statusField: string) => {
  const fieldName = Cypress._.toLower(statusField);
  const glossaryTermStatusFilter = GLOSSARY_DROPDOWN_ITEMS.find(
    (item) => item.key === 'status'
  );

  cy.sidebarClick(SidebarItem.EXPLORE);
  cy.get(`[data-testid="glossary terms-tab"]`).scrollIntoView().click();
  cy.get(`[data-testid="search-dropdown-${glossaryTermStatusFilter.label}"]`)
    .scrollIntoView()
    .click();
  cy.get(`[data-testid=${fieldName}]`)
    .should('exist')
    .and('be.visible')
    .click();

  const querySearchURL = `/api/v1/search/query?*index=glossary_term_search_index*query_filter=*should*${glossaryTermStatusFilter.key}*${fieldName}*`;

  interceptURL('GET', querySearchURL, 'querySearchAPI');
  cy.get('[data-testid="update-btn"]').click();
  verifyResponseStatusCode('@querySearchAPI', 200);
};

describe('Glossary page should work properly', { tags: 'Governance' }, () => {
  before(() => {
    // Prerequisites - Create a user with data consumer role
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);
      // Create a new user
      cy.request({
        method: 'POST',
        url: `/api/v1/users/signup`,
        headers: { Authorization: `Bearer ${token}` },
        body: CREDENTIALS,
      }).then((response) => {
        createdUserId = response.body.id;

        // Assign user to the team
        cy.sidebarClick(SidebarItem.SETTINGS);
        // Clicking on teams
        cy.settingClick(GlobalSettingOptions.TEAMS);
        const appName = 'Applications';

        interceptURL('GET', `/api/v1/teams/**`, 'getTeams');
        interceptURL(
          'GET',
          `/api/v1/users?fields=teams%2Croles&limit=25&team=${appName}`,
          'teamUsers'
        );

        cy.get('[data-testid="search-bar-container"]').type(appName);
        cy.get(`[data-row-key="${appName}"]`).contains(appName).click();
        verifyResponseStatusCode('@getTeams', 200);
        verifyResponseStatusCode('@teamUsers', 200);

        interceptURL('GET', '/api/v1/users?*isBot=false*', 'getUsers');
        cy.get('[data-testid="add-new-user"]').click();
        verifyResponseStatusCode('@getUsers', 200);
        interceptURL(
          'GET',
          `api/v1/search/query?q=*&index=user_search_index*`,
          'searchOwner'
        );
        cy.get(
          '[data-testid="selectable-list"] [data-testid="search-bar-container"]'
        ).type(userName);
        verifyResponseStatusCode('@searchOwner', 200);
        interceptURL('PATCH', `/api/v1/**`, 'patchOwner');
        cy.get(`.ant-popover [title="${userName}"]`).click();
        cy.get('[data-testid="selectable-list-update-btn"]').click();
        verifyResponseStatusCode('@patchOwner', 200);
      });

      // Create a new user_2
      cy.request({
        method: 'POST',
        url: `/api/v1/users/signup`,
        headers: { Authorization: `Bearer ${token}` },
        body: CREDENTIALS_2,
      }).then((response) => {
        createdUserId_2 = response.body.id;
      });
    });
  });

  after(() => {
    cy.login();
    deleteUser();
  });

  beforeEach(() => {
    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveGlossaryTermData');
    cy.login();
    goToGlossaryPage();
  });

  it('Create new glossary flow should work properly', () => {
    createGlossary(GLOSSARY_1, true);
    createGlossary(GLOSSARY_2, false);
    createGlossary(GLOSSARY_3, false);
    verifyGlossaryDetails(GLOSSARY_1);
    verifyGlossaryDetails(GLOSSARY_2);
    verifyGlossaryDetails(GLOSSARY_3);
  });

  it('Glossary Owner Flow', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_1.name)
      .click();

    checkDisplayName(GLOSSARY_1.name);
    addOwner(userName, GLOSSARY_OWNER_LINK_TEST_ID);
    cy.reload();
    addOwner('Alex Pollard', GLOSSARY_OWNER_LINK_TEST_ID);
    cy.reload();
    removeOwner('Alex Pollard', GLOSSARY_OWNER_LINK_TEST_ID);
  });

  it('Create glossary term should work properly', () => {
    createGlossaryTerms(GLOSSARY_1);
    createGlossaryTerms(GLOSSARY_2);
    createGlossaryTerms(GLOSSARY_3);

    verifyStatusFilterInExplore('Approved');
    verifyStatusFilterInExplore('Draft');
  });

  it('Updating data of glossary should work properly', () => {
    selectActiveGlossary(GLOSSARY_1.name);

    // Updating owner
    addOwner(userName2, GLOSSARY_OWNER_LINK_TEST_ID);

    // Updating Reviewer
    const reviewers = GLOSSARY_1.reviewers.map((reviewer) => reviewer.name);
    addOwnerInGlossary(
      [...reviewers, userName],
      'edit-reviewer-button',
      'glossary-reviewer-name',
      false
    );

    // updating tags
    removeTags(GLOSSARY_1.tag, EntityType.Glossary);
    assignTags('PII.None', EntityType.Glossary);

    // updating description
    updateDescription('Updated description', true);

    voteGlossary(true);
  });

  it('Team Approval Workflow for Glossary Term', () => {
    cy.logout();
    cy.login(CREDENTIALS.email, CREDENTIALS.password);
    approveGlossaryTermWorkflow({
      glossary: GLOSSARY_2,
      glossaryTerm: GLOSSARY_2.terms[0],
    });
    approveGlossaryTermWorkflow({
      glossary: GLOSSARY_2,
      glossaryTerm: GLOSSARY_2.terms[1],
    });
    cy.logout();
    Cypress.session.clearAllSavedSessions();
    cy.login();
  });

  it('Update glossary term', () => {
    const uSynonyms = ['pick up', 'take', 'obtain'];
    const newRef = { name: 'take', url: 'https://take.com' };
    const term2 = GLOSSARY_3.terms[1].name;
    const { name, fullyQualifiedName } = GLOSSARY_1.terms[0];
    const { name: newTermName, fullyQualifiedName: newTermFqn } =
      GLOSSARY_1.terms[1];

    // visit glossary page
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms?directChildrenOf=*`,
      'glossaryTerm'
    );
    interceptURL('GET', `/api/v1/permissions/glossary/*`, 'permissions');

    cy.get('.ant-menu-item').contains(GLOSSARY_1.name).click();
    verifyMultipleResponseStatusCode(['@glossaryTerm', '@permissions'], 200);

    // visit glossary term page
    visitGlossaryTermPage(name, fullyQualifiedName);

    // Updating synonyms
    updateSynonyms(uSynonyms);

    // Updating References
    updateReferences(newRef);

    // Updating Related terms
    updateTerms(term2);

    // updating tags
    // Some weired issue on terms, Term alread has an tag which causing failure
    // Will fix this later
    // updateTags(true);

    // updating description
    updateDescription('Updated description', false);

    // Updating Reviewer
    addOwnerInGlossary(
      [userName],
      'edit-reviewer-button',
      'glossary-reviewer-name',
      false
    );

    // updating voting for glossary term
    voteGlossary();

    goToGlossaryPage();
    cy.get('.ant-menu-item').contains(GLOSSARY_1.name).click();
    visitGlossaryTermPage(newTermName, newTermFqn);

    // Updating Reviewer
    addOwnerInGlossary(
      [userName],
      'edit-reviewer-button',
      'glossary-reviewer-name',
      false
    );
  });

  it('User Approval Workflow for Glossary Term', () => {
    cy.logout();
    cy.login(CREDENTIALS.email, CREDENTIALS.password);
    approveGlossaryTermWorkflow({
      glossary: GLOSSARY_1,
      glossaryTerm: GLOSSARY_1.terms[0],
    });

    approveGlossaryTermWorkflow({
      glossary: GLOSSARY_1,
      glossaryTerm: GLOSSARY_1.terms[1],
    });

    approveGlossaryTermWorkflow({
      glossary: GLOSSARY_1,
      glossaryTerm: GLOSSARY_1.terms[2],
    });
    cy.logout();
    Cypress.session.clearAllSavedSessions();
    cy.login();
  });

  it('Request Tags workflow for Glossary', function () {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_1.name)
      .click();

    interceptURL(
      'GET',
      `/api/v1/search/query?q=*%20AND%20disabled:false&index=tag_search_index*`,
      'suggestTag'
    );
    interceptURL('POST', '/api/v1/feed', 'taskCreated');
    interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'taskResolve');

    cy.get('[data-testid="request-entity-tags"]').should('exist').click();

    // check assignees for task which will be reviewer of the glossary term
    cy.get(
      '[data-testid="select-assignee"] > .ant-select-selector > .ant-select-selection-overflow'
    ).within(() => {
      for (const reviewer of [...GLOSSARY_1.reviewers, { name: userName }]) {
        cy.contains(reviewer.name);
      }
    });

    cy.get(
      '[data-testid="select-assignee"] > .ant-select-selector > .ant-select-selection-overflow'
    ).should('not.contain', userName2);

    cy.get('[data-testid="tag-selector"]')
      .click()
      .type('{backspace}')
      .type('{backspace}')
      .type('Personal');

    verifyResponseStatusCode('@suggestTag', 200);
    cy.get(
      '.ant-select-dropdown [data-testid="tag-PersonalData.Personal"]'
    ).click();
    cy.clickOutside();

    cy.get('[data-testid="submit-tag-request"]').click();
    verifyResponseStatusCode('@taskCreated', 201);

    // Owner should not be able to accept the tag suggestion when reviewer is assigned
    cy.logout();
    cy.login(CREDENTIALS_2.email, CREDENTIALS_2.password);

    goToGlossaryPage();

    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_1.name)
      .click();

    cy.get('[data-testid="activity_feed"]').click();

    cy.get('[data-testid="global-setting-left-panel"]')
      .contains('Tasks')
      .click();

    // accept the tag suggestion button should not be present
    cy.get('[data-testid="task-cta-buttons"]').should(
      'not.contain',
      'Accept Suggestion'
    );

    // Reviewer only should accepts the tag suggestion
    cy.logout();
    cy.login(CREDENTIALS.email, CREDENTIALS.password);

    goToGlossaryPage();

    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_1.name)
      .click();

    cy.get('[data-testid="activity_feed"]').click();

    cy.get('[data-testid="global-setting-left-panel"]')
      .contains('Tasks')
      .click();

    // Accept the tag suggestion which is created
    cy.get('.ant-btn-compact-first-item').contains('Accept Suggestion').click();

    verifyResponseStatusCode('@taskResolve', 200);

    cy.reload();

    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_1.name)
      .click();

    checkDisplayName(GLOSSARY_1.name);

    cy.logout();
    Cypress.session.clearAllSavedSessions();
    cy.login();
  });

  it('Request Tags workflow for Glossary and reviewer as Team', function () {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_2.name)
      .click();

    interceptURL(
      'GET',
      `/api/v1/search/query?q=*%20AND%20disabled:false&index=tag_search_index*`,
      'suggestTag'
    );
    interceptURL('POST', '/api/v1/feed', 'taskCreated');
    interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'taskResolve');

    cy.get('[data-testid="request-entity-tags"]').should('exist').click();

    // check assignees for task which will be Owner of the glossary term which is Team
    cy.get(
      '[data-testid="select-assignee"] > .ant-select-selector > .ant-select-selection-overflow'
    ).within(() => {
      for (const reviewer of GLOSSARY_2.reviewers) {
        cy.contains(reviewer.name);
      }
    });

    cy.get(
      '[data-testid="select-assignee"] > .ant-select-selector > .ant-select-selection-overflow'
    ).should('not.contain', GLOSSARY_2.owner);

    cy.get('[data-testid="tag-selector"]')
      .click()
      .type('{backspace}')
      .type('{backspace}')
      .type('Personal');

    verifyResponseStatusCode('@suggestTag', 200);
    cy.get(
      '.ant-select-dropdown [data-testid="tag-PersonalData.Personal"]'
    ).click();
    cy.clickOutside();

    cy.get('[data-testid="submit-tag-request"]').click();
    verifyResponseStatusCode('@taskCreated', 201);

    // Reviewer should accepts the tag suggestion which belongs to the Team
    cy.logout();
    cy.login(CREDENTIALS.email, CREDENTIALS.password);

    goToGlossaryPage();

    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_2.name)
      .click();

    cy.get('[data-testid="activity_feed"]').click();

    cy.get('[data-testid="global-setting-left-panel"]')
      .contains('Tasks')
      .click();

    // Accept the tag suggestion which is created
    cy.get('.ant-btn-compact-first-item').contains('Accept Suggestion').click();

    verifyResponseStatusCode('@taskResolve', 200);

    cy.reload();

    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_2.name)
      .click();

    checkDisplayName(GLOSSARY_2.name);

    cy.logout();
    Cypress.session.clearAllSavedSessions();
    cy.login();
  });

  it('Request Description workflow for Glossary', function () {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_3.name)
      .click();

    interceptURL(
      'GET',
      `/api/v1/search/query?q=*%20AND%20disabled:false&index=tag_search_index*`,
      'suggestTag'
    );
    interceptURL('POST', '/api/v1/feed', 'taskCreated');
    interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'taskResolve');

    cy.get('[data-testid="request-description"]').should('exist').click();

    // check assignees for task which will be owner of the glossary since it has no reviewer
    cy.get(
      '[data-testid="select-assignee"] > .ant-select-selector > .ant-select-selection-overflow'
    ).should('contain', GLOSSARY_3.owner);

    cy.get(descriptionBox).should('be.visible').as('description');
    cy.get('@description').clear();
    cy.get('@description').type(GLOSSARY_3.newDescription);

    cy.get('[data-testid="submit-btn"]').click();
    verifyResponseStatusCode('@taskCreated', 201);

    // Accept the tag suggestion which is created
    cy.get('.ant-btn-compact-first-item').contains('Accept Suggestion').click();

    verifyResponseStatusCode('@taskResolve', 200);

    cy.reload();

    cy.get('[data-testid="glossary-left-panel"]')
      .contains(GLOSSARY_3.name)
      .click();

    checkDisplayName(GLOSSARY_3.name);
  });

  it('Assets Tab should work properly', () => {
    const glossary1 = GLOSSARY_1.name;
    const term1 = GLOSSARY_1.terms[0];
    const term2 = GLOSSARY_1.terms[1];

    const glossary2 = GLOSSARY_2.name;
    const term3 = GLOSSARY_2.terms[0];
    const term4 = GLOSSARY_2.terms[1];

    const entity = SEARCH_ENTITY_TABLE.table_3;

    selectActiveGlossary(glossary2);

    goToAssetsTab(term3.name, term3.fullyQualifiedName, true);
    cy.contains('Adding a new Asset is easy, just give it a spin!').should(
      'be.visible'
    );
    visitEntityDetailsPage({
      term: entity.term,
      serviceName: entity.serviceName,
      entity: entity.entity,
    });

    const parentPath =
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"]';

    // Add glossary tag to entity for mutually exclusive
    cy.get(parentPath).then((glossaryContainer) => {
      // Check if the "Add Tag" button is visible
      if (!glossaryContainer.find('[data-testid="add-tag"]').is(':visible')) {
        // If "Add Tag" is not visible, click on "Edit Tag"
        cy.get(
          '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="edit-button"]'
        )
          .scrollIntoView()
          .click();
        cy.get('[data-testid="remove-tags"]')
          .should('be.visible')
          .click({ multiple: true });

        interceptURL('PATCH', '/api/v1/tables/*', 'removeTags');
        cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
        verifyResponseStatusCode('@removeTags', 200);
      }
    });

    cy.get(`${parentPath} [data-testid="add-tag"]`).click();

    // Select 1st term
    cy.get('[data-testid="tag-selector"] #tagsForm_tags')
      .click()
      .type(term1.name);
    cy.get(`[data-testid="tag-${glossary1}.${term1.name}"]`).click();
    cy.get('[data-testid="tag-selector"]').should('contain', term1.name);
    // Select 2nd term
    cy.get('[data-testid="tag-selector"] #tagsForm_tags')
      .click()
      .type(term2.name);
    cy.get(`[data-testid="tag-${glossary1}.${term2.name}"]`).click();
    cy.get('[data-testid="tag-selector"]').should('contain', term2.name);

    interceptURL('GET', '/api/v1/tags', 'tags');
    interceptURL('PATCH', '/api/v1/tables/*', 'saveTag');

    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView();
    cy.clickOutside();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@saveTag', 400);
    toastNotification(
      `Tag labels ${glossary1}.${term2.name} and ${glossary1}.${term1.name} are mutually exclusive and can't be assigned together`
    );

    // Add non mutually exclusive tags
    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"] > [data-testid="entity-tags"] [data-testid="add-tag"]'
    ).click();

    // Select 1st term
    cy.get('[data-testid="tag-selector"] #tagsForm_tags')
      .click()
      .type(term3.name);

    cy.get(`[data-testid="tag-${glossary2}.${term3.name}"]`).click();
    cy.get('[data-testid="tag-selector"]').should('contain', term3.name);
    // Select 2nd term
    cy.get('[data-testid="tag-selector"] #tagsForm_tags')
      .click()
      .type(term4.name);
    cy.get(`[data-testid="tag-${glossary2}.${term4.name}"]`).click();
    cy.clickOutside();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@saveTag', 200);
    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .should('contain', term3.name)
      .should('contain', term4.name);

    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="icon"]'
    ).should('have.length', 2);

    // Add tag to schema table
    const firstColumn =
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"] > [data-testid="entity-tags"] [data-testid="add-tag"]';
    cy.get(firstColumn).scrollIntoView();
    cy.get(firstColumn).click();

    cy.get('[data-testid="tag-selector"]').click().type(term3.name);
    cy.get(
      `.ant-select-dropdown [data-testid="tag-${glossary2}.${term3.name}"]`
    ).click();

    cy.get('[data-testid="tag-selector"] > .ant-select-selector').contains(
      term3.name
    );
    cy.clickOutside();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    cy.get(
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .should('contain', term3.name);
    cy.get(
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"] [data-testid="icon"]'
    ).should('be.visible');

    goToGlossaryPage();

    cy.get('.ant-menu-item').contains(glossary2).click();

    goToAssetsTab(term3.name, term3.fullyQualifiedName, false);

    cy.get('[data-testid="entity-header-display-name"]')
      .contains(entity.term)
      .should('be.visible');
  });

  it('Add asset to glossary term using asset modal', () => {
    const term = GLOSSARY_3.terms[0];
    addAssetToGlossaryTerm(term, GLOSSARY_3);
  });

  it('Remove asset from glossary term using asset modal', () => {
    const term = GLOSSARY_3.terms[0];
    removeAssetsFromGlossaryTerm(term, GLOSSARY_3);
  });

  it('Remove Glossary term from entity should work properly', () => {
    const glossaryName = GLOSSARY_2.name;
    const { name, fullyQualifiedName } = GLOSSARY_2.terms[0];
    const entity = SEARCH_ENTITY_TABLE.table_3;

    selectActiveGlossary(glossaryName);

    interceptURL('GET', '/api/v1/search/query*', 'assetTab');
    // go assets tab
    goToAssetsTab(name, fullyQualifiedName);
    verifyResponseStatusCode('@assetTab', 200);

    interceptURL('GET', '/api/v1/feed*', 'entityDetails');

    cy.get('[data-testid="entity-header-display-name"]')
      .contains(entity.term)
      .click();
    verifyResponseStatusCode('@entityDetails', 200);

    // Remove all added tags
    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="edit-button"]'
    )
      .scrollIntoView()
      .click();
    cy.get('[data-testid="remove-tags"]')
      .should('be.visible')
      .click({ multiple: true });

    interceptURL('PATCH', '/api/v1/tables/*', 'removeTags');
    cy.clickOutside();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@removeTags', 200);

    // Remove the added column tag from entity
    interceptURL('PATCH', '/api/v1/tables/*', 'removeSchemaTags');

    cy.get(
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .trigger('mouseover')
      .find('[data-testid="edit-button"]')
      .scrollIntoView()
      .click();

    cy.get(
      `[data-testid="selected-tag-${glossaryName}.${name}"] [data-testid="remove-tags"`
    ).click();

    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@removeSchemaTags', 200);

    cy.get(
      '[data-testid="glossary-tags-0"] > [data-testid="tags-wrapper"] > [data-testid="glossary-container"]'
    )
      .scrollIntoView()
      .should('not.contain', name)
      .and('not.contain', 'Personal');

    goToGlossaryPage();

    selectActiveGlossary(glossaryName);

    goToAssetsTab(name, fullyQualifiedName);
    cy.contains('Adding a new Asset is easy, just give it a spin!').should(
      'be.visible'
    );
  });

  it('Tags and entity summary columns should be sorted based on current Term Page', () => {
    const terms = GLOSSARY_3.terms;
    const entityTable = SEARCH_ENTITY_TABLE.table_1;

    visitEntityDetailsPage({
      term: entityTable.term,
      serviceName: entityTable.serviceName,
      entity: entityTable.entity,
    });

    addGlossaryTermsInEntityField({
      entityTerm: entityTable.term,
      entityField: COLUMN_NAME_FOR_APPLY_GLOSSARY_TERM,
      glossaryTerms: terms,
    });

    goToGlossaryPage();
    selectActiveGlossary(GLOSSARY_3.name);
    goToAssetsTab(terms[0].name, terms[0].fullyQualifiedName, true);

    checkSummaryListItemSorting({
      columnName: COLUMN_NAME_FOR_APPLY_GLOSSARY_TERM,
      termFQN: terms[0].fullyQualifiedName,
    });
  });

  it('Change glossary term hierarchy using menu options', () => {
    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveGlossaryTermData');
    interceptURL(
      'GET',
      '/api/v1/glossaryTerms/name/*',
      'fetchGlossaryTermData'
    );

    const parentTerm = GLOSSARY_3.terms[0];
    const childTerm = GLOSSARY_3.terms[1];
    selectActiveGlossary(GLOSSARY_3.name);
    cy.get('[data-testid="expand-collapse-all-button"]').click();
    visitGlossaryTermPage(childTerm.name, childTerm.fullyQualifiedName, true);

    cy.get('[data-testid="manage-button"]').click();
    cy.get('[data-testid="change-parent-button"]').should('be.visible').click();
    cy.get(
      '[data-testid="change-parent-select"] > .ant-select-selector'
    ).click();
    cy.get(`[title="${parentTerm.name}"]`).click();

    // Submit the select parent
    cy.get('.ant-modal-footer > .ant-btn-primary').click();

    verifyResponseStatusCode('@saveGlossaryTermData', 200);
    verifyResponseStatusCode('@fetchGlossaryTermData', 200);

    // Todo: Need to fix this @Ashish8689
    // cy.get('[data-testid="assets"] [data-testid="filter-count"]')
    //   .should('be.visible')
    //   .contains('3');

    // checking the breadcrumb, if the change parent term is updated and displayed
    cy.get('[data-testid="breadcrumb-link"]')
      .should('be.visible')
      .contains(`${parentTerm.name}`)
      .click();

    verifyResponseStatusCode('@fetchGlossaryTermData', 200);

    // checking the child term is updated and displayed under the parent term
    cy.get('[data-testid="terms"] [data-testid="filter-count"]')
      .should('be.visible')
      .contains('1')
      .click();

    cy.get(`[data-testid="${childTerm.name}"]`).should('be.visible');

    goToGlossaryPage();

    const newTermHierarchy = `${Cypress.$.escapeSelector(GLOSSARY_3.name)}.${
      parentTerm.name
    }.${childTerm.name}`;
    selectActiveGlossary(GLOSSARY_3.name);
    cy.get('[data-testid="expand-collapse-all-button"]').click();
    // verify the term is moved under the parent term
    cy.get(`[data-row-key='${newTermHierarchy}']`).should('be.visible');

    // re-dropping the term to the root level
    dragAndDropElement(
      `${GLOSSARY_3.name}.${parentTerm.name}.${childTerm.name}`,
      '.ant-table-thead > tr',
      true
    );

    confirmationDragAndDropGlossary(childTerm.name, GLOSSARY_3.name, true);
  });

  it('Drag and Drop should work properly for glossary term', () => {
    const { fullyQualifiedName: term1Fqn, name: term1Name } =
      GLOSSARY_1.terms[0];
    const { fullyQualifiedName: term2Fqn, name: term2Name } =
      GLOSSARY_1.terms[1];

    selectActiveGlossary(GLOSSARY_1.name);
    dragAndDropElement(term2Fqn, term1Fqn);

    confirmationDragAndDropGlossary(term2Name, term1Name);

    // clicking on the expand icon to view the child term
    cy.get(
      `[data-row-key=${Cypress.$.escapeSelector(
        term1Fqn
      )}] [data-testid="expand-icon"] > svg`
    ).click();

    cy.get(
      `.ant-table-row-level-1[data-row-key="${Cypress.$.escapeSelector(
        term1Fqn
      )}.${term2Name}"]`
    ).should('be.visible');
  });

  it('Drag and Drop should work properly for glossary term at table level', () => {
    selectActiveGlossary(GLOSSARY_1.name);
    cy.get('[data-testid="expand-collapse-all-button"]').click();
    dragAndDropElement(
      `${GLOSSARY_1.terms[0].fullyQualifiedName}.${GLOSSARY_1.terms[1].name}`,
      '.ant-table-thead > tr',
      true
    );

    confirmationDragAndDropGlossary(
      GLOSSARY_1.terms[1].name,
      GLOSSARY_1.name,
      true
    );

    // verify the term is moved under the parent term
    cy.get('[data-testid="expand-collapse-all-button"]').click();
    cy.get(
      `.ant-table-row-level-0[data-row-key="${Cypress.$.escapeSelector(
        GLOSSARY_1.terms[1].fullyQualifiedName
      )}"]`
    ).should('be.visible');
  });

  it('Delete glossary term should work properly', () => {
    selectActiveGlossary(GLOSSARY_2.name);
    GLOSSARY_2.terms.forEach(deleteGlossaryTerm);
  });

  it('Delete glossary should work properly', () => {
    verifyResponseStatusCode('@fetchGlossaries', 200);
    [GLOSSARY_1.name, GLOSSARY_2.name, GLOSSARY_3.name].forEach((glossary) => {
      deleteGlossary(glossary);
    });
  });
});
