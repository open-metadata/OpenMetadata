/*
 *  Copyright 2023 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { FormEvent, ReactNode } from 'react';
import {
  Controller,
  FormProvider,
  useFormContext,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  QuickLinkFormModal,
  QuickLinkFormModalProps,
} from './QuickLinkFormModal';


jest.mock('@openmetadata/ui-core-components', () => {
  const Autocomplete = ({
    children,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
    [key: string]: unknown;
  }) => <div data-testid={testId}>{children}</div>;

  Autocomplete.Item = ({
    label,
    'data-testid': testId,
  }: {
    label?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={testId}>{label}</div>;

  return {
    Autocomplete,
    Button: ({
      children,
      onClick,
    }: {
      children: ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>,
    Dialog: Object.assign(
      ({ children }: { children: ReactNode }) => (
        <div data-testid="dialog">{children}</div>
      ),
      {
        Content: ({ children }: { children: ReactNode }) => (
          <div data-testid="dialog-content">{children}</div>
        ),
        Footer: ({ children }: { children: ReactNode }) => (
          <div data-testid="dialog-footer">{children}</div>
        ),
        Header: ({ title }: { title: string }) => (
          <div data-testid="dialog-header">{title}</div>
        ),
      }
    ),
    FieldTypes: {
      ASYNC_SELECT: 'ASYNC_SELECT',
      DESCRIPTION: 'DESCRIPTION',
      GLOSSARY_TAG_SUGGESTION: 'GLOSSARY_TAG_SUGGESTION',
      TAG_SUGGESTION: 'TAG_SUGGESTION',
      TEXT: 'TEXT',
      TEXTAREA: 'TEXTAREA',
    },
    FormField: <TFieldValues extends FieldValues = FieldValues>({
      control,
      name,
      rules,
      children,
    }: {
      control: import('react-hook-form').Control<TFieldValues>;
      name: import('react-hook-form').FieldPath<TFieldValues>;
      rules?: Omit<
        RegisterOptions<TFieldValues>,
        'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
      >;
      children: (controller: {
        field: import('react-hook-form').ControllerRenderProps<
          TFieldValues,
          import('react-hook-form').FieldPath<TFieldValues>
        >;
        fieldState: import('react-hook-form').ControllerFieldState;
      }) => ReactNode;
    }) => (
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <>{children({ field, fieldState })}</>
        )}
        rules={rules}
      />
    ),
    FormItemLabel: ({ label }: { label: ReactNode }) => <div>{label}</div>,
    HintText: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    HookForm: ({
      children,
      form,
      onSubmit,
      ...props
    }: {
      children: ReactNode;
      form: ReturnType<typeof import('react-hook-form').useForm>;
      onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
      [key: string]: unknown;
    }) => (
      <FormProvider {...form}>
        <form
          {...props}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.(event);
          }}>
          {children}
        </form>
      </FormProvider>
    ),
    getField: ({
      name,
      type,
      props: fieldProps = {},
    }: {
      name: string;
      type: string;
      props?: Record<string, unknown>;
    }) => {
      const testId = fieldProps['data-testid'] as string | undefined;
      const disabled = fieldProps.disabled as boolean | undefined;

      if (type === 'TEXT' || type === 'TEXTAREA' || type === 'DESCRIPTION') {
        const RegisteredInput = () => {
          const { register } = useFormContext();
          const { onChange, onBlur, name: regName, ref } = register(name);

          return (
            <input
              data-testid={testId ?? name}
              disabled={disabled}
              name={regName}
              ref={ref}
              onBlur={onBlur}
              onChange={onChange}
            />
          );
        };

        return <RegisteredInput />;
      }

      return <div data-testid={testId ?? name} />;
    },
    Modal: ({ children }: { children: ReactNode }) => (
      <div data-testid="modal">{children}</div>
    ),
    ModalOverlay: ({
      children,
      isOpen,
    }: {
      children: ReactNode;
      isOpen: boolean;
    }) => (isOpen ? <div data-testid="modal-overlay">{children}</div> : null),
  };
});

jest.mock('utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName ?? ''),
  getEntityReferenceFromEntity: jest.fn().mockImplementation((entity) => entity),
}));

jest.mock('utils/TableUtils', () => ({
  getTagsWithoutTier: jest.fn().mockReturnValue([]),
}));

jest.mock('utils/TableTags/TableTags.utils', () => ({
  getFilterTags: jest
    .fn()
    .mockReturnValue({ Classification: [], Glossary: [] }),
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('utils/TagsUtils', () => ({
  getTagDisplay: jest.fn().mockImplementation((name) => name),
}));

jest.mock('utils/TagClassBase', () => ({
  __esModule: true,
  default: {
    getTags: jest.fn().mockResolvedValue({ data: [] }),
    setFilterClassification: jest.fn(),
  },
}));

jest.mock('rest/glossaryAPI', () => ({
  searchGlossaryTerms: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));

jest.mock('rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
}));

jest.mock('rest/knowledgeCenterAPI', () => ({
  getKnowledgePageByFqn: jest.fn(),
  patchKnowledgePage: jest.fn(),
}));

jest.mock('constants/KnowledgeCenter.constant', () => ({
  getKnowledgePageFields: jest.fn().mockReturnValue([]),
}));

const mockSave = jest.fn();
const mockCancel = jest.fn();

const mockProps: QuickLinkFormModalProps = {
  isOpen: true,
  onSave: mockSave,
  onCancel: mockCancel,
  permissions: {
    EditAll: true,
    EditDisplayName: true,
    EditDescription: true,
    EditTags: true,
  } as OperationPermission,
};

describe('QuickLinkFormModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should render the form inputs', async () => {
    render(<QuickLinkFormModal {...mockProps} />);

    expect(screen.getByTestId('displayName')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toBeInTheDocument();
    expect(screen.getByTestId('description')).toBeInTheDocument();
    expect(screen.getByTestId('tags-container')).toBeInTheDocument();
    expect(screen.getByTestId('glossaryTerms-container')).toBeInTheDocument();
    expect(
      screen.getByTestId('related-entities-container')
    ).toBeInTheDocument();
  });

  it('onSave should work', async () => {
    render(<QuickLinkFormModal {...mockProps} />);

    fireEvent.change(screen.getByTestId('displayName'), {
      target: { value: 'displayName' },
    });
    fireEvent.change(screen.getByTestId('url'), {
      target: { value: 'https://example.coms' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.save'));
    });

    expect(mockSave).toHaveBeenCalledWith({
      description: '',
      displayName: 'displayName',
      glossaryTerms: [],
      relatedEntities: [],
      tags: [],
      url: 'https://example.coms',
    });
  });

  it('onCancel should work', async () => {
    render(<QuickLinkFormModal {...mockProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText('label.cancel'));
    });

    expect(mockCancel).toHaveBeenCalled();
  });
});
