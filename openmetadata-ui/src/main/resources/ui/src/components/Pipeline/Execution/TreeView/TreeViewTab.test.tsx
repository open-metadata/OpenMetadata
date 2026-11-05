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

import { render, screen } from '@testing-library/react';
import { getTreeData } from '../../../../utils/executionUtils';
import TreeViewTab from './TreeViewTab.component';

jest.mock('../../../../utils/executionUtils', () => ({
  ...jest.requireActual('../../../../utils/executionUtils'),
  getTreeViewData: jest.fn().mockReturnValue({ A: [{ name: 'A', key: 1 }] }),
  getTreeData: jest.fn(),
}));

const treeNode = { key: 'root-A', title: 'A' };

const renderTab = () =>
  render(
    <TreeViewTab
      endTime={1}
      executions={[]}
      startTime={0}
      status="all"
      tasks={[{ name: 'A' }]}
    />
  );

describe('TreeViewTab', () => {
  it('warns that the tree was cut off when getTreeData reports truncation', () => {
    (getTreeData as jest.Mock).mockReturnValue({
      treeDataList: [treeNode],
      treeLabelList: [treeNode],
      isTruncated: true,
    });

    renderTab();

    expect(screen.getByTestId('tree-view-truncated-warning')).toHaveTextContent(
      'message.pipeline-tree-view-truncated'
    );
  });

  it('shows no warning for a complete tree', () => {
    (getTreeData as jest.Mock).mockReturnValue({
      treeDataList: [treeNode],
      treeLabelList: [treeNode],
      isTruncated: false,
    });

    renderTab();

    expect(
      screen.queryByTestId('tree-view-truncated-warning')
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
  });
});
