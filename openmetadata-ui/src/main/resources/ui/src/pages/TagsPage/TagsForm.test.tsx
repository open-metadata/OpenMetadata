/*
 *  Copyright 2022 Collate.
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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegisterOptions, useForm } from 'react-hook-form';
import TagsForm from './TagsForm';
import { TagFormValues } from './TagsPage.interface';

jest.mock('@openmetadata/ui-core-components', () => {
  const { FieldTypes, HelperTextType } = jest.requireActual(
    '@openmetadata/ui-core-components'
  );
  const {
    Controller: RHFController,
    FormProvider: RHFFormProvider,
    useFormContext: useRHFContext,
  } = jest.requireActual('react-hook-form');

  const GridItem = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  const GridComponent = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  GridComponent.Item = GridItem;

  const Toggle = ({
    isSelected,
    onChange,
    isDisabled,
    className,
    ...rest
  }: {
    isSelected?: boolean;
    onChange?: (val: boolean) => void;
    isDisabled?: boolean;
    className?: string;
  } & Record<string, unknown>) => (
    <button
      aria-checked={isSelected}
      className={className}
      disabled={isDisabled}
      role="switch"
      type="button"
      onClick={() => onChange?.(!isSelected)}
      {...rest}
    />
  );

  const MockField = ({
    fieldProp,
  }: {
    fieldProp: {
      id?: string;
      name: string;
      label: React.ReactNode;
      type: string;
      rules?: RegisterOptions;
      props?: Record<string, unknown>;
    };
  }) => {
    const { control } = useRHFContext();
    const testId =
      (fieldProp.props?.['data-testid'] as string) ?? fieldProp.name;
    const isDisabled = Boolean(
      fieldProp.props?.isDisabled ?? fieldProp.props?.disabled
    );

    if (fieldProp.type === FieldTypes.SWITCH) {
      return (
        <div>
          <label>{fieldProp.label}</label>
          <Toggle
            data-testid={testId}
            isDisabled={isDisabled}
            isSelected={false}
          />
        </div>
      );
    }

    return (
      <RHFController
        control={control}
        name={fieldProp.name}
        render={({
          field,
          fieldState,
        }: {
          field: {
            value: unknown;
            onChange: (val: unknown) => void;
            onBlur: () => void;
          };
          fieldState: { error?: { message?: string } };
        }) => (
          <div>
            <label htmlFor={testId}>
              {fieldProp.label}
              <input
                data-testid={testId}
                disabled={isDisabled}
                id={testId}
                value={typeof field.value === 'string' ? field.value : ''}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(e.target.value)}
              />
            </label>
            {fieldState.error?.message && (
              <span>{fieldState.error.message}</span>
            )}
          </div>
        )}
        rules={fieldProp.rules}
      />
    );
  };

  return {
    FieldTypes,
    HelperTextType,
    Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Avatar: () => <div data-testid="avatar" />,
    FormItemLabel: ({
      label,
      tooltip,
      required,
    }: {
      label?: React.ReactNode;
      tooltip?: React.ReactNode;
      required?: boolean;
    }) => (
      <span>
        {label}
        {required && '*'}
        {tooltip}
      </span>
    ),
    IconPickerField: ({
      value,
      onChange,
      'data-testid': dataTestId,
    }: {
      value?: string;
      onChange?: (value: string) => void;
      'data-testid'?: string;
    }) => (
      <input
        data-testid={dataTestId ?? 'icon-picker-field'}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
    Tooltip: ({
      children,
      title,
    }: {
      children: React.ReactNode;
      title?: React.ReactNode;
    }) => (
      <div data-testid="tooltip" title={title as string}>
        {children}
      </div>
    ),
    TooltipTrigger: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <button className={className}>{children}</button>,
    HintText: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
    Toggle,
    Grid: GridComponent,
    HookForm: ({
      children,
      form,
      onSubmit,
    }: {
      children: React.ReactNode;
      form: Record<string, unknown>;
      onSubmit?: (e: React.FormEvent) => void;
    } & Record<string, unknown>) => (
      <RHFFormProvider {...form}>
        <form data-testid="tags-form" onSubmit={onSubmit}>
          {children}
        </form>
      </RHFFormProvider>
    ),
    FormField: ({
      control,
      name,
      rules,
      children,
    }: {
      control: unknown;
      name: string;
      rules?: RegisterOptions;
      children: (controller: {
        field: {
          value: unknown;
          onChange: (value: unknown) => void;
          onBlur: () => void;
        };
        fieldState: { invalid: boolean; error?: { message?: string } };
      }) => React.ReactNode;
    }) => (
      <RHFController
        control={control}
        name={name}
        render={children}
        rules={rules}
      />
    ),
    getField: (fieldProp: {
      id?: string;
      name: string;
      label: React.ReactNode;
      type: string;
      rules?: RegisterOptions;
      props?: Record<string, unknown>;
    }) => <MockField fieldProp={fieldProp} key={fieldProp.id} />,
  };
});

jest.mock('../../components/common/RichTextEditor/RichTextEditor', () => {
  return jest.fn().mockImplementation(({ initialValue }) => {
    return <div>{initialValue}MarkdownWithPreview component</div>;
  });
});

jest.mock('../../utils/EntityDisplayPureUtils', () => ({
  ...jest.requireActual('../../utils/EntityDisplayPureUtils'),
  getCountBadge: jest.fn().mockReturnValue(''),
}));
jest.mock('../../utils/StringUtils', () => ({
  isUrlFriendlyName: jest.fn().mockReturnValue(true),
}));

jest.mock('../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
      canAddMultipleDomains: false,
    },
  })),
}));

jest.mock('../../hooks/useDomainStore', () => ({
  useDomainStore: jest.fn().mockReturnValue({
    activeDomainEntityRef: undefined,
  }),
}));

jest.mock('../../rest/domainAPI', () => ({
  searchData: jest.fn().mockResolvedValue({
    data: { hits: { hits: [] } },
  }),
}));

const mockSubmit = jest.fn();

const TEST_INITIAL_VALUES = {
  id: '',
  name: '',
  displayName: '',
  description: '',
  autoClassificationConfig: {
    enabled: false,
  },
};

// Create a wrapper component to use the form hook
const TestWrapper = ({
  showMutuallyExclusive = false,
  isClassification = false,
  isEditing = true,
  isSystemTag = false,
  initialValues = TEST_INITIAL_VALUES,
}: {
  showMutuallyExclusive?: boolean;
  isClassification?: boolean;
  isEditing?: boolean;
  isSystemTag?: boolean;
  initialValues?: typeof TEST_INITIAL_VALUES;
}) => {
  const form = useForm<TagFormValues>({ defaultValues: initialValues });

  return (
    <TagsForm
      form={form}
      initialValues={initialValues}
      isClassification={isClassification}
      isEditing={isEditing}
      isSystemTag={isSystemTag}
      isTier={false}
      permissions={{
        createTags: true,
        editAll: true,
        editDescription: true,
        editDisplayName: true,
      }}
      showMutuallyExclusive={showMutuallyExclusive}
      onSubmit={mockSubmit}
    />
  );
};

describe('TagForm component', () => {
  beforeEach(() => {
    mockSubmit.mockClear();
  });

  it('Form component should render properly', async () => {
    render(<TestWrapper />);

    const form = await screen.findByTestId('tags-form');
    const name = await screen.findByTestId('name');

    expect(form).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(
      await screen.findByText(/MarkdownWithPreview component/i)
    ).toBeInTheDocument();
  });

  it('Form component should render name and displayName fields', async () => {
    render(<TestWrapper />);

    const nameField = await screen.findByTestId('name');
    const displayNameField = await screen.findByTestId('displayName');

    expect(nameField).toBeInTheDocument();
    expect(displayNameField).toBeInTheDocument();
  });

  it('Form component should render Mutually Exclusive field when showMutuallyExclusive is true', async () => {
    render(<TestWrapper isClassification showMutuallyExclusive />);

    const mutuallyExclusiveButton = await screen.findByTestId(
      'mutually-exclusive-button'
    );

    expect(mutuallyExclusiveButton).toBeInTheDocument();
  });

  it('Form component should not render Mutually Exclusive field when showMutuallyExclusive is false', async () => {
    render(<TestWrapper showMutuallyExclusive={false} />);

    const mutuallyExclusiveButton = screen.queryByTestId(
      'mutually-exclusive-button'
    );

    expect(mutuallyExclusiveButton).not.toBeInTheDocument();
  });

  it('should allow saving a colon-separated tag name in create mode and reject double colons (#37908)', async () => {
    render(
      <TestWrapper
        initialValues={{ ...TEST_INITIAL_VALUES, description: 'Valid desc' }}
        isEditing={false}
      />
    );

    const nameInput = await screen.findByTestId('name');
    const form = await screen.findByTestId('tags-form');

    fireEvent.change(nameInput, { target: { value: 'ABC::DEF' } });
    fireEvent.submit(form);

    expect(
      await screen.findByText('message.entity-name-validation')
    ).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: 'ABC:DEF:SC:C' } });
    fireEvent.submit(form);

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ABC:DEF:SC:C',
        description: 'Valid desc',
      })
    );
  });

  it('should allow editing and saving a non-system 1-character or colon tag, and disable name on system tags', async () => {
    const { unmount } = render(
      <TestWrapper
        isEditing
        initialValues={{
          ...TEST_INITIAL_VALUES,
          id: 'tag-1',
          name: 'C',
          description: 'Single-char tag description',
        }}
        isSystemTag={false}
      />
    );

    const nonSystemNameInput = await screen.findByTestId('name');

    expect(nonSystemNameInput).not.toBeDisabled();

    fireEvent.submit(await screen.findByTestId('tags-form'));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'C',
        description: 'Single-char tag description',
      })
    );

    unmount();
    mockSubmit.mockClear();

    render(
      <TestWrapper
        isEditing
        isSystemTag
        initialValues={{
          ...TEST_INITIAL_VALUES,
          id: 'sys-1',
          name: 'ABC:DEF:SC:C',
          description: 'System tag description',
        }}
      />
    );

    const systemNameInput = await screen.findByTestId('name');

    expect(systemNameInput).toBeDisabled();

    fireEvent.submit(await screen.findByTestId('tags-form'));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ABC:DEF:SC:C',
        description: 'System tag description',
      })
    );
  });
});
