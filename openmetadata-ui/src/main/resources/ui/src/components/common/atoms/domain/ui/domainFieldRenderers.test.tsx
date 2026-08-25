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
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { renderDomainNameCell } from './domainFieldRenderers';

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: () => <span data-testid="avatar" />,
  Box: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <div data-testid="name-cell" role="presentation" onClick={onClick}>
      {children}
    </div>
  ),
  Typography: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('../../../../../utils/TooltipUtils', () => ({
  renderBreakableTooltip: (value: string) => value,
}));

const DOMAIN = {
  id: 'domain-id',
  name: 'engineering',
  displayName: 'Engineering',
  fullyQualifiedName: 'engineering',
} as Domain;

describe('renderDomainNameCell', () => {
  it('navigates once when the name cell is clicked', () => {
    const onClick = jest.fn();

    render(<>{renderDomainNameCell(DOMAIN, onClick)}</>);
    fireEvent.click(screen.getByText('Engineering'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stops the click from bubbling to the row so navigation is not duplicated', () => {
    const onClick = jest.fn();
    const rowClick = jest.fn();

    render(
      <div role="presentation" onClick={rowClick}>
        {renderDomainNameCell(DOMAIN, onClick)}
      </div>
    );
    fireEvent.click(screen.getByText('Engineering'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(rowClick).not.toHaveBeenCalled();
  });

  it('does not attach a click handler when no onClick is provided', () => {
    const rowClick = jest.fn();

    render(
      <div role="presentation" onClick={rowClick}>
        {renderDomainNameCell(DOMAIN)}
      </div>
    );
    fireEvent.click(screen.getByText('Engineering'));

    // With no cell handler the click falls through to the row unchanged.
    expect(rowClick).toHaveBeenCalledTimes(1);
  });
});
