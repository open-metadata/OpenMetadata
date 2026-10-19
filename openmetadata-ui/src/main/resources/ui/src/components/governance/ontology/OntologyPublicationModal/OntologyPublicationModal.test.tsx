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
import OntologyPublicationModal from './OntologyPublicationModal';

const mockReleasePanel = jest.fn();

jest.mock('../OntologyReleasePanel/OntologyReleasePanel', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockReleasePanel(props);

    return <div data-testid="ontology-release-panel" />;
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
  beforeEach(() => jest.clearAllMocks());

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

    fireEvent.click(screen.getByTestId('ontology-publication-tab-releases'));

    expect(mockReleasePanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'releases' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.close' }));

    expect(onClose).toHaveBeenCalled();
  });
});
