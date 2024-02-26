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
import { EntityType } from '../../constants/Entity.interface';
import { interceptURL, verifyResponseStatusCode } from '../common';

export const validateDomain = (domain: string, entityType: EntityType) => {
  interceptURL('GET', `/api/v1/${entityType}/*/versions/0.2`, 'getVersion');
  cy.get('[data-testid="version-button"]').should('contain', '0.2').click();
  verifyResponseStatusCode('@getVersion', 200);
};
