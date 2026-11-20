/*
 *  Copyright 2026 Collate.
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

import { render, screen, within } from '@testing-library/react';
import RelationshipTypeForm from './RelationshipTypeForm';
import { DEFAULT_RELATIONSHIP_TYPE_FORM } from './RelationshipTypeForm.utils';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('RelationshipTypeForm', () => {
  it('marks name, display name and RDF predicate as required', () => {
    render(
      <RelationshipTypeForm
        errors={{}}
        isEditing={false}
        values={DEFAULT_RELATIONSHIP_TYPE_FORM}
        onChange={jest.fn()}
      />
    );

    ['name-input', 'display-name-input', 'rdf-predicate-input'].forEach(
      (testId) =>
        expect(
          within(screen.getByTestId(testId)).getByRole('textbox')
        ).toBeRequired()
    );

    expect(
      within(screen.getByTestId('inverse-relation-input')).getByRole('textbox')
    ).not.toBeRequired();
  });
});
