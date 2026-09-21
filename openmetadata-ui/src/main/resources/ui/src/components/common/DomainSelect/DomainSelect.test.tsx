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

    expect(mockGetChildren).toHaveBeenCalledWith(undefined, PAGE_SIZE_LARGE);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('Finance');
    expect(nodes[0].data).toMatchObject({ id: 'd1', type: 'domain' });
  });

  it('should lazy-load subdomains for a parent id', async () => {
    renderSelect();

    await lastProps().fetchData({ parentId: 'Finance' });

    expect(mockGetChildren).toHaveBeenCalledWith('Finance', PAGE_SIZE_LARGE);
  });

  it('should search domains when a search term is given', async () => {
    renderSelect();

    const { nodes } = await lastProps().fetchData({ searchTerm: 'Fin' });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(nodes).toHaveLength(1);
  });

  it('should filter out restricted domains from results', async () => {
    renderSelect({ restrictedDomains: [financeRef] });

    const { nodes } = await lastProps().fetchData({});

    expect(nodes).toHaveLength(0);
  });

  it('should nest domains under a single "All Domains" root when showAllDomains is set', async () => {
    renderSelect({ showAllDomains: true });

    const { nodes } = await lastProps().fetchData({});

    expect(nodes).toHaveLength(1);
    expect(nodes[0].value).toBe('All Domains');
    expect(nodes[0].children?.[0].id).toBe('Finance');
  });

  it('should not prepend "All Domains" when loading a parent\'s subdomains', async () => {
    renderSelect({ showAllDomains: true });

    const { nodes } = await lastProps().fetchData({ parentId: 'Finance' });

    expect(nodes[0].value).not.toBe('All Domains');
  });

  it('should clear the scope (onUpdate undefined) when "All Domains" is picked', () => {
    const { onUpdate } = renderSelect({ showAllDomains: true });

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
    const { onUpdate } = renderSelect({ multiple: false, isClearable: true });

    lastProps().onChange(null);

    expect(onUpdate).toHaveBeenCalledWith(undefined);
  });

  it('should not call onUpdate when cleared but clearing is disallowed', () => {
    const { onUpdate } = renderSelect({ multiple: false, isClearable: false });

    lastProps().onChange(null);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('should forward the inline create props', () => {
    const onCreate = jest.fn();
    renderSelect({ onCreate, createLabel: 'Add new domain' });

    expect(lastProps().createLabel).toBe('Add new domain');
    expect(lastProps().onCreate).toBe(onCreate);
  });
});
