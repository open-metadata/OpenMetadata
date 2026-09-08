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
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { useDomainTableColumns } from './useDomainTableColumns';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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

describe('useDomainTableColumns', () => {
  it('routes a name-cell click to onEntityClick with the row entity', () => {
    const onEntityClick = jest.fn();

    const { result } = renderHook(() =>
      useDomainTableColumns({ onEntityClick })
    );

    render(<>{result.current.renderCell(DOMAIN, 'name')}</>);
    fireEvent.click(screen.getByText('Engineering'));

    expect(onEntityClick).toHaveBeenCalledTimes(1);
    expect(onEntityClick).toHaveBeenCalledWith(DOMAIN);
  });

  it('renders the name cell without a click handler when onEntityClick is omitted', () => {
    const rowClick = jest.fn();

    const { result } = renderHook(() => useDomainTableColumns());

    render(
      <div role="presentation" onClick={rowClick}>
        {result.current.renderCell(DOMAIN, 'name')}
      </div>
    );
    fireEvent.click(screen.getByText('Engineering'));

    expect(rowClick).toHaveBeenCalledTimes(1);
  });
});
