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

import { EXAMPLE_LONG_STRING } from '../../constants/constants';

export const validateFormNameFieldInput = ({
  fieldSelector = '#name',
  checkEmpty = true,
  checkLong = true,
  fieldName,
  errorDivSelector,
  value,
}: {
  value: string;
  fieldName: string;
  errorDivSelector: string;
  fieldSelector?: string;
  checkEmpty?: boolean;
  checkLong?: boolean;
}) => {
  if (checkEmpty) {
    // Check empty name field message
    cy.get(fieldSelector).type('test');
    cy.get(fieldSelector).clear();
    cy.get(`${errorDivSelector} .ant-form-item-explain-error`).contains(
      `${fieldName} is required`
    );
  }

  if (checkLong) {
    // Check long name field message
    cy.get(fieldSelector).type(EXAMPLE_LONG_STRING);
    cy.get(`${errorDivSelector} .ant-form-item-explain-error`).contains(
      `${fieldName} size must be between 1 and 128`
    );
    cy.get(fieldSelector).clear();
  }

  cy.get(fieldSelector).type(value);
};
