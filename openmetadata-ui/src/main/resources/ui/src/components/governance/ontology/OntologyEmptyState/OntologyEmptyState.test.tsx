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
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyEmptyState from './OntologyEmptyState';

const renderEmptyState = (canCreate = true) => {
  const handlers = {
    onCreateFromScratch: jest.fn(),
    onImportFile: jest.fn(),
    onInstallFromLibrary: jest.fn(),
  };
  renderWithQueryClient(
    <OntologyEmptyState canCreate={canCreate} {...handlers} />
  );

  return handlers;
};

describe('OntologyEmptyState', () => {
  it('names the empty catalog and explains what an ontology is', () => {
    renderEmptyState();

    expect(
      screen.getByRole('heading', { name: 'label.no-ontologies-yet' })
    ).toBeVisible();
    expect(
      screen.getByText('message.ontology-first-run-description')
    ).toBeVisible();
  });

  it('renders through the shared onboarding placeholder with brand icon tiles', () => {
    renderEmptyState();
    const emptyState = screen.getByTestId('ontology-empty-state');
    const iconTiles = Array.from(
      emptyState.querySelectorAll('[data-icon]'),
      (icon) => icon.parentElement?.className ?? ''
    );

    expect(within(emptyState).getByTestId('empty-placeholder')).toBeVisible();
    expect(iconTiles).toHaveLength(3);

    iconTiles.forEach((tile) => {
      expect(tile).toContain('tw:text-fg-brand-primary');
      expect(tile).not.toMatch(/gray|text-secondary|text-quaternary/);
    });
  });

  it.each([
    ['label.install-from-library', 'onInstallFromLibrary'],
    ['label.import-a-file', 'onImportFile'],
    ['label.create-from-scratch', 'onCreateFromScratch'],
  ] as const)('runs only its own handler for %s', (name, handler) => {
    const handlers = renderEmptyState();

    fireEvent.click(screen.getByRole('button', { name }));

    expect(handlers[handler]).toHaveBeenCalledTimes(1);
    expect(
      Object.values(handlers).filter((fn) => fn.mock.calls.length > 0)
    ).toHaveLength(1);
  });

  it('offers the three options in order with the library first', () => {
    renderEmptyState();

    expect(
      screen.getAllByRole('button').map((button) => button.textContent)
    ).toEqual([
      'label.install-from-library',
      'label.import-a-file',
      'label.create-from-scratch',
    ]);
  });

  it('disables every option without permission to create ontologies', () => {
    const handlers = renderEmptyState(false);

    screen.getAllByRole('button').forEach((button) => {
      expect(button).toBeDisabled();
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'label.create-from-scratch' })
    );

    expect(handlers.onCreateFromScratch).not.toHaveBeenCalled();
  });
});
