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

import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { DEFAULT_FORM_VALUE } from '../../constants/Tags.constant';
import TagsForm from './TagsForm';
import { TagFormValues } from './TagsPage.interface';

jest.mock('@openmetadata/ui-core-components', () => {
  const { FieldTypes, HelperTextType } = jest.requireActual(
    '@openmetadata/ui-core-components'
  );

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
      onClick={() => onChange?.(!isSelected)}
      {...rest}
    />
  );

  return {
    FieldTypes,
    HelperTextType,
    Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Avatar: () => <div data-testid="avatar" />,
    FormItemLabel: ({ label }: { label: React.ReactNode }) => (
      <label>{label}</label>
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
      onSubmit,
    }: {
      children: React.ReactNode;
      onSubmit?: (e: React.FormEvent) => void;
    } & Record<string, unknown>) => (
      <form data-testid="tags-form" onSubmit={onSubmit}>
        {children}
      </form>
    ),
    FormField: ({
      name,
      children,
    }: {
      name: string;
      children: (controller: {
        field: {
          value: unknown;
          onChange: (value: unknown) => void;
          onBlur: () => void;
        };
        fieldState: { invalid: boolean; error?: { message?: string } };
      }) => React.ReactNode;
    }) =>
      children({
        field: {
          value: name === 'mutuallyExclusive' ? false : '',
          onChange: jest.fn(),
          onBlur: jest.fn(),
        },
        fieldState: { invalid: false },
      }),
    getField: (fieldProp: {
      id?: string;
      name: string;
      label: React.ReactNode;
      type: string;
      props?: Record<string, unknown>;
    }) => {
      const testId =
        (fieldProp.props?.['data-testid'] as string) ?? fieldProp.name;

      if (fieldProp.type === FieldTypes.SWITCH) {
        return (
          <div key={fieldProp.id}>
            <label>{fieldProp.label}</label>
            <Toggle
              data-testid={testId}
              isDisabled={fieldProp.props?.disabled as boolean}
              isSelected={false}
            />
          </div>
        );
      }

      return (
        <div key={fieldProp.id}>
          <label>{fieldProp.label}</label>
          <input readOnly data-testid={testId} value="" />
        </div>
      );
    },
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
  ...DEFAULT_FORM_VALUE,
  autoClassificationConfig: {
    enabled: false,
  },
};

// Create a wrapper component to use the form hook
const TestWrapper = ({
  showMutuallyExclusive = false,
  isClassification = false,
}: {
  showMutuallyExclusive?: boolean;
  isClassification?: boolean;
}) => {
  const form = useForm<TagFormValues>();

  return (
    <TagsForm
      isEditing
      form={form}
      initialValues={TEST_INITIAL_VALUES}
      isClassification={isClassification}
      isSystemTag={false}
      isTier={false}
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
});
