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

import TableClass from './base/TableClass';

describe('Table page', () => {
  const table = new TableClass();

  before(() => {
    cy.login();
    await table.setToken();
    table.createEntity();
  });

  beforeEach(() => {
    cy.login();
    table.visitEntity();
  });

  it('domain assignement for Table should work', () => {
    table.assignDomain();
  });

  it('update domain for Table should work', () => {
    table.updateDomain();
  });

  it('remove domain for Table should work', () => {
    table.removeDomain();
  });

  it('owner assignement for Table should work', () => {
    table.assignOwner('Aaron Johnson', 'tables');
  });

  it('update owner for Table should work', () => {
    table.updateOwner();
  });

  it('remove owner for Table should work', () => {
    table.removeOwner();
  });

  it('owner as team assignement for Table should work', () => {
    table.assignTeamOwner();
  });

  it('update owner as team for Table should work', () => {
    table.updateTeamOwner();
  });

  it('remove owner as team for Table should work', () => {
    table.removeTeamOwner();
  });

  it('tier assignement for Table should work', () => {
    table.assignTier();
  });

  it('update tier for Table should work', () => {
    table.updateTier();
  });

  it('remove tier for Table should work', () => {
    table.removeTier();
  });

  it('update description for Table should work', () => {
    table.updateDescription();
  });

  it('Tags assignement for Table should work', () => {
    table.assignTags();
  });

  it('update Tags for Table should work', () => {
    table.updateTags();
  });

  it('remove Tags for Table should work', () => {
    table.removeTags();
  });

  it('GlossaryTerm assignemnet for Table should work', () => {
    table.assignGlossary();
  });

  it('update GlossaryTerm for Table should work', () => {
    table.updateGlossary();
  });

  it('remove GlossaryTerm for Table should work', () => {
    table.removeGlossary();
  });

  it('update displayName for Table should work', () => {
    table.renameEntity();
  });

  it('create annoucement for Table should work', () => {
    table.createAnnouncement();
  });

  it('update annoucement for Table should work', () => {
    table.updateAnnouncement();
  });

  it('remove annoucement for Table should work', () => {
    table.removeAnnouncement();
  });

  it('create inactive annoucement for Table should work', () => {
    table.createInactiveAnnouncement();
  });

  it('update inactive annoucement for Table should work', () => {
    table.updateInactiveAnnouncement();
  });

  it('remove inactive annoucement for Table should work', () => {
    table.removeInactiveAnnouncement();
  });

  it('soft delelte for table should work', () => {
    table.softDeleteEntity();
  });

  it('hard delelte for table should work', () => {
    table.hardDeleteEntity();
  });
});
