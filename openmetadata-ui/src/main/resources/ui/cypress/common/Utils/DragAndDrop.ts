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

const dataTransfer = new DataTransfer();

export const dragAndDropElement = (
  dragElement: string,
  dropTarget: string,
  isHeader?: boolean
) => {
  cy.get(`[data-row-key="${Cypress.$.escapeSelector(dragElement)}"]`)
    .invoke('attr', 'draggable')
    .should('contain', 'true');

  cy.get(`[data-row-key="${Cypress.$.escapeSelector(dragElement)}"]`).trigger(
    'dragstart',
    {
      dataTransfer,
    }
  );

  cy.get(
    isHeader
      ? dropTarget
      : `[data-row-key="${Cypress.$.escapeSelector(dropTarget)}"]`
  )
    .trigger('drop', { dataTransfer })
    .trigger('dragend', { force: true });
};

export const openDragDropDropdown = (name: string) => {
  cy.get(
    `[data-row-key=${name}] > .whitespace-nowrap > [data-testid="expand-icon"] > svg`
  ).click();
};
