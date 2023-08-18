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

import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { BASE_URL } from '../../constants/constants';

describe('Logout User', () => {
  beforeEach(() => {
    cy.login();
  });

  it('After login logout the user and invalidate the token', () => {
    interceptURL('POST', '/api/v1/users/logout', 'logoutUser');
    cy.get('[data-testid="appbar-item-logout"]').click();

    cy.get('[data-testid="confirm-logout"]').click();

    // verify the logout request
    verifyResponseStatusCode('@logoutUser', 200);

    cy.url().should('eq', `${BASE_URL}/signin`);
  });
});
