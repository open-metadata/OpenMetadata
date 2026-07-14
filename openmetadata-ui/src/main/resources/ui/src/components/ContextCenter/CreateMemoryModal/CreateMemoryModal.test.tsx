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
import React from 'react';
import {
  Control,
  FieldValues,
  FormProvider,
  useController,
  useForm,
  useFormContext,
} from 'react-hook-form';
import CreateMemoryModal from './CreateMemoryModal.component';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock(
  '../../../components/common/MarkdownEditor/markdownComponents',
  () => ({
    getCustomMarkdownComponents: jest.fn(() => ({})),
    preprocessMarkdownText: jest.fn((text: string) => text),
  })
);

jest.mock('../../../rest/contextMemoryAPI', () => ({
  createContextMemory: jest.fn(),
  updateContextMemory: jest.fn(),
  deleteContextMemory: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  getEntityIcon: jest.fn(() => null),
}));

jest.mock('../../../utils/TagClassBase', () => ({
  getTags: jest.fn(() => Promise.resolve({ data: [], paging: {} })),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDate: jest.fn(() => 'Jan 1, 2026'),
}));

jest.mock('../../../components/common/PopOverCard/UserPopOverCard', () =>
  jest.fn(({ userName }: { userName: string }) => <span>{userName}</span>)
);

jest.mock(
  '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList',
  () => jest.fn(() => <div data-testid="data-asset-select-list" />)
);

jest.mock(
  '../../../components/Tag/TagsSelectForm/TagsSelectForm.component',
  () => jest.fn(() => <div data-testid="tag-select-form" />)
);

jest.mock('antd', () => ({
  ConfigProvider: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
  Form: Object.assign(
    jest.fn(({ children }: { children: React.ReactNode }) => (
      <form>{children}</form>
    )),
    {
      Item: jest.fn(({ children }: { children: React.ReactNode }) => (
        <>{children}</>
      )),
    }
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Alert: jest.fn(({ title }: { title: string }) => (
    <div role="alert">{title}</div>
  )),
  Badge: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  BadgeWithButton: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  Box: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Button: jest.fn(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>
  ),
  ButtonUtility: jest.fn(({ onClick }: { onClick?: () => void }) => (
    <button onClick={onClick}>x</button>
  )),
  Card: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Dialog: Object.assign(
    jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    {
      Content: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
    }
  ),
  Dot: jest.fn(() => <span />),
  FieldTypes: { TEXT: 'text', SELECT: 'select' },
  FormField: ({
    control,
    name,
    children,
  }: {
    control: Control<FieldValues>;
    name: string;
    children: (controller: unknown) => React.ReactNode;
  }) => {
    const controller = useController({ control, name });

    return <>{children(controller)}</>;
  },
  FormItemLabel: jest.fn(({ label }: { label: React.ReactNode }) => (
    <label>{label}</label>
  )),
  getField: (fieldProp: {
    name: string;
    label: React.ReactNode;
    type: string;
    props?: Record<string, unknown>;
  }) => {
    const MockField = () => {
      const { control } = useFormContext();
      const { field } = useController({ control, name: fieldProp.name });
      const testId = fieldProp.props?.['data-testid'] as string | undefined;

      if (fieldProp.type === 'select') {
        const options =
          (fieldProp.props?.options as { id: string; label: string }[]) ?? [];

        return (
          <div>
            <label>{fieldProp.label}</label>
            <select
              data-testid={testId}
              value={field.value?.id ?? ''}
              onChange={(e) => {
                const next = options.find((opt) => opt.id === e.target.value);
                field.onChange(next ?? null);
              }}>
              <option value="" />
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );
      }

      return (
        <div>
          <label>{fieldProp.label}</label>
          <input
            data-testid={testId}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value)}
          />
        </div>
      );
    };

    return <MockField />;
  },
  HookForm: ({
    form,
    children,
    className,
    onSubmit,
  }: {
    form: ReturnType<typeof useForm>;
    children: React.ReactNode;
    className?: string;
    onSubmit?: (e: React.FormEvent) => void;
  }) => (
    <FormProvider {...form}>
      <form className={className} onSubmit={onSubmit}>
        {children}
      </form>
    </FormProvider>
  ),
  Input: jest.fn(
    ({
      'data-testid': testId,
      value,
      onChange,
    }: {
      'data-testid'?: string;
      value?: string;
      onChange?: (val: string) => void;
    }) => (
      <input
        data-testid={testId}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  ),
  Modal: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  ModalOverlay: jest.fn(
    ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
      isOpen ? <div>{children}</div> : null
  ),
  Select: Object.assign(
    jest.fn(
      ({
        'data-testid': testId,
        children,
      }: {
        'data-testid'?: string;
        children?: React.ReactNode;
      }) => <div data-testid={testId}>{children}</div>
    ),
    {
      Item: jest.fn(({ label }: { label: string }) => <option>{label}</option>),
    }
  ),
  TextArea: jest.fn(
    ({
      'data-testid': testId,
      value,
      onChange,
    }: {
      'data-testid'?: string;
      value?: string;
      onChange?: (val: string) => void;
    }) => (
      <textarea
        data-testid={testId}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  ),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

describe('CreateMemoryModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onCreated: jest.fn(),
  };

  it('renders the content input', () => {
    render(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-content-input')).toBeInTheDocument();
  });

  it('renders title and type inputs', () => {
    render(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('memory-type-select')).toBeInTheDocument();
  });
});
