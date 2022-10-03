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


Cypress.Commands.add('getSearchQueryName', (entityName) => {
    cy.getLocalStorage("oidcIdToken").then((token) => {
        cy.request({
            method: 'GET',
            url: `/api/v1/search/query?q=*&from=0&size=10&sort_field=updatedAt&sort_order=desc&index=${entityName}_search_index`,
            headers: {
                Authorization: `Bearer ${token}`
            }

        }).then((response) => {
            if (response && response.body && response.body.hits) {
                const entitySource = response.body.hits.hits[0]._source;
                const name = entitySource.name || entitySource.displayName;

                return name;
            }
        })
    });
});