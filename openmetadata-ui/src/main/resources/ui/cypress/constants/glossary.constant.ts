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

import { uuid } from './constants';

export const GLOSSARY_OWNER_LINK_TEST_ID = 'glossary-right-panel-owner-link';

export const GLOSSARY_DETAILS1 = {
  name: `Cypress%QFTEST ${uuid()}`,
  displayName: `Cypress % QFTEST ${uuid()}`,
  description: 'Test Glossary',
  reviewers: [],
  tags: [],
  mutuallyExclusive: false,
};

export const GLOSSARY_TERM_DETAILS1 = {
  name: `CypressQFTEST_TERM-${uuid()}`,
  displayName: 'Cypress QFTEST_TERM',
  description: 'Quick filter test.',
  reviewers: [],
  relatedTerms: [],
  synonyms: [],
  mutuallyExclusive: false,
  tags: [],
  style: {},
  glossary: GLOSSARY_DETAILS1.name,
};
