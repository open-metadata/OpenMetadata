/*
 *  Copyright 2025 Collate.
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
import { render } from '@testing-library/react';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import {
  getDomainChildrenPaginated,
  searchDomains,
} from '../../../rest/domainAPI';
import DomainSelect from './DomainSelect';
import { DomainSelectProps } from './DomainSelect.types';

const treeSelectMock = jest.fn();

jest.mock('@openmetadata/ui-core-components', () => ({
  TreeSelect: (props: Record<string, unknown>) => {
    treeSelectMock(props);

    return <div data-testid="tree-select-mock" />;
  },
  DomainTag: ({
    label,
    'data-testid': dataTestId,
  }: {
    label: string;
    'data-testid'?: string;
  }) => <span data-testid={dataTestId}>{label}</span>,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/domainAPI', () => ({
  getDomainChildrenPaginated: jest.fn(),
  searchDomains: jest.fn(),
}));

const mockGetChildren = getDomainChildrenPaginated as jest.Mock;
const mockSearch = searchDomains as jest.Mock;

const FINANCE = {
  id: 'd1',
  name: 'Finance',
  displayName: 'Finance',
  fullyQualifiedName: 'Finance',
  childrenCount: 0,
};

const financeRef: EntityReference = {
  id: 'd1',
  type: 'domain',
  name: 'Finance',
  displayName: 'Finance',
  fullyQualifiedName: 'Finance',
};

const pageOf = (size: number) =>
  Array.from({ length: size }, (_, index) => ({
    id: `s${index}`,
    name: `sub-${index}`,
    fullyQualifiedName: `Finance.sub-${index}`,
    childrenCount: 0,
  }));

const lastProps = () =>
  treeSelectMock.mock.calls[treeSelectMock.mock.calls.length - 1][0];

const renderSelect = (props: Partial<DomainSelectProps> = {}) => {
  const onUpdate = jest.fn();

  render(<DomainSelect onUpdate={onUpdate} {...props} />);

  return { onUpdate };
};

describe('DomainSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetChildren.mockResolvedValue({
      data: [FINANCE],
      paging: { total: 1 },
    });
    mockSearch.mockResolvedValue([FINANCE]);
  });

  it('should default commitMode to immediate for the input trigger', () => {
    renderSelect({ triggerVariant: 'input', multiple: true });

    expect(lastProps().commitMode).toBe('immediate');
  });

  it('should default commitMode to staged for a multi-select button trigger', () => {
    renderSelect({ triggerVariant: 'button', multiple: true });

    expect(lastProps().commitMode).toBe('staged');
  });

  it('should default commitMode to immediate for a single-select button trigger', () => {
    renderSelect({ triggerVariant: 'button', multiple: false });

    expect(lastProps().commitMode).toBe('immediate');
  });

  it('should honour an explicit commitMode', () => {
    renderSelect({ triggerVariant: 'input', commitMode: 'staged' });

    expect(lastProps().commitMode).toBe('staged');
  });

  it('should disable the selector when hasPermission is false', () => {
    renderSelect({ hasPermission: false });

    expect(lastProps().disabled).toBe(true);
  });

  it('should map the selected domain into the value nodes', () => {
    renderSelect({ selectedDomain: financeRef });

    expect(lastProps().value).toEqual([
      {
        id: 'Finance',
        value: 'Finance',
        label: 'Finance',
        data: financeRef,
      },
    ]);
  });

  it('should fetch root domains when no params are given', async () => {
    renderSelect();

    const { nodes } = await lastProps().fetchData({});

    expect(mockGetChildren).toHaveBeenCalledWith(
      undefined,
      PAGE_SIZE_LARGE,
      0,
      undefined,
      [TabSpecificField.CHILDREN_COUNT]
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('Finance');
    expect(nodes[0].data).toMatchObject({ id: 'd1', type: 'domain' });
  });

  it('should lazy-load subdomains for a parent id', async () => {
    renderSelect();

    await lastProps().fetchData({ parentId: 'Finance' });

    expect(mockGetChildren).toHaveBeenCalledWith(
      'Finance',
      PAGE_SIZE_LARGE,
      0,
      undefined,
      [TabSpecificField.CHILDREN_COUNT]
    );
  });

  it('should fetch a branch exactly once instead of draining the level', async () => {
    mockGetChildren.mockResolvedValue({
      data: pageOf(PAGE_SIZE_LARGE),
      paging: { total: 120 },
    });
    renderSelect();

    await lastProps().fetchData({
      parentId: 'Finance',
      pageSize: PAGE_SIZE_LARGE,
    });

    expect(mockGetChildren).toHaveBeenCalledTimes(1);
  });

  it('should report the cursor and total of a truncated branch', async () => {
    mockGetChildren.mockResolvedValue({
      data: pageOf(PAGE_SIZE_LARGE),
      paging: { total: 120 },
    });
    renderSelect();

    const response = await lastProps().fetchData({
      parentId: 'Finance',
      pageSize: PAGE_SIZE_LARGE,
    });

    expect(response).toMatchObject({
      hasMore: true,
      total: 120,
      nextCursor: '50',
    });
  });

  it('should close a branch out once the last page lands', async () => {
    mockGetChildren.mockResolvedValue({
      data: pageOf(20),
      paging: { total: 70 },
    });
    renderSelect();

    const response = await lastProps().fetchData({
      parentId: 'Finance',
      pageSize: PAGE_SIZE_LARGE,
      after: '50',
    });

    expect(response.hasMore).toBe(false);
    expect(response.nextCursor).toBeUndefined();
  });

  it('should resume from the server offset even when the allow-list pruned a page', async () => {
    // Only `sub-0` survives the allow-list, but the server still returned 50
    // rows — resuming from the surviving count would skip the other 49.
    mockGetChildren.mockResolvedValue({
      data: pageOf(PAGE_SIZE_LARGE),
      paging: { total: 120 },
    });
    renderSelect({
      restrictedDomains: [
        { id: 's0', type: 'domain', fullyQualifiedName: 'Finance.sub-0' },
      ],
    });

    const response = await lastProps().fetchData({
      parentId: 'Finance',
      pageSize: PAGE_SIZE_LARGE,
    });

    expect(response.nodes).toHaveLength(1);
    expect(response.nextCursor).toBe('50');

    await lastProps().fetchData({
      parentId: 'Finance',
      pageSize: PAGE_SIZE_LARGE,
      after: response.nextCursor,
    });

    expect(mockGetChildren).toHaveBeenLastCalledWith(
      'Finance',
      PAGE_SIZE_LARGE,
      50,
      undefined,
      [TabSpecificField.CHILDREN_COUNT]
    );
  });

  it('should withhold the total when a restriction prunes the page', async () => {
    mockGetChildren.mockResolvedValue({
      data: pageOf(PAGE_SIZE_LARGE),
      paging: { total: 120 },
    });
    renderSelect({ restrictedDomains: [financeRef] });

    const response = await lastProps().fetchData({
      parentId: 'Finance',
      pageSize: PAGE_SIZE_LARGE,
    });

    expect(response.hasMore).toBe(true);
    expect(response.total).toBeUndefined();
  });

  it('should let a failed page reject so the branch stays resumable', async () => {
    mockGetChildren.mockRejectedValue(new Error('boom'));
    renderSelect();

    await expect(
      lastProps().fetchData({ parentId: 'Finance' })
    ).rejects.toThrow('boom');
  });

  it('should search domains when a search term is given', async () => {
    renderSelect();

    const { nodes } = await lastProps().fetchData({ searchTerm: 'Fin' });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(nodes).toHaveLength(1);
  });

  it('should keep only the allowed (restricted) domains and their descendants', async () => {
    // restrictedDomains carries the domains a domain-restricted user may use.
    renderSelect({ restrictedDomains: [financeRef] });

    const { nodes } = await lastProps().fetchData({});

    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('Finance');
  });

  it('should drop domains that are not in the allowed list', async () => {
    const marketingRef: EntityReference = {
      id: 'd2',
      type: 'domain',
      name: 'Marketing',
      fullyQualifiedName: 'Marketing',
    };
    renderSelect({ restrictedDomains: [marketingRef] });

    const { nodes } = await lastProps().fetchData({});

    expect(nodes).toHaveLength(0);
  });

  it('should offer a single lazy "All Domains" root when showAllDomains is set', async () => {
    renderSelect({ showAllDomains: true });

    const { nodes } = await lastProps().fetchData({});

    expect(nodes).toHaveLength(1);
    expect(nodes[0].value).toBe('All Domains');
    // A real branch, so the roots under it page like any other level.
    expect(nodes[0]).toMatchObject({ lazyLoad: true, isLeaf: false });
    expect(nodes[0].children).toBeUndefined();
    expect(mockGetChildren).not.toHaveBeenCalled();
  });

  it('should page the root listing when "All Domains" is expanded', async () => {
    renderSelect({ showAllDomains: true });

    const response = await lastProps().fetchData({
      parentId: 'All Domains',
      pageSize: PAGE_SIZE_LARGE,
    });

    expect(mockGetChildren).toHaveBeenCalledWith(
      undefined,
      PAGE_SIZE_LARGE,
      0,
      undefined,
      [TabSpecificField.CHILDREN_COUNT]
    );
    expect(response.nodes[0].id).toBe('Finance');
  });

  it('should not prepend "All Domains" when loading a parent\'s subdomains', async () => {
    renderSelect({ showAllDomains: true });

    const { nodes } = await lastProps().fetchData({ parentId: 'Finance' });

    expect(nodes[0].value).not.toBe('All Domains');
  });

  it('should clear the scope (onUpdate undefined) when "All Domains" is picked', () => {
    const { onUpdate } = renderSelect({
      showAllDomains: true,
      selectedDomain: financeRef,
    });

    lastProps().onChange({
      id: 'All Domains',
      value: 'All Domains',
      label: 'All Domains',
    });

    expect(onUpdate).toHaveBeenCalledWith(undefined);
  });

  it('should call onUpdate with the array in multiple mode', () => {
    const { onUpdate } = renderSelect({ multiple: true });

    lastProps().onChange([
      { id: 'Finance', value: 'Finance', label: 'Finance', data: financeRef },
    ]);

    expect(onUpdate).toHaveBeenCalledWith([financeRef]);
  });

  it('should call onUpdate with a single reference in single mode', () => {
    const { onUpdate } = renderSelect({ multiple: false });

    lastProps().onChange({
      id: 'Finance',
      value: 'Finance',
      label: 'Finance',
      data: financeRef,
    });

    expect(onUpdate).toHaveBeenCalledWith(financeRef);
  });

  it('should call onUpdate with undefined when cleared and clearing is allowed', () => {
    const { onUpdate } = renderSelect({
      multiple: false,
      isClearable: true,
      selectedDomain: financeRef,
    });

    lastProps().onChange(null);

    expect(onUpdate).toHaveBeenCalledWith(undefined);
  });

  it('should not call onUpdate when the selection is unchanged', async () => {
    const { onUpdate } = renderSelect({
      multiple: true,
      selectedDomain: [financeRef],
    });

    await lastProps().onChange([
      {
        id: financeRef.id,
        value: financeRef.fullyQualifiedName,
        label: 'x',
        data: financeRef,
      },
    ]);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('should not call onUpdate when cleared but clearing is disallowed', () => {
    const { onUpdate } = renderSelect({ multiple: false, isClearable: false });

    lastProps().onChange(null);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  describe('renderSelectedItem', () => {
    // entityReferencesToTreeNodes keys nodes on the FQN, not the entity id.
    const node = {
      id: financeRef.fullyQualifiedName,
      value: financeRef.fullyQualifiedName,
      label: 'Finance',
      data: financeRef,
    } as never;

    it('renders the selection as the shared DomainTag, not plain label text', () => {
      renderSelect({ selectedDomain: financeRef });

      const chip = lastProps().renderSelectedItem(node);
      const { getByTestId } = render(chip);

      expect(
        getByTestId(`domain-tag-${financeRef.fullyQualifiedName}`)
      ).toBeInTheDocument();
    });

    it('removes only the clicked chip in multiple mode', async () => {
      const second = {
        ...financeRef,
        id: 'd2',
        fullyQualifiedName: 'Marketing',
      };
      const { onUpdate } = renderSelect({
        multiple: true,
        isClearable: true,
        selectedDomain: [financeRef, second],
      });

      const chip = lastProps().renderSelectedItem(node);

      await chip.props.onDelete();

      // The other domain survives; only the clicked one is dropped.
      expect(onUpdate).toHaveBeenCalledWith([
        expect.objectContaining({ fullyQualifiedName: 'Marketing' }),
      ]);
    });

    it('does not offer delete when the picker is disabled or lacks permission', () => {
      renderSelect({
        selectedDomain: financeRef,
        isClearable: true,
        disabled: true,
      });

      expect(
        lastProps().renderSelectedItem(node).props.onDelete
      ).toBeUndefined();
      expect(lastProps().renderSelectedItem(node).props.disabled).toBe(true);

      renderSelect({
        selectedDomain: financeRef,
        isClearable: true,
        hasPermission: false,
      });

      expect(
        lastProps().renderSelectedItem(node).props.onDelete
      ).toBeUndefined();
    });

    it('offers a remove affordance only when clearing is allowed', () => {
      renderSelect({ selectedDomain: financeRef, isClearable: true });
      const clearable = lastProps().renderSelectedItem(node);

      expect(clearable.props.onDelete).toBeDefined();

      renderSelect({ selectedDomain: financeRef, isClearable: false });
      const locked = lastProps().renderSelectedItem(node);

      expect(locked.props.onDelete).toBeUndefined();
    });
  });
});
