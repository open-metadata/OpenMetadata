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

import TopicClass from './base/TopicClass';

describe('Topic page', () => {
  const topic = new TopicClass();

  before(() => {
    cy.login();

    topic.setToken();
    topic.createEntity();
  });

  beforeEach(() => {
    cy.login();
    topic.visitEntity();
  });

  it('domain assignement for Table should work', () => {
    topic.assignDomain();
  });

  it('update domain for Table should work', () => {
    topic.updateDomain();
  });

  it('remove domain for Table should work', () => {
    topic.removeDomain();
  });

  it('owner assignement for Topic should work', () => {
    topic.assignOwner('Aaron Johnson', 'topics');
  });

  it('update owner for Table should work', () => {
    topic.updateOwner();
  });

  it('remove owner for Table should work', () => {
    topic.removeOwner();
  });

  it('owner as team assignement for Table should work', () => {
    topic.assignTeamOwner();
  });

  it('update owner as team for Table should work', () => {
    topic.updateTeamOwner();
  });

  it('remove owner as team for Table should work', () => {
    topic.removeTeamOwner();
  });

  it('tier assignement for Table should work', () => {
    topic.assignTier();
  });

  it('update tier for Table should work', () => {
    topic.updateTier();
  });

  it('remove tier for Table should work', () => {
    topic.removeTier();
  });

  it('update description for Table should work', () => {
    topic.updateDescription();
  });

  it('Tags assignement for Table should work', () => {
    topic.assignTags();
  });

  it('update Tags for Table should work', () => {
    topic.updateTags();
  });

  it('remove Tags for Table should work', () => {
    topic.removeTags();
  });

  it('GlossaryTerm assignemnet for Table should work', () => {
    topic.assignGlossary();
  });

  it('update GlossaryTerm for Table should work', () => {
    topic.updateGlossary();
  });

  it('remove GlossaryTerm for Table should work', () => {
    topic.removeGlossary();
  });

  it('update displayName for Table should work', () => {
    topic.renameEntity();
  });

  it('create annoucement for Table should work', () => {
    topic.createAnnouncement();
  });

  it('update annoucement for Table should work', () => {
    topic.updateAnnouncement();
  });

  it('remove annoucement for Table should work', () => {
    topic.removeAnnouncement();
  });

  it('create inactive annoucement for Table should work', () => {
    topic.createInactiveAnnouncement();
  });

  it('update inactive annoucement for Table should work', () => {
    topic.updateInactiveAnnouncement();
  });

  it('remove inactive annoucement for Table should work', () => {
    topic.removeInactiveAnnouncement();
  });

  it('soft delelte for table should work', () => {
    topic.softDeleteEntity();
  });

  it('hard delelte for table should work', () => {
    topic.hardDeleteEntity();
  });
});
