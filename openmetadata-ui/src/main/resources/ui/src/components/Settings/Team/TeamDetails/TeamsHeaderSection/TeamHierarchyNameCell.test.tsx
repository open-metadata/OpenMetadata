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
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Team } from '../../../../../generated/entity/teams/team';
import {
  getEntityName,
  highlightSearchText,
} from '../../../../../utils/EntityUtils';
import { getTeamsWithFqnPath } from '../../../../../utils/RouterUtils';
import { stringToHTML } from '../../../../../utils/StringsUtils';
import { TeamHierarchyNameCell } from './TeamHierarchyNameCell';

jest.mock('antd', () => {
  const actual = jest.requireActual<typeof import('antd')>('antd');

  return {
    ...actual,
    Tooltip: ({
      children,
      title,
    }: {
      children: ReactNode;
      title?: ReactNode;
    }) => (
      <span
        data-testid="hierarchy-name-tooltip"
        data-tooltip-title={
          title === undefined || title === null ? '' : String(title)
        }>
        {children}
      </span>
    ),
  };
});

jest.mock('../../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(),
  highlightSearchText: jest.fn((text: string) => text),
}));

jest.mock('../../../../../utils/RouterUtils', () => ({
  getTeamsWithFqnPath: jest.fn(),
}));

jest.mock('../../../../../utils/StringsUtils', () => ({
  stringToHTML: jest.fn((html: string) => html),
}));

const mockGetEntityName = getEntityName as jest.MockedFunction<
  typeof getEntityName
>;
const mockHighlightSearchText = highlightSearchText as jest.MockedFunction<
  typeof highlightSearchText
>;
const mockGetTeamsWithFqnPath = getTeamsWithFqnPath as jest.MockedFunction<
  typeof getTeamsWithFqnPath
>;
const mockStringToHTML = stringToHTML as jest.MockedFunction<
  typeof stringToHTML
>;

const mockTeam = {
  fullyQualifiedName: 'Organization.Engineering',
  id: '49d060a2-ad14-48a7-840a-836cd99aaffb',
  name: 'Engineering',
} as Team;

const renderCell = (props: { record: Team; searchTerm?: string }) =>
  render(
    <MemoryRouter>
      <TeamHierarchyNameCell {...props} />
    </MemoryRouter>
  );

describe('TeamHierarchyNameCell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntityName.mockReturnValue('Engineering');
    mockGetTeamsWithFqnPath.mockReturnValue(
      '/settings/members/teams/Engineering'
    );
    jest
      .spyOn(HTMLAnchorElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(100);
    jest
      .spyOn(HTMLAnchorElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(100);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders team link with expected test id and route', () => {
    renderCell({ record: mockTeam });

    const link = screen.getByTestId('team-name-Engineering');

    expect(link).toHaveClass('teams-hierarchy-team-name-link');
    expect(link).toHaveAttribute('href', '/settings/members/teams/Engineering');
    expect(mockGetTeamsWithFqnPath).toHaveBeenCalledWith(
      'Organization.Engineering'
    );
  });

  it('uses team name when fullyQualifiedName is missing', () => {
    const teamWithoutFqn = {
      name: 'LocalTeam',
    } as Team;

    mockGetEntityName.mockReturnValue('LocalTeam');
    mockGetTeamsWithFqnPath.mockReturnValue('/teams/LocalTeam');

    renderCell({ record: teamWithoutFqn });

    expect(mockGetTeamsWithFqnPath).toHaveBeenCalledWith('LocalTeam');
    expect(screen.getByTestId('team-name-LocalTeam')).toBeInTheDocument();
  });

  it('passes display name and search term through highlight and stringToHTML', () => {
    mockHighlightSearchText.mockReturnValue('<mark>Eng</mark>ineering');

    renderCell({ record: mockTeam, searchTerm: 'Eng' });

    expect(mockHighlightSearchText).toHaveBeenCalledWith('Engineering', 'Eng');
    expect(mockStringToHTML).toHaveBeenCalledWith('<mark>Eng</mark>ineering');
  });

  it('does not wrap with Tooltip when text is not truncated', () => {
    jest
      .spyOn(HTMLAnchorElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(80);
    jest
      .spyOn(HTMLAnchorElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(100);

    renderCell({ record: mockTeam });

    expect(
      screen.queryByTestId('hierarchy-name-tooltip')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('team-name-Engineering')).toBeInTheDocument();
  });

  it('wraps link with Tooltip when text is truncated', () => {
    jest
      .spyOn(HTMLAnchorElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(400);
    jest
      .spyOn(HTMLAnchorElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(50);

    renderCell({ record: mockTeam });

    const tooltip = screen.getByTestId('hierarchy-name-tooltip');

    expect(tooltip).toHaveAttribute('data-tooltip-title', 'Engineering');
    expect(
      tooltip.querySelector('[data-testid="team-name-Engineering"]')
    ).toBeInTheDocument();
  });

  it('re-evaluates truncation when display name changes', () => {
    jest
      .spyOn(HTMLAnchorElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(400);
    jest
      .spyOn(HTMLAnchorElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(50);

    const { rerender } = render(
      <MemoryRouter>
        <TeamHierarchyNameCell record={mockTeam} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('hierarchy-name-tooltip')).toBeInTheDocument();

    mockGetEntityName.mockReturnValue('Short');
    jest
      .spyOn(HTMLAnchorElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(40);
    jest
      .spyOn(HTMLAnchorElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(100);

    rerender(
      <MemoryRouter>
        <TeamHierarchyNameCell record={mockTeam} />
      </MemoryRouter>
    );

    expect(
      screen.queryByTestId('hierarchy-name-tooltip')
    ).not.toBeInTheDocument();
  });
});
