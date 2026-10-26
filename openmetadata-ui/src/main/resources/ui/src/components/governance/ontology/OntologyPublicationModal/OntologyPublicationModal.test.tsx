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
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import OntologyPublicationModal from './OntologyPublicationModal';

const mockReleasePanel = jest.fn();
jest.mock('../../../../hooks/useEntityPermissions/useEntityPermissions');

jest.mock('../OntologyReleasePanel/OntologyReleasePanel', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockReleasePanel(props);

    return (
      <div data-testid="ontology-release-panel">
        <input aria-label="draft notes" />
      </div>
    );
  },
}));

const ontology: Ontology = {
  fullyQualifiedName: 'RetailCommerce',
  id: 'ontology-retail',
  iri: 'urn:retail',
  name: 'RetailCommerce',
  namespace: 'urn:retail:',
};

describe('OntologyPublicationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const permissions = {
      ...DEFAULT_ENTITY_PERMISSION,
      EditAll: true,
      ViewBasic: true,
    };
    (useEntityPermissions as jest.Mock).mockReturnValue({
      permissions,
      ...getDerivedPermissionFlags(permissions, false),
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
  });

  it('opens the named Releases tab from a history entry point', () => {
    render(
      <OntologyPublicationModal
        canEdit
        initialTab="releases"
        ontology={ontology}
        onClose={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('ontology-publication-tab-releases')
    ).toHaveAttribute('aria-selected', 'true');
    expect(mockReleasePanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'releases' })
    );
  });

  it('discards the previous owner editor when choosing a different ontology and dismisses with Escape', () => {
    const other = { ...ontology, id: 'other-owner', name: 'Other owner' };
    const onClose = jest.fn();
    render(
      <OntologyPublicationModal
        canEdit
        initialOntology={ontology}
        ontologies={[ontology, other]}
        onClose={onClose}
      />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'draft notes' }), {
      target: { value: 'First owner notes' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'label.change-ontology' })
    );
    fireEvent.click(
      screen.getByTestId('ontology-publication-select-' + other.id)
    );

    expect(screen.getByRole('textbox', { name: 'draft notes' })).toHaveValue(
      ''
    );
    expect(mockReleasePanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ ontology: other })
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit native owner before showing release contents', () => {
    const onSelectOntology = jest.fn();
    render(
      <OntologyPublicationModal
        canEdit={false}
        ontologies={[ontology]}
        onClose={jest.fn()}
        onSelectOntology={onSelectOntology}
      />
    );

    expect(screen.getByTestId('ontology-publication-picker')).toBeVisible();
    expect(mockReleasePanel).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByTestId('ontology-publication-select-' + ontology.id)
    );

    expect(onSelectOntology).not.toHaveBeenCalled();
    expect(screen.getByTestId('ontology-release-panel')).toBeVisible();
    expect(mockReleasePanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ ontology, canEdit: true })
    );
  });

  it('opens on Changes and switches the same release workflow to Releases', () => {
    const onClose = jest.fn();
    render(
      <OntologyPublicationModal canEdit ontology={ontology} onClose={onClose} />
    );

    expect(screen.getByTestId('ontology-publication-modal')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'label.review-publish' })
    ).toBeVisible();
    expect(mockReleasePanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'changes' })
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'draft notes' }), {
      target: { value: 'Keep these notes' },
    });
    fireEvent.click(screen.getByTestId('ontology-publication-tab-releases'));

    expect(mockReleasePanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'releases' })
    );

    fireEvent.click(screen.getByTestId('ontology-publication-tab-changes'));

    expect(screen.getByRole('textbox', { name: 'draft notes' })).toHaveValue(
      'Keep these notes'
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.close' }));

    expect(onClose).toHaveBeenCalled();
  });
});
