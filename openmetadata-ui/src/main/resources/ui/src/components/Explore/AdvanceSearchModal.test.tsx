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
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdvancedSearchModal } from './AdvanceSearchModal.component';
import { SearchOutputType } from './AdvanceSearchProvider/AdvanceSearchProvider.interface';

// setupTests.js globally stubs `getQbConfigs` to `{}`; this suite renders a
// real builder and needs the real config.
jest.mock('../../utils/AdvancedSearchClassBase', () =>
  jest.requireActual('../../utils/AdvancedSearchClassBase')
);

jest.mock('../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));
jest.mock('../../utils/RouterUtils', () => ({
  getExplorePath: jest.fn(() => '/explore?'),
}));

const mockOnTreeUpdate = jest.fn();
const mockOnReset = jest.fn();

const buildConfig = () =>
  jest
    .requireActual('../../utils/queryBuilder/config')
    .buildQueryBuilderConfig({
      outputType: SearchOutputType.ElasticSearch,
      searchIndex: 'table',
      groupMode: 'nested',
    });

const advanceSearchContext: Record<string, unknown> = {
  config: buildConfig(),
  treeInternal: undefined,
  onTreeUpdate: mockOnTreeUpdate,
  onReset: mockOnReset,
  modalProps: undefined,
};

jest.mock('./AdvanceSearchProvider/AdvanceSearchProvider.component', () => ({
  useAdvanceSearch: jest.fn(() => advanceSearchContext),
}));

const renderModal = () =>
  render(
    <AdvancedSearchModal visible onCancel={jest.fn()} onSubmit={jest.fn()} />
  );

describe('AdvancedSearchModal', () => {
  beforeEach(() => {
    const config = buildConfig();
    advanceSearchContext.config = config;
    advanceSearchContext.treeInternal = QbUtils.checkTree(
      QbUtils.loadTree(
        jest.requireActual('../../utils/queryBuilder/tree').getEmptyJsonTree()
      ),
      config
    );
  });

  it('should render the modal chrome the specs drive', () => {
    renderModal();

    expect(screen.getByTestId('advanced-search-modal')).toBeInTheDocument();
    expect(screen.getByTestId('reset-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
    expect(screen.getByTestId('apply-btn')).toBeInTheDocument();
  });

  describe('advanced search features must not regress', () => {
    it('should offer nested groups', () => {
      renderModal();

      expect(
        screen.getAllByTestId('advanced-search-add-group').length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByTestId('advanced-search-add-rule').length
      ).toBeGreaterThan(0);
    });

    it('should offer an editable AND/OR conjunction', async () => {
      renderModal();

      fireEvent.click(screen.getAllByTestId('advanced-search-add-rule')[0]);

      await waitFor(() =>
        expect(
          screen.getAllByTestId('advanced-search-conjunction-or').length
        ).toBeGreaterThan(0)
      );

      expect(
        screen.getAllByTestId('advanced-search-conjunction-and').length
      ).toBeGreaterThan(0);
    });

    it('should render field and operator selects', () => {
      renderModal();

      expect(
        screen.getAllByTestId('advanced-search-field-select').length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByTestId('advanced-search-operator-select').length
      ).toBeGreaterThan(0);
    });

    it('should show the column labels Explore has always shown', () => {
      renderModal();

      // `showLabels` is derived from nested mode rather than the old
      // `isExplorePage` boolean; this is what proves the derivation is right.
      expect(advanceSearchContext.config).toBeDefined();
      expect(
        (advanceSearchContext.config as { settings: { showLabels: boolean } })
          .settings.showLabels
      ).toBe(true);
    });

    it('should leave the provider owning the tree, handing it an ImmutableTree', async () => {
      renderModal();

      fireEvent.click(screen.getAllByTestId('advanced-search-add-rule')[0]);

      await waitFor(() => expect(mockOnTreeUpdate).toHaveBeenCalled());

      const [tree] = mockOnTreeUpdate.mock.calls.at(-1) ?? [];

      // The provider expects RAQB's immutable tree, not the plain JsonTree the
      // component emits — the modal converts between them.
      expect(typeof (tree as { toJS?: unknown })?.toJS).toBe('function');
    });

    it('should let the provider drive reset', () => {
      renderModal();

      fireEvent.click(screen.getByTestId('reset-btn'));

      expect(mockOnReset).toHaveBeenCalled();
    });
  });
});
