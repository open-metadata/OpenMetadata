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
import { MemoryRouter } from 'react-router-dom';
import { SubNavConfig } from './navConfig';
import SubPanel from './SubPanel';

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));

const renderPanel = (config: SubNavConfig, badges?: Record<string, number>) =>
  render(
    <MemoryRouter>
      <SubPanel badges={badges} config={config} onCollapse={jest.fn()} />
    </MemoryRouter>
  );

const configWith = (item: SubNavConfig['sections'][number]['items'][number]) =>
  ({
    key: 'governance',
    titleKey: 'label.governance',
    rootPath: '/governance',
    sections: [{ items: [item] }],
  } as SubNavConfig);

describe('SubPanel item badges', () => {
  it('renders a text badge and adds it to the accessible name', () => {
    renderPanel(
      configWith({
        key: 'bulk',
        labelKey: 'label.column-bulk-operations',
        path: '/governance/bulk',
        badgeKey: 'label.deprecated',
        badgeCount: 3,
      })
    );

    const item = screen.getByTestId('ask-sub-panel-item-bulk');

    expect(item).toHaveTextContent('label.deprecated');
    expect(item).not.toHaveTextContent('3');
    expect(item).toHaveAttribute(
      'aria-label',
      'label.column-bulk-operations (label.deprecated)'
    );
  });

  it('renders a live count, including 0, when there is no text badge', () => {
    renderPanel(
      configWith({
        key: 'approvals',
        labelKey: 'label.approval-plural',
        path: '/governance/approvals',
      }),
      { approvals: 0 }
    );

    const item = screen.getByTestId('ask-sub-panel-item-approvals');

    expect(item).toHaveTextContent('0');
    expect(item).toHaveAttribute('aria-label', 'label.approval-plural');
  });

  it('renders no badge when there is neither a key nor a count', () => {
    renderPanel(
      configWith({
        key: 'tags',
        labelKey: 'label.classification',
        path: '/governance/tags',
      })
    );

    expect(screen.getByTestId('ask-sub-panel-item-tags')).toHaveTextContent(
      /^label\.classification$/
    );
  });
});
