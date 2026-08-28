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
import EntityDetailHeader from './EntityDetailHeader.component';
import { EntityDetailTab } from './EntityDetailHeader.interface';

const tabs: EntityDetailTab[] = [
  { key: 'summary', label: 'Summary', panel: <div>Summary Panel</div> },
  {
    count: 4,
    key: 'insights',
    label: 'Insights',
    panel: <div>Insights Panel</div>,
  },
  { isHidden: true, key: 'hidden', label: 'Hidden', panel: <div>Hidden</div> },
];

describe('EntityDetailHeader', () => {
  it('renders title, breadcrumb and only the visible tabs', () => {
    render(
      <EntityDetailHeader
        breadcrumb={<nav data-testid="crumbs" />}
        tabs={tabs}
        title="Snowflake"
      />
    );

    expect(screen.getByText('Snowflake')).toBeInTheDocument();
    expect(screen.getByTestId('crumbs')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Summary/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Insights/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /Hidden/ })
    ).not.toBeInTheDocument();
  });

  it('owns the active tab and switches panels on selection (uncontrolled)', () => {
    render(
      <EntityDetailHeader defaultActiveKey="summary" tabs={tabs} title="S" />
    );

    expect(screen.getByText('Summary Panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Insights/ }));

    expect(screen.getByText('Insights Panel')).toBeInTheDocument();
  });

  it('selects the first visible tab once tabs load asynchronously (uncontrolled)', () => {
    const { rerender } = render(<EntityDetailHeader tabs={[]} title="S" />);

    expect(screen.queryByText('Summary Panel')).not.toBeInTheDocument();

    rerender(<EntityDetailHeader tabs={tabs} title="S" />);

    expect(screen.getByRole('tab', { name: /Summary/ })).toBeInTheDocument();
    expect(screen.getByText('Summary Panel')).toBeInTheDocument();
  });

  it('is controlled by activeKey: fires onTabChange without self-switching', () => {
    const onTabChange = jest.fn();
    render(
      <EntityDetailHeader
        activeKey="summary"
        tabs={tabs}
        title="S"
        onTabChange={onTabChange}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Insights/ }));

    expect(onTabChange).toHaveBeenCalledWith('insights');
    expect(screen.getByText('Summary Panel')).toBeInTheDocument();
    expect(screen.queryByText('Insights Panel')).not.toBeInTheDocument();
  });

  it('renders only the tab strip when renderPanels is false', () => {
    render(
      <EntityDetailHeader
        defaultActiveKey="summary"
        renderPanels={false}
        tabs={tabs}
        title="S"
      />
    );

    expect(screen.getByRole('tab', { name: /Summary/ })).toBeInTheDocument();
    expect(screen.queryByText('Summary Panel')).not.toBeInTheDocument();
  });

  it('renders the service logo when serviceLogoUrl is provided', () => {
    const { container } = render(
      <EntityDetailHeader
        serviceLogoUrl="https://logo.png"
        tabs={tabs}
        title="S"
      />
    );

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://logo.png'
    );
  });
});
