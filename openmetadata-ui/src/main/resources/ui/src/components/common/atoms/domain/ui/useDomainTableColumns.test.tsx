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
import domainClassBase from '../../../../../utils/Domain/DomainClassBase';
import {
  renderDomainClassificationTagsCell,
  renderDomainGlossaryTagsCell,
  renderDomainOwnersCell,
} from './domainFieldRenderers';
import { useDomainTableColumns } from './useDomainTableColumns';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./domainFieldRenderers', () => ({
  ...jest.requireActual('./domainFieldRenderers'),
  renderDomainOwnersCell: jest.fn(),
  renderDomainGlossaryTagsCell: jest.fn(),
  renderDomainClassificationTagsCell: jest.fn(),
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

  it('passes showDashPlaceholder through for the owners column', () => {
    const { result } = renderHook(() => useDomainTableColumns());

    result.current.renderCell(DOMAIN, 'owners');

    expect(renderDomainOwnersCell).toHaveBeenCalledWith(DOMAIN, {
      showDashPlaceholder: true,
    });
  });

  it('renders the glossaryTerms column via renderDomainGlossaryTagsCell', () => {
    const { result } = renderHook(() => useDomainTableColumns());

    result.current.renderCell(DOMAIN, 'glossaryTerms');

    expect(renderDomainGlossaryTagsCell).toHaveBeenCalledWith(DOMAIN);
  });

  it('renders the tags column via renderDomainClassificationTagsCell', () => {
    const { result } = renderHook(() => useDomainTableColumns());

    result.current.renderCell(DOMAIN, 'tags');

    expect(renderDomainClassificationTagsCell).toHaveBeenCalledWith(DOMAIN);
  });

  it('adds no column beyond the OSS set when the class base contributes none', () => {
    const { result } = renderHook(() => useDomainTableColumns());

    expect(result.current.columns.map((column) => column.id)).toEqual([
      'name',
      'owners',
      'glossaryTerms',
      'domainType',
      'tags',
    ]);
  });

  it('returns null for a column id nothing handles', () => {
    const { result } = renderHook(() => useDomainTableColumns());

    expect(result.current.renderCell(DOMAIN, 'entityStatus')).toBeNull();
  });

  // The seam a downstream build (Collate) uses to add a listing column without
  // this hook knowing about it.
  describe('with a class-base contributed column', () => {
    const EXTRA_COLUMNS = [
      {
        id: 'entityStatus',
        labelKey: 'label.status',
        render: (domain: Domain) => <span>{`status:${domain.name}`}</span>,
      },
    ];

    beforeEach(() => {
      jest
        .spyOn(domainClassBase, 'getListingExtraColumns')
        .mockReturnValue(EXTRA_COLUMNS);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('appends the contributed column after the OSS columns', () => {
      const { result } = renderHook(() => useDomainTableColumns());

      expect(result.current.columns.at(-1)).toEqual({
        id: 'entityStatus',
        label: 'label.status',
      });
    });

    it('renders the contributed column through its own renderer', () => {
      const { result } = renderHook(() => useDomainTableColumns());

      render(<>{result.current.renderCell(DOMAIN, 'entityStatus')}</>);

      expect(screen.getByText('status:engineering')).toBeInTheDocument();
    });
  });
});
