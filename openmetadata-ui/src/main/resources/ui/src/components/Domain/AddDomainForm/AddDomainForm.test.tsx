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
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { FormEvent, ReactNode } from 'react';
import {
  Controller,
  useForm,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form';
import {
  CreateDomain,
  DomainType,
} from '../../../generated/api/domains/createDomain';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import '../../../test/unit/mocks/mui.mock';
import { DomainFormType } from '../DomainPage.interface';
import AddDomainForm, {
  DOMAIN_FORM_DEFAULTS,
  transformDomainFormData,
} from './AddDomainForm.component';
import {
  DomainFormSelectItem,
  DomainFormValues,
} from './AddDomainForm.interface';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the permission provider
jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {},
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const Autocomplete = ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>;
  Autocomplete.Item = ({
    label,
    'data-testid': testId,
  }: {
    label?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={testId}>{label}</div>;

  return {
    Autocomplete,
    Avatar: (props: Record<string, unknown>) => (
      <div data-testid="avatar" {...props} />
    ),
    Box: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => <div {...props}>{children}</div>,
    Dot: (props: Record<string, unknown>) => <span {...props} />,
    Button: ({
      children,
      onPress,
      onClick,
      isDisabled,
      isLoading,
      'data-testid': testId,
      type,
    }: {
      children: ReactNode;
      onPress?: () => void;
      onClick?: () => void;
      isDisabled?: boolean;
      isLoading?: boolean;
      'data-testid'?: string;
      type?: 'submit' | 'button';
    }) => (
      <button
        data-testid={testId}
        disabled={isDisabled || isLoading}
        type={type ?? 'button'}
        onClick={() => {
          onClick?.();
          onPress?.();
        }}>
        {children}
      </button>
    ),
    FieldTypes: {
      COVER_IMAGE_UPLOAD: 'cover_image_upload',
      DESCRIPTION: 'description',
      DOMAIN_SELECT: 'domain_select',
      GLOSSARY_TAG_SUGGESTION: 'glossary_tag_suggestion',
      ICON_PICKER: 'icon_picker',
      TAG_SUGGESTION: 'tag_suggestion',
      COLOR_PICKER: 'color_picker',
      SELECT: 'select',
      TEXT: 'text',
      USER_TEAM_SELECT: 'user_team_select',
      USER_TEAM_SELECT_INPUT: 'user_team_select_input',
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
      onSubmit,
      ...props
    }: {
      children: ReactNode;
      onSubmit?: (event?: FormEvent<HTMLFormElement>) => void;
      [key: string]: unknown;
    }) => (
      <form
        {...props}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}>
        {children}
      </form>
    ),
    getField: (field: {
      id?: string;
      name: string;
      label: ReactNode;
      props?: { 'data-testid'?: string };
    }) => (
      <div data-testid={field.props?.['data-testid'] ?? field.id ?? field.name}>
        {field.label}
      </div>
    ),
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

jest.mock(
  '../../../components/BlockEditor/Extensions/image/ImageClassBase',
  () => ({
    __esModule: true,
    default: {
      getBlockEditorAttachmentProps: jest.fn().mockReturnValue(undefined),
    },
  })
);

jest.mock('../../common/IconPicker', () => ({
  AVAILABLE_ICONS: [
    { category: 'default', component: jest.fn(), name: 'Cube01' },
    { category: 'icons', component: jest.fn(), name: 'Globe01' },
  ],
  DEFAULT_DATA_PRODUCT_ICON: { name: 'data-product' },
  DEFAULT_DOMAIN_ICON: { name: 'domain' },
}));

jest.mock(
  '../../common/MUIGlossaryTagSuggestion/MUIGlossaryTagSuggestion',
  () =>
    jest
      .fn()
      .mockReturnValue(
        <div data-testid="glossary-terms">MUIGlossaryTagSuggestion</div>
      )
);

type RichTextEditorMockProps = {
  initialValue?: string;
  onTextChange?: (value: string) => void;
};

const richTextEditorRenders: RichTextEditorMockProps[] = [];

jest.mock('../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockImplementation((props: RichTextEditorMockProps) => {
    richTextEditorRenders.push({
      initialValue: props.initialValue,
      onTextChange: props.onTextChange,
    });

    return <div data-testid="description">RichTextEditor</div>;
  })
);

const mockOnCancel = jest.fn();
const mockOnSubmit = jest.fn();

type HarnessProps = {
  loading?: boolean;
  isFormInDialog?: boolean;
  type?: DomainFormType;
  parentDomain?: Domain;
};

const AddDomainFormHarness = ({
  loading = false,
  isFormInDialog = false,
  type = DomainFormType.DOMAIN,
  parentDomain,
}: HarnessProps) => {
  const form = useForm<DomainFormValues>({
    defaultValues: DOMAIN_FORM_DEFAULTS,
  });

  return (
    <AddDomainForm
      form={form}
      isFormInDialog={isFormInDialog}
      loading={loading}
      parentDomain={parentDomain}
      type={type}
      onCancel={mockOnCancel}
      onSubmit={mockOnSubmit}
    />
  );
};

describe('AddDomainForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    richTextEditorRenders.length = 0;
  });

  it('should render the form component', () => {
    render(<AddDomainFormHarness />);

    const form = document.querySelector('form');

    expect(form).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(<AddDomainFormHarness />);

    const cancelButton = screen.getByTestId('cancel-domain');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should render loading state on save button when loading is true', () => {
    render(<AddDomainFormHarness loading />);

    const saveButton = screen.getByTestId('save-domain');

    expect(saveButton).toHaveAttribute('disabled');
  });

  it('should not render footer buttons when isFormInDialog is true', () => {
    render(<AddDomainFormHarness isFormInDialog />);

    const footerButtons = screen.queryByTestId('cta-buttons');

    expect(footerButtons).not.toBeInTheDocument();
  });

  it('should render footer buttons when isFormInDialog is false', () => {
    render(<AddDomainFormHarness isFormInDialog={false} />);

    const footerButtons = screen.getByTestId('cta-buttons');

    expect(footerButtons).toBeInTheDocument();
  });

  it('should handle form submission', () => {
    render(<AddDomainFormHarness />);

    const saveButton = screen.getByTestId('save-domain');
    fireEvent.click(saveButton);

    expect(saveButton).toBeInTheDocument();
  });

  it('should render form for DATA_PRODUCT type', () => {
    render(<AddDomainFormHarness type={DomainFormType.DATA_PRODUCT} />);

    const form = document.querySelector('form');

    expect(form).toBeInTheDocument();
  });

  it('should render form for SUBDOMAIN type with parent domain', () => {
    const parentDomain = {
      id: '123',
      name: 'Parent Domain',
      fullyQualifiedName: 'ParentDomain',
      description: 'Parent domain description',
      domainType: 'Aggregate',
    } as Domain;

    render(
      <AddDomainFormHarness
        parentDomain={parentDomain}
        type={DomainFormType.SUBDOMAIN}
      />
    );

    const form = document.querySelector('form');

    expect(form).toBeInTheDocument();
  });

  it('should have correct button labels', () => {
    render(<AddDomainFormHarness />);

    const cancelButton = screen.getByTestId('cancel-domain');
    const saveButton = screen.getByTestId('save-domain');

    expect(cancelButton).toHaveTextContent('label.cancel');
    expect(saveButton).toHaveTextContent('label.save');
  });

  it('should disable save button during loading', () => {
    render(<AddDomainFormHarness loading />);

    const saveButton = screen.getByTestId('save-domain');

    expect(saveButton).toBeDisabled();
  });

  it('should not disable cancel button during loading', () => {
    render(<AddDomainFormHarness loading />);

    const cancelButton = screen.getByTestId('cancel-domain');

    expect(cancelButton).not.toBeDisabled();
  });

  it('keeps description editor uncontrolled so trailing whitespace is not stripped on each keystroke', async () => {
    render(<AddDomainFormHarness />);

    expect(richTextEditorRenders).not.toHaveLength(0);

    const keystrokes = [
      '<p>h</p>',
      '<p>he</p>',
      '<p>hel</p>',
      '<p>hell</p>',
      '<p>hello</p>',
      '<p>hello </p>',
    ];

    for (const value of keystrokes) {
      const latest = richTextEditorRenders[richTextEditorRenders.length - 1];
      await act(async () => {
        latest.onTextChange?.(value);
      });
    }

    expect(richTextEditorRenders.length).toBeGreaterThan(1);
    expect(richTextEditorRenders.every((r) => r.initialValue === '')).toBe(
      true
    );
  });
});

describe('transformDomainFormData', () => {
  const tagLabel: TagLabel = {
    tagFQN: 'PII.Sensitive',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  };

  const glossaryTerm: TagLabel = {
    tagFQN: 'Business.Revenue',
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  };

  const ownerRef: EntityReference = {
    id: 'owner-1',
    name: 'alice',
    type: 'user',
  };

  const expertRef: EntityReference = {
    id: 'expert-1',
    name: 'bob',
    type: 'user',
  };

  const buildItem = (id: string, value: unknown): DomainFormSelectItem =>
    ({ id, value } as unknown as DomainFormSelectItem);

  const baseForm: DomainFormValues = {
    name: 'marketing',
    displayName: 'Marketing',
    description: 'Marketing domain',
    color: '#FF0000',
    iconURL: 'https://example.com/icon.svg',
    coverImage: null,
    tags: [],
    glossaryTerms: [],
    owners: [],
    experts: [],
    reviewers: [],
    domainType: null,
    domains: undefined,
    dataProductType: null,
    visibility: null,
    portfolioPriority: null,
    extension: {},
  };

  it('maps a populated DOMAIN form into a CreateDomain payload', () => {
    const formData: DomainFormValues = {
      ...baseForm,
      tags: [buildItem('PII.Sensitive', tagLabel)],
      glossaryTerms: [glossaryTerm],
      owners: [buildItem('owner-1', ownerRef)],
      experts: [buildItem('expert-1', expertRef)],
      domainType: buildItem(DomainType.Aggregate, DomainType.Aggregate),
    };

    const result = transformDomainFormData(
      formData,
      DomainFormType.DOMAIN
    ) as CreateDomain;

    expect(result).toMatchObject({
      name: 'marketing',
      displayName: 'Marketing',
      description: 'Marketing domain',
      domainType: DomainType.Aggregate,
      style: { color: '#FF0000', iconURL: 'https://example.com/icon.svg' },
      owners: [ownerRef],
      experts: ['bob'],
      tags: [tagLabel, glossaryTerm],
    });
    expect(result).not.toHaveProperty('color');
    expect(result).not.toHaveProperty('iconURL');
    expect(result).not.toHaveProperty('glossaryTerms');
    expect(result).not.toHaveProperty('domains');
  });

  it('falls back to empty string when an expert has no name', () => {
    const anonymousExpert = buildItem('expert-2', {
      id: 'expert-2',
      type: 'user',
    } as EntityReference);

    const result = transformDomainFormData(
      { ...baseForm, experts: [anonymousExpert] },
      DomainFormType.DOMAIN
    );

    expect(result.experts).toEqual(['']);
  });

  it('yields an undefined domainType when the form field is null', () => {
    const result = transformDomainFormData(
      baseForm,
      DomainFormType.DOMAIN
    ) as CreateDomain;

    expect(result.domainType).toBeUndefined();
  });

  it('strips the domains key for SUBDOMAIN type', () => {
    const parentDomain = { fullyQualifiedName: 'Finance' } as Domain;

    const result = transformDomainFormData(
      baseForm,
      DomainFormType.SUBDOMAIN,
      parentDomain
    );

    expect(result).not.toHaveProperty('domains');
  });

  it('uses the form-provided domain FQN for DATA_PRODUCT', () => {
    const selectedDomain = buildItem('Marketing.Sales', {
      id: 'domain-1',
      type: 'domain',
      fullyQualifiedName: 'Marketing.Sales',
    } as EntityReference);
    const parentDomain = { fullyQualifiedName: 'Finance' } as Domain;

    const result = transformDomainFormData(
      { ...baseForm, domains: selectedDomain },
      DomainFormType.DATA_PRODUCT,
      parentDomain
    );

    expect(result).toHaveProperty('domains', ['Marketing.Sales']);
  });

  it('falls back to parentDomain FQN when DATA_PRODUCT has no domain selection', () => {
    const parentDomain = { fullyQualifiedName: 'Finance' } as Domain;

    const result = transformDomainFormData(
      baseForm,
      DomainFormType.DATA_PRODUCT,
      parentDomain
    );

    expect(result).toHaveProperty('domains', ['Finance']);
  });

  it('omits domains when DATA_PRODUCT has neither selection nor parent FQN', () => {
    const result = transformDomainFormData(
      baseForm,
      DomainFormType.DATA_PRODUCT
    );

    expect(result).not.toHaveProperty('domains');
  });

  it('produces empty arrays when collections are empty', () => {
    const result = transformDomainFormData(baseForm, DomainFormType.DOMAIN);

    expect(result.tags).toEqual([]);
    expect(result.owners).toEqual([]);
    expect(result.experts).toEqual([]);
  });

  it('passes non-UI fields through unchanged', () => {
    const coverImage = { file: new File([], 'cover.png') };
    const formData: DomainFormValues = { ...baseForm, coverImage };

    const result = transformDomainFormData(
      formData,
      DomainFormType.DOMAIN
    ) as CreateDomain & { coverImage?: typeof coverImage };

    expect(result.name).toBe('marketing');
    expect(result.displayName).toBe('Marketing');
    expect(result.description).toBe('Marketing domain');
    expect(result.coverImage).toBe(coverImage);
  });

  it('unwraps a single entityReference extension picker item to its EntityReference', () => {
    // USER_TEAM_SELECT_INPUT with multiple=false stores a single
    // DomainFormSelectItem ({ id, label, value }), but the API expects the
    // bare EntityReference. Regression guard for the intake-form entity-ref
    // create flow returning 400.
    const stewardRef: EntityReference = {
      id: 'user-1',
      type: 'user',
      name: 'admin',
    };
    const formData: DomainFormValues = {
      ...baseForm,
      extension: {
        steward: { id: 'user-1', label: 'admin', value: stewardRef },
      },
    };

    const result = transformDomainFormData(
      formData,
      DomainFormType.DATA_PRODUCT
    ) as CreateDomain & { extension?: Record<string, unknown> };

    expect(result.extension?.steward).toEqual(stewardRef);
  });

  it('unwraps entityReferenceList + enum extension items, leaving scalars intact', () => {
    const userA: EntityReference = { id: 'a', type: 'user', name: 'a' };
    const userB: EntityReference = { id: 'b', type: 'user', name: 'b' };
    const formData: DomainFormValues = {
      ...baseForm,
      extension: {
        stewards: [
          { id: 'a', label: 'a', value: userA },
          { id: 'b', label: 'b', value: userB },
        ],
        tier: { id: 'Gold', label: 'Gold', value: 'Gold' },
        notes: 'plain text stays as-is',
        count: 7,
      },
    };

    const result = transformDomainFormData(
      formData,
      DomainFormType.DATA_PRODUCT
    ) as CreateDomain & { extension?: Record<string, unknown> };

    expect(result.extension?.stewards).toEqual([userA, userB]);
    expect(result.extension?.tier).toBe('Gold');
    expect(result.extension?.notes).toBe('plain text stays as-is');
    expect(result.extension?.count).toBe(7);
  });
});
