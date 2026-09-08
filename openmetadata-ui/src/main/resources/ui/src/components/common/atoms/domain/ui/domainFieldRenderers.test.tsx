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
import {
  renderDomainClassificationTagsCell,
  renderDomainGlossaryTagsCell,
  renderDomainNameCell,
  renderDomainOwnersCell,
} from './domainFieldRenderers';

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

jest.mock('../../../OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: (props: Record<string, unknown>) => (
    <div
      data-show-dash={String(props.showDashPlaceholder)}
      data-testid="owner-label"
    />
  ),
}));

jest.mock('../../../TagBadgeList/TagBadgeList.component', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div
      data-empty-placeholder={String(props.emptyPlaceholder)}
      data-testid="tag-badge-list"
    />
  ),
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

describe('renderDomainOwnersCell', () => {
  it('forwards showDashPlaceholder to OwnerLabel when passed', () => {
    render(
      <>
        {renderDomainOwnersCell({ owners: [] }, { showDashPlaceholder: true })}
      </>
    );

    expect(screen.getByTestId('owner-label')).toHaveAttribute(
      'data-show-dash',
      'true'
    );
  });

  it('leaves showDashPlaceholder unset when no options are passed', () => {
    render(<>{renderDomainOwnersCell({ owners: [] })}</>);

    expect(screen.getByTestId('owner-label')).toHaveAttribute(
      'data-show-dash',
      'undefined'
    );
  });
});

describe('renderDomainGlossaryTagsCell / renderDomainClassificationTagsCell', () => {
  it('forwards emptyPlaceholder to TagBadgeList when passed', () => {
    render(
      <>
        {renderDomainGlossaryTagsCell({ tags: [] }, { emptyPlaceholder: '--' })}
      </>
    );

    expect(screen.getByTestId('tag-badge-list')).toHaveAttribute(
      'data-empty-placeholder',
      '--'
    );
  });

  it('leaves emptyPlaceholder unset when no options are passed', () => {
    render(<>{renderDomainClassificationTagsCell({ tags: [] })}</>);

    expect(screen.getByTestId('tag-badge-list')).toHaveAttribute(
      'data-empty-placeholder',
      'undefined'
    );
  });
});
