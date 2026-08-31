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

import { fireEvent, render, screen } from '@testing-library/react';
import { Glossary } from '../../generated/entity/data/glossary';
import OntologyImportExportMenu from './OntologyImportExportMenu';

jest.mock('./OntologyImportExportModal', () => ({
  __esModule: true,
  default: () => <div data-testid="ontology-import-export-modal-stub" />,
}));

const glossaries = [{ id: 'g1', name: 'FIBO' }] as Glossary[];

describe('OntologyImportExportMenu', () => {
  it('opens the import/export modal from the header trigger', () => {
    render(
      <OntologyImportExportMenu
        isAdminUser
        glossaries={glossaries}
        relationCount="7"
        termCount="20"
      />
    );

    expect(
      screen.queryByTestId('ontology-import-export-modal-stub')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-import-export-trigger'));

    expect(
      screen.getByTestId('ontology-import-export-modal-stub')
    ).toBeInTheDocument();
  });
});
