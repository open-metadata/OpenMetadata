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

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Glossary } from '../../generated/entity/data/glossary';
import { Ontology } from '../../generated/entity/data/ontology';
import {
  Access,
  Operation,
} from '../../generated/entity/policies/accessControl/resourcePermission';
import { getEntityPermissionById } from '../../rest/permissionAPI';
import { renderWithQueryClient as render } from '../../test/unit/test-utils';
import OntologyImportExportMenu from './OntologyImportExportMenu';

jest.mock('../../rest/permissionAPI');

jest.mock('./OntologyImportExportModal', () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="ontology-import-export-modal-stub">
      <button onClick={onClose}>Close glossary export</button>
    </div>
  ),
}));

jest.mock(
  '../governance/ontology/OntologyReleaseExportModal/OntologyReleaseExportModal',
  () => ({
    __esModule: true,
    default: ({
      ontology: owner,
      canImport,
      onClose,
    }: {
      ontology: Ontology;
      canImport: boolean;
      onClose: () => void;
    }) => (
      <div data-testid="ontology-release-export-modal-stub" role="dialog">
        <span>{owner.name}</span>
        <button disabled={!canImport}>Import</button>
        <button onClick={onClose}>Close export</button>
      </div>
    ),
  })
);

const glossaries = [{ id: 'g1', name: 'FIBO' }] as Glossary[];
const ontology = {
  fullyQualifiedName: 'Sales',
  id: 'ontology-id',
  iri: 'urn:sales',
  name: 'Sales',
  namespace: 'urn:sales:',
} satisfies Ontology;

describe('OntologyImportExportMenu', () => {
  it('opens the import/export modal from the header trigger', () => {
    render(
      <OntologyImportExportMenu
        isAdminUser
        glossaries={glossaries}
        kind="glossary"
        relationCount="7"
        termCount="20"
      />
    );

    expect(
      screen.queryByTestId('ontology-import-export-modal-stub')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'label.import-export' })
    );

    expect(
      screen.getByTestId('ontology-import-export-modal-stub')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close glossary export' })
    );

    expect(
      screen.queryByTestId('ontology-import-export-modal-stub')
    ).not.toBeInTheDocument();
  });

  it('opens the active-release export modal for a native ontology', () => {
    render(
      <OntologyImportExportMenu
        canImport
        kind="ontology"
        ontology={ontology}
        onApplied={jest.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'label.import-export' })
    );

    expect(
      screen.getByTestId('ontology-release-export-modal-stub')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-import-export-modal-stub')
    ).not.toBeInTheDocument();
  });

  it.each([Access.Allow, Access.Deny])(
    'requires a full-scope target and checks its %s import permission independently',
    async (access) => {
      const permission = getEntityPermissionById as jest.MockedFunction<
        typeof getEntityPermissionById
      >;
      permission.mockClear();
      permission.mockResolvedValue({
        resource: 'ontology',
        permissions: [{ operation: Operation.EditAll, access }],
      });
      const owners = Array.from({ length: 25 }, (_, i) => ({
        ...ontology,
        id: 'owner-' + i,
        name: 'Owner ' + i,
      }));
      render(
        <OntologyImportExportMenu
          kind="allOntologies"
          ontologies={owners}
          onApplied={jest.fn()}
        />
      );
      fireEvent.click(screen.getByTestId('ontology-import-export-trigger'));

      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(permission).not.toHaveBeenCalled();

      fireEvent.click(
        screen.getByRole('button', { name: /label.select-entity/ })
      );
      fireEvent.click(await screen.findByRole('option', { name: 'Owner 24' }));
      await waitFor(() =>
        expect(permission).toHaveBeenCalledWith('ontology', 'owner-24')
      );

      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(
        screen.getByTestId('ontology-release-export-modal-stub')
      ).toHaveTextContent('Owner 24');

      await waitFor(() =>
        expect(
          screen
            .getByRole('button', { name: 'Import' })
            .hasAttribute('disabled')
        ).toBe(access !== Access.Allow)
      );
      fireEvent.click(screen.getByRole('button', { name: 'Close export' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('ontology-import-export-trigger'));

      expect(screen.getByTestId('ontology-import-target-picker')).toBeVisible();
    }
  );
});
