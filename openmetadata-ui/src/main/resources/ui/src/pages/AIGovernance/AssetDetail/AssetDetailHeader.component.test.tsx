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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Operation } from 'fast-json-patch';
import {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import { AIApplication } from '../../../generated/entity/ai/aiApplication';
import { EntityReference as DomainEntityReference } from '../../../generated/entity/type';
import { EntityReference } from '../../../generated/type/entityReference';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { patchAIApplicationDetails } from '../../../rest/aiApplicationAPI';
import { AIAssetView } from './AssetDetail.types';
import { AssetDetailHeader } from './AssetDetailHeader.component';

const labels: Record<string, string> = {
  'label.display-name': 'Display Name',
  'label.description': 'Description',
  'label.edit-entity': 'Edit entity',
  'label.owner-plural': 'Owners',
  'label.domain-plural': 'Domains',
  'label.tag-plural': 'Tags',
  'label.no-description': 'No description',
  'label.share': 'Share',
  'label.reassess': 'Reassess',
  'label.save': 'Save',
  'label.cancel': 'Cancel',
  'server.update-entity-success': 'Updated',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => labels[key] ?? key,
  }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../rest/aiApplicationAPI', () => ({
  patchAIApplicationDetails: jest.fn(),
}));

jest.mock('../../../rest/llmModelAPI', () => ({
  patchLLMModelDetails: jest.fn(),
}));

jest.mock('../../../rest/mcpServerAPI', () => ({
  patchMcpServerDetails: jest.fn(),
}));

jest.mock('../../../components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: ({
    onUpdate,
  }: {
    onUpdate?: (owners?: EntityReference[]) => void;
  }) => (
    <button
      data-testid="mock-owner-update"
      onClick={() =>
        onUpdate?.([{ id: 'owner-id', name: 'Ada', type: 'user' }])
      }>
      Owners
    </button>
  ),
}));

jest.mock(
  '../../../components/common/DomainLabel/DomainLabel.component',
  () => ({
    DomainLabel: ({
      onUpdate,
    }: {
      onUpdate?: (
        domain: DomainEntityReference | DomainEntityReference[]
      ) => void;
    }) => (
      <button
        data-testid="mock-domain-update"
        onClick={() =>
          onUpdate?.({
            id: 'domain-id',
            name: 'AI Governance',
            fullyQualifiedName: 'AI Governance',
            type: 'domain',
          })
        }>
        Domains
      </button>
    ),
  })
);

jest.mock('../../../components/common/TagsSection/TagsSection', () => ({
  __esModule: true,
  default: ({
    onTagsUpdate,
  }: {
    onTagsUpdate?: (updatedTags: TagLabel[]) => Promise<TagLabel[] | undefined>;
  }) => (
    <button
      data-testid="mock-tags-update"
      onClick={() =>
        onTagsUpdate?.([
          {
            tagFQN: 'PII.Sensitive',
            source: TagSource.Classification,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ])
      }>
      Tags
    </button>
  ),
}));

jest.mock('../components/AIGovUntitled.component', () => ({
  Button: ({
    children,
    type: _type,
    ...props
  }: {
    children?: ReactNode;
    type?: string;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Card: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <section className={className}>{children}</section>,
  Input: Object.assign(
    ({
      value,
      onChange,
      ...props
    }: {
      value?: string;
      onChange?: (event: { target: { value: string } }) => void;
    } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'>) => (
      <input
        {...props}
        value={value}
        onChange={(event) =>
          onChange?.({ target: { value: event.target.value } })
        }
      />
    ),
    {
      TextArea: ({
        minRows: _minRows,
        value,
        onChange,
        ...props
      }: {
        minRows?: number;
        value?: string;
        onChange?: (event: { target: { value: string } }) => void;
      } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'>) => (
        <textarea
          {...props}
          value={value}
          onChange={(event) =>
            onChange?.({ target: { value: event.target.value } })
          }
        />
      ),
    }
  ),
  Modal: ({
    cancelText,
    children,
    okText,
    open,
    title,
    onCancel,
    onOk,
  }: {
    cancelText?: ReactNode;
    children?: ReactNode;
    okText?: ReactNode;
    open?: boolean;
    title?: ReactNode;
    onCancel?: () => void;
    onOk?: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <div>{title}</div>
        {children}
        <button onClick={onCancel}>{cancelText}</button>
        <button onClick={onOk}>{okText}</button>
      </div>
    ) : null,
  Space: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  Typography: {
    Paragraph: ({
      children,
      className,
    }: {
      children?: ReactNode;
      className?: string;
    }) => <p className={className}>{children}</p>,
    Text: ({
      children,
      className,
    }: {
      children?: ReactNode;
      className?: string;
    }) => <span className={className}>{children}</span>,
    Title: ({
      children,
      className,
      style,
    }: {
      children?: ReactNode;
      className?: string;
      style?: CSSProperties;
    }) => (
      <h3 className={className} style={style}>
        {children}
      </h3>
    ),
  },
}));

const mockedPatchAIApplicationDetails =
  patchAIApplicationDetails as jest.MockedFunction<
    typeof patchAIApplicationDetails
  >;

const getPatchPaths = () =>
  (mockedPatchAIApplicationDetails.mock.calls[0][1] as Operation[]).map(
    (op) => op.path
  );

const expectPatchPathForField = async (fieldPath: string) =>
  waitFor(() =>
    expect(getPatchPaths().some((path) => path.startsWith(fieldPath))).toBe(
      true
    )
  );

const view: AIAssetView = {
  id: 'app-id',
  name: 'claims-triage-copilot',
  displayName: 'Claims Triage Copilot',
  fullyQualifiedName: 'claims-triage-copilot',
  description: 'Original description',
  entityType: 'aiApplication',
  owners: [],
  tags: [],
  domains: [],
  highRiskAnnexes: [],
  regions: [],
  accessesPii: true,
  accessesSensitive: true,
  dataCategories: [],
  frameworkSummaries: [],
  metrics: {},
  complianceRecords: [],
  source: {
    kind: 'aiApplication',
    entity: {
      id: 'app-id',
      name: 'claims-triage-copilot',
      displayName: 'Claims Triage Copilot',
      fullyQualifiedName: 'claims-triage-copilot',
      description: 'Original description',
      applicationType: 'Copilot',
      modelConfigurations: [],
    } as AIApplication,
  },
};

describe('AssetDetailHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPatchAIApplicationDetails.mockResolvedValue(view.source.entity);
  });

  it('patches editable display name and description fields', async () => {
    render(<AssetDetailHeader view={view} onReload={jest.fn()} />);

    fireEvent.click(screen.getByTestId('ai-gov-edit-description'));
    fireEvent.change(screen.getByTestId('ai-gov-description-input'), {
      target: { value: 'Updated description' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(mockedPatchAIApplicationDetails).toHaveBeenCalledWith(
        'app-id',
        expect.arrayContaining([
          expect.objectContaining({
            path: '/description',
            value: 'Updated description',
          }),
        ])
      )
    );

    jest.clearAllMocks();
    mockedPatchAIApplicationDetails.mockResolvedValue(view.source.entity);

    fireEvent.click(screen.getByTestId('ai-gov-edit-display-name'));
    fireEvent.change(screen.getByTestId('ai-gov-display-name-input'), {
      target: { value: 'Claims Triage Studio' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(mockedPatchAIApplicationDetails).toHaveBeenCalledWith(
        'app-id',
        expect.arrayContaining([
          expect.objectContaining({
            path: '/displayName',
            value: 'Claims Triage Studio',
          }),
        ])
      )
    );
  });

  it('patches owner, domain, and tag edits from header controls', async () => {
    render(<AssetDetailHeader view={view} onReload={jest.fn()} />);

    fireEvent.click(screen.getByTestId('mock-owner-update'));

    await expectPatchPathForField('/owners');

    jest.clearAllMocks();
    mockedPatchAIApplicationDetails.mockResolvedValue(view.source.entity);

    fireEvent.click(screen.getByTestId('mock-domain-update'));

    await expectPatchPathForField('/domains');

    jest.clearAllMocks();
    mockedPatchAIApplicationDetails.mockResolvedValue(view.source.entity);

    fireEvent.click(screen.getByTestId('mock-tags-update'));

    await expectPatchPathForField('/tags');
  });
});
