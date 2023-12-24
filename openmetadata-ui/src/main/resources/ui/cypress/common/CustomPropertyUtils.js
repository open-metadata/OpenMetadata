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

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';

export const createCustomAttribute = ({
  name,
  description,
  serviceType,
  token,
}) => {
  let entityTypeId;
  let integerTypeId;

  // Fetch the service type metadata object to get the id
  cy.request({
    method: 'GET',
    url: `/api/v1/metadata/types/name/${serviceType}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    expect(response.status).to.eq(200);

    entityTypeId = response.body.id;

    // Fetch the types of custom attributes that can be created to get the id for the propertyType
    cy.request({
      method: 'GET',
      url: `/api/v1/metadata/types?category=field&limit=12`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);

      integerTypeId = response.body.data.find(
        (type) => type.name === 'integer'
      ).id;

      // Create a custom attribute
      cy.request({
        method: 'PUT',
        url: `/api/v1/metadata/types/${entityTypeId}`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          name,
          propertyType: {
            id: integerTypeId,
            type: 'type',
          },
          description: description ?? 'testProperty description.',
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  return entityTypeId;
};

export const deleteCustomAttribute = ({ name, serviceType, token }) => {
  cy.request({
    method: 'GET',
    url: `/api/v1/metadata/types/name/${serviceType}?fields=customProperties`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    expect(response.status).to.eq(200);

    const customPropertyId = response.body.id;

    const oldCustomPropertyData = response.body;
    const newCustomPropertyData = {
      ...response.body,
      customProperties: response.body.customProperties.filter(
        (property) => property.name !== name
      ),
    };

    const patchData = compare(
      omitBy(oldCustomPropertyData, isUndefined),
      newCustomPropertyData
    );

    cy.request({
      method: 'PATCH',
      url: `/api/v1/metadata/types/${customPropertyId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body: patchData,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
};
