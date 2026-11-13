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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import OntologyPublicationModal from './OntologyPublicationModal';

const mockReleasePanel = jest.fn();
jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

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
  it('passes the Studio task callback to the release panel', () => {
    const onOpenTask = jest.fn();
    render(
      <OntologyPublicationModal
        canEdit
        ontology={ontology}
        onClose={jest.fn()}
        onOpenTask={onOpenTask}
      />
    );

    expect(mockReleasePanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ onOpenTask })
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it('dismisses with Escape', () => {
    const onClose = jest.fn();
    render(
      <OntologyPublicationModal canEdit ontology={ontology} onClose={onClose} />
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('shows the version step and the release count the panel reports in AI mode', () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    render(
      <OntologyPublicationModal
        canEdit
        ontology={ontology}
        onClose={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('ontology-publication-version-step')
    ).not.toBeInTheDocument();

    const { onSummaryChange } = mockReleasePanel.mock.lastCall[0];
    act(() =>
      onSummaryChange({
        toVersion: 'v0.1.0',
        releaseCount: 3,
        hasMoreReleases: true,
      })
    );

    expect(
      screen.getByTestId('ontology-publication-version-step')
    ).toHaveTextContent('label.draft→v0.1.0');
    expect(
      screen.getByTestId('ontology-publication-tab-releases')
    ).toHaveTextContent('label.release-plural (3+)');
  });
});
