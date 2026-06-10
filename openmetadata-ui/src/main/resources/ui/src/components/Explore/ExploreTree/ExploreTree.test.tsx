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
import { fireEvent, render, waitFor } from '@testing-library/react';
import ExploreTree from './ExploreTree';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
}));

describe('ExploreTree', () => {
  it('renders the correct tree nodes', async () => {
    const { getByText, queryByTestId } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} onTreeSelect={jest.fn()} />
    );

    // Wait for loader to disappear
    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(getByText('label.database-plural')).toBeInTheDocument();
    expect(getByText('label.dashboard-plural')).toBeInTheDocument();
    expect(getByText('label.topic-plural')).toBeInTheDocument();
    expect(getByText('label.container-plural')).toBeInTheDocument();
    expect(getByText('label.pipeline-plural')).toBeInTheDocument();
    expect(getByText('label.search-index-plural')).toBeInTheDocument();
    expect(getByText('label.ml-model-plural')).toBeInTheDocument();
    expect(getByText('label.governance')).toBeInTheDocument();
  });

  it('grays out categories that cannot contain the selected asset type', async () => {
    const { getByText, queryByTestId } = render(
      <ExploreTree
        selectedEntityTypes={['table']}
        onFieldValueSelect={jest.fn()}
        onTreeSelect={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    const databaseNode = getByText('label.database-plural').closest(
      '.ant-tree-treenode'
    );
    const dashboardNode = getByText('label.dashboard-plural').closest(
      '.ant-tree-treenode'
    );

    expect(databaseNode).not.toHaveClass('ant-tree-treenode-disabled');
    expect(dashboardNode).toHaveClass('ant-tree-treenode-disabled');
  });

  it('reports a category-root click as a browse selection, not a quick filter', async () => {
    const onTreeSelect = jest.fn();
    const onFieldValueSelect = jest.fn();
    const { getByText, queryByTestId } = render(
      <ExploreTree
        onFieldValueSelect={onFieldValueSelect}
        onTreeSelect={onTreeSelect}
      />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    fireEvent.click(getByText('label.database-plural'));

    expect(onFieldValueSelect).not.toHaveBeenCalled();
    expect(onTreeSelect).toHaveBeenCalledTimes(1);

    const { browseFields, typeField } = onTreeSelect.mock.calls[0][0];

    expect(typeField).toBeUndefined();
    expect(browseFields).toHaveLength(1);
    expect(browseFields[0].key).toBe('entityType');
    expect(browseFields[0].label).toBe('label.database-plural');
    expect(browseFields[0].value.map((v: { key: string }) => v.key)).toContain(
      'table'
    );
  });

  it('keeps static governance leaves on the quick-filter path', async () => {
    const onTreeSelect = jest.fn();
    const onFieldValueSelect = jest.fn();
    const { getByText, queryByTestId } = render(
      <ExploreTree
        onFieldValueSelect={onFieldValueSelect}
        onTreeSelect={onTreeSelect}
      />
    );

    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    const governanceSwitcher = getByText('label.governance')
      .closest('.ant-tree-treenode')
      ?.querySelector('.ant-tree-switcher');
    fireEvent.click(governanceSwitcher as Element);

    fireEvent.click(getByText('label.glossary-plural'));

    expect(onTreeSelect).not.toHaveBeenCalled();
    expect(onFieldValueSelect).toHaveBeenCalledTimes(1);

    const fields = onFieldValueSelect.mock.calls[0][0];

    expect(fields).toHaveLength(1);
    expect(fields[0].key).toBe('entityType');
    expect(fields[0].value[0].key).toBe('glossaryTerm');
  });
});
