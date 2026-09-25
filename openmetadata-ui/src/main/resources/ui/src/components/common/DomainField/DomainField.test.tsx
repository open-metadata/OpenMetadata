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
import { act, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import DomainField from './DomainField';
import { DomainFieldProps } from './DomainField.types';

const domainSelectMock = jest.fn();
const domainTagsMock = jest.fn();

jest.mock('../DomainSelect/DomainSelect', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    domainSelectMock(props);

    return <div data-testid="domain-select-mock" />;
  },
}));

jest.mock('../DomainTags/DomainTags', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    domainTagsMock(props);

    return <div data-testid="domain-tags-mock" />;
  },
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ButtonUtility: (props: Record<string, unknown>) => (
    <button
      aria-label="edit"
      data-testid="add-domain"
      onClick={props.onClick as () => void}
    />
  ),
  Typography: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Edit: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../utils/Assets/AssetsUtils', () => ({
  getAPIfromSource: jest.fn(),
  getEntityAPIfromSource: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetEntityAPI = getEntityAPIfromSource as jest.Mock;
const mockGetAPI = getAPIfromSource as jest.Mock;

const financeRef: EntityReference = {
  id: 'd1',
  type: 'domain',
  name: 'Finance',
  fullyQualifiedName: 'Finance',
};

const lastDomainSelectProps = () =>
  domainSelectMock.mock.calls[domainSelectMock.mock.calls.length - 1][0];

const lastDomainTagsProps = () =>
  domainTagsMock.mock.calls[domainTagsMock.mock.calls.length - 1][0];

const renderField = (props: Partial<DomainFieldProps> = {}) =>
  render(
    <DomainField
      entityFqn="svc.db.tbl"
      entityId="entity-1"
      entityType={EntityType.TABLE}
      {...props}
    />
  );

describe('DomainField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntityAPI.mockReturnValue(
      jest.fn().mockResolvedValue({ id: 'entity-1', domains: [] })
    );
    mockGetAPI.mockReturnValue(
      jest.fn().mockResolvedValue({ id: 'entity-1', domains: [financeRef] })
    );
  });

  it('should render the assigned domains as chips', () => {
    renderField({ domains: [financeRef] });

    expect(screen.getByTestId('domain-tags-mock')).toBeInTheDocument();
    expect(lastDomainTagsProps().domains).toEqual([financeRef]);
  });

  it('should not render the editor without permission', () => {
    renderField({ domains: [financeRef], hasPermission: false });

    expect(screen.queryByTestId('domain-select-mock')).not.toBeInTheDocument();
  });

  it('should render the editor when permitted', () => {
    renderField({ hasPermission: true });

    expect(screen.getByTestId('domain-select-mock')).toBeInTheDocument();
    expect(lastDomainSelectProps().triggerVariant).toBe('button');
  });

  it('should save via a JSON patch and reflect the response', async () => {
    renderField({ hasPermission: true, afterDomainUpdateAction: jest.fn() });

    await act(async () => {
      await lastDomainSelectProps().onUpdate([financeRef]);
    });

    expect(mockGetEntityAPI).toHaveBeenCalledWith(EntityType.TABLE);
    expect(mockGetAPI).toHaveBeenCalledWith(EntityType.TABLE);

    await waitFor(() =>
      expect(lastDomainTagsProps().domains).toEqual([financeRef])
    );
  });

  it('should call afterDomainUpdateAction with the updated entity', async () => {
    const afterDomainUpdateAction = jest.fn();
    renderField({ hasPermission: true, afterDomainUpdateAction });

    await act(async () => {
      await lastDomainSelectProps().onUpdate([financeRef]);
    });

    await waitFor(() =>
      expect(afterDomainUpdateAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'entity-1' })
      )
    );
  });

  it('should use the provided onUpdate instead of the default patch save', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    renderField({ hasPermission: true, onUpdate });

    await lastDomainSelectProps().onUpdate([financeRef]);

    expect(onUpdate).toHaveBeenCalledWith([financeRef]);
    expect(mockGetAPI).not.toHaveBeenCalled();
  });

  it('should forward inline create props to the picker', () => {
    const onCreate = jest.fn();
    renderField({
      hasPermission: true,
      onCreate,
      createLabel: 'Add new domain',
    });

    expect(lastDomainSelectProps().onCreate).toBe(onCreate);
    expect(lastDomainSelectProps().createLabel).toBe('Add new domain');
  });
});
