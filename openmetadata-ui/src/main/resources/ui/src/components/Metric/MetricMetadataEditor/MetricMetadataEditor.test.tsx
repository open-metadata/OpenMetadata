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
import type { DataAssetRuleValidation } from '../../../context/RuleEnforcementProvider/RuleEnforcementProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import type { EntityReference } from '../../../generated/entity/type';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import MetricMetadataEditor from './MetricMetadataEditor';

jest.mock('../../../hooks/useEntityRules');

const defaultEntityRules: DataAssetRuleValidation = {
  canAddMultipleDataProducts: true,
  canAddMultipleDomains: true,
  canAddMultipleGlossaryTerm: true,
  canAddMultipleTeamOwner: true,
  canAddMultipleUserOwners: true,
  maxDataProducts: Infinity,
  maxDomains: Infinity,
  requireDomainForDataProduct: false,
};

const ownerTeam: EntityReference = {
  id: 'owner-team',
  name: 'owner-team',
  type: EntityType.TEAM,
};

const ownerThree: EntityReference = {
  id: 'owner-three',
  name: 'owner-three',
  type: EntityType.USER,
};

const selectedByLabel: Record<string, EntityReference> = {
  'label.owner-plural': {
    id: 'owner-two',
    name: 'owner-two',
    type: 'user',
  },
  'label.expert-plural': {
    id: 'expert-two',
    name: 'expert-two',
    type: 'user',
  },
  'label.reviewer-plural': {
    id: 'reviewer-two',
    name: 'reviewer-two',
    type: 'user',
  },
  'label.domain-plural': {
    fullyQualifiedName: 'Marketing.Analytics',
    id: 'domain-two',
    name: 'domain-two',
    type: 'domain',
  },
  'label.data-product-plural': {
    fullyQualifiedName: 'Marketing.Analytics.Customer360',
    id: 'data-product-two',
    name: 'data-product-two',
    type: 'dataProduct',
  },
  'label.tier': {
    fullyQualifiedName: 'Tier.Tier2',
    id: 'Tier.Tier2',
    name: 'Tier2',
    type: 'tag',
  },
  'label.glossary-term-plural': {
    fullyQualifiedName: 'Business.GrossMargin',
    id: 'Business.GrossMargin',
    name: 'GrossMargin',
    type: 'glossaryTerm',
  },
  'label.tag-plural': {
    fullyQualifiedName: 'PII.Sensitive',
    id: 'PII.Sensitive',
    name: 'Sensitive',
    type: 'tag',
  },
};

jest.mock('../MetricReferencePicker/MetricReferencePicker', () => ({
  __esModule: true,
  default: ({
    isDisabled,
    label,
    maxSelections,
    onChange,
    optionFilter,
    queryFilter,
    selectionResolver,
    selected,
  }: {
    isDisabled?: boolean;
    label: string;
    maxSelections?: number;
    onChange: (references: EntityReference[]) => void;
    optionFilter?: (reference: EntityReference) => boolean;
    queryFilter?: Record<string, unknown>;
    selectionResolver?: (
      selected: EntityReference[],
      reference: EntityReference,
      isSelected: boolean
    ) => EntityReference[];
    selected: EntityReference[];
  }) => (
    <div
      data-max-selections={maxSelections}
      data-option-accepted={
        optionFilter ? optionFilter(selectedByLabel[label]) : undefined
      }
      data-query-filter={queryFilter ? JSON.stringify(queryFilter) : undefined}
      data-testid={`picker-${label}`}>
      <span data-testid={`selected-${label}`}>
        {selected.map(({ id }) => id).join(',')}
      </span>
      <button
        data-testid={`choose-${label}`}
        disabled={isDisabled}
        onClick={() => onChange([selectedByLabel[label]])}>
        choose
      </button>
      {label === 'label.owner-plural' && selectionResolver && (
        <>
          <button
            data-testid="choose-owner-team"
            disabled={isDisabled}
            onClick={() =>
              onChange(selectionResolver(selected, ownerTeam, true))
            }>
            choose team
          </button>
          <button
            data-testid="choose-owner-user"
            disabled={isDisabled}
            onClick={() =>
              onChange(selectionResolver(selected, ownerThree, true))
            }>
            choose user
          </button>
        </>
      )}
    </div>
  ),
}));

const metric: Metric = {
  id: 'metric-id',
  name: 'gross_margin',
  owners: [{ id: 'owner-one', name: 'owner-one', type: 'user' }],
  dataProducts: [
    {
      fullyQualifiedName: 'Marketing.Customer360',
      id: 'data-product-one',
      name: 'data-product-one',
      type: 'dataProduct',
    },
  ],
  domains: [
    {
      fullyQualifiedName: 'Marketing',
      id: 'domain-one',
      name: 'domain-one',
      type: 'domain',
    },
  ],
  extension: {
    thresholds: { critical: 50, warning: 75 },
  },
  tags: [
    {
      labelType: LabelType.Manual,
      source: TagSource.Classification,
      state: State.Confirmed,
      tagFQN: 'Tier.Tier1',
    },
    {
      labelType: LabelType.Manual,
      source: TagSource.Glossary,
      state: State.Confirmed,
      tagFQN: 'Business.Revenue',
    },
    {
      labelType: LabelType.Manual,
      source: TagSource.Classification,
      state: State.Confirmed,
      tagFQN: 'PII.NonSensitive',
    },
  ],
};

describe('MetricMetadataEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useEntityRules as jest.Mock).mockReturnValue({
      entityRules: defaultEntityRules,
      isLoading: false,
      rules: [],
    });
  });

  it('does not expose metadata editing without permission or for a deleted Metric', () => {
    const { rerender } = render(
      <MetricMetadataEditor
        metric={metric}
        permissions={DEFAULT_ENTITY_PERMISSION}
        onUpdate={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('edit-metric-metadata')
    ).not.toBeInTheDocument();

    rerender(
      <MetricMetadataEditor
        metric={{ ...metric, deleted: true }}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, EditAll: true }}
        onUpdate={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('edit-metric-metadata')
    ).not.toBeInTheDocument();
  });

  it('preserves structured custom properties and gates their edit flow independently', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    render(
      <MetricMetadataEditor
        metric={metric}
        permissions={{
          ...DEFAULT_ENTITY_PERMISSION,
          EditCustomFields: true,
        }}
        onUpdate={onUpdate}
      />
    );

    const editButton = screen.getByTestId('edit-metric-metadata');

    expect(editButton).toHaveAccessibleName('label.edit');
    expect(editButton).not.toHaveTextContent('label.edit');

    fireEvent.click(editButton);
    const extensionInput = screen.getByRole('textbox', {
      name: 'label.custom-property-plural',
    });

    expect(extensionInput).toHaveValue(
      JSON.stringify(metric.extension, null, 2)
    );
    expect(
      screen.queryByTestId('picker-label.owner-plural')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('picker-label.data-product-plural')
    ).not.toBeInTheDocument();

    fireEvent.change(extensionInput, {
      target: { value: '{"thresholds":{"warning":80},"enabled":true}' },
    });
    fireEvent.click(screen.getByTestId('save-metric-metadata'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          dataProducts: metric.dataProducts,
          extension: { enabled: true, thresholds: { warning: 80 } },
          owners: metric.owners,
          tags: metric.tags,
        })
      )
    );
  });

  it('updates owners, experts, reviewers, domains, data products, tier, glossary terms, and tags under EditAll', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    render(
      <MetricMetadataEditor
        metric={metric}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, EditAll: true }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-metric-metadata'));
    Object.keys(selectedByLabel).forEach((label) =>
      fireEvent.click(screen.getByTestId(`choose-${label}`))
    );

    expect(screen.getByTestId('picker-label.tier')).toHaveAttribute(
      'data-option-accepted',
      'true'
    );
    expect(screen.getByTestId('picker-label.tag-plural')).toHaveAttribute(
      'data-option-accepted',
      'true'
    );

    fireEvent.click(screen.getByTestId('save-metric-metadata'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        dataProducts: [expect.objectContaining({ id: 'data-product-two' })],
        domains: [expect.objectContaining({ id: 'domain-two' })],
        experts: [expect.objectContaining({ id: 'expert-two' })],
        owners: [expect.objectContaining({ id: 'owner-two' })],
        reviewers: [expect.objectContaining({ id: 'reviewer-two' })],
        tags: expect.arrayContaining([
          expect.objectContaining({
            source: TagSource.Classification,
            tagFQN: 'Tier.Tier2',
          }),
          expect.objectContaining({
            source: TagSource.Glossary,
            tagFQN: 'Business.GrossMargin',
          }),
          expect.objectContaining({
            source: TagSource.Classification,
            tagFQN: 'PII.Sensitive',
          }),
        ]),
      })
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId('metric-metadata-edit-dialog')
      ).not.toBeInTheDocument()
    );
  });

  it('enforces Metric data asset rules and scopes data product search to the selected domain', () => {
    (useEntityRules as jest.Mock).mockReturnValue({
      entityRules: {
        ...defaultEntityRules,
        canAddMultipleDataProducts: false,
        canAddMultipleDomains: false,
        canAddMultipleGlossaryTerm: false,
        canAddMultipleTeamOwner: false,
        maxDataProducts: 1,
        maxDomains: 1,
        requireDomainForDataProduct: true,
      },
      isLoading: false,
      rules: [],
    });
    render(
      <MetricMetadataEditor
        metric={metric}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, EditAll: true }}
        onUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('edit-metric-metadata'));

    expect(useEntityRules).toHaveBeenCalledWith(EntityType.METRIC);
    expect(screen.getByTestId('picker-label.domain-plural')).toHaveAttribute(
      'data-max-selections',
      '1'
    );
    expect(
      screen.getByTestId('picker-label.data-product-plural')
    ).toHaveAttribute('data-max-selections', '1');
    expect(
      screen.getByTestId('picker-label.glossary-term-plural')
    ).toHaveAttribute('data-max-selections', '1');
    expect(
      screen.getByTestId('picker-label.data-product-plural')
    ).toHaveAttribute(
      'data-query-filter',
      expect.stringContaining('Marketing')
    );

    fireEvent.click(screen.getByTestId('choose-owner-user'));

    expect(screen.getByTestId('selected-label.owner-plural')).toHaveTextContent(
      'owner-one,owner-three'
    );

    fireEvent.click(screen.getByTestId('choose-owner-team'));

    expect(screen.getByTestId('selected-label.owner-plural')).toHaveTextContent(
      'owner-team'
    );

    fireEvent.click(screen.getByTestId('choose-owner-user'));

    expect(screen.getByTestId('selected-label.owner-plural')).toHaveTextContent(
      'owner-three'
    );

    fireEvent.click(screen.getByTestId('choose-label.domain-plural'));

    expect(
      screen.getByTestId('selected-label.data-product-plural')
    ).toBeEmptyDOMElement();
  });

  it('keeps rule-governed references multi-selectable when the rules allow it', () => {
    render(
      <MetricMetadataEditor
        metric={metric}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, EditAll: true }}
        onUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('edit-metric-metadata'));

    expect(
      screen.getByTestId('picker-label.domain-plural')
    ).not.toHaveAttribute('data-max-selections');
    expect(
      screen.getByTestId('picker-label.data-product-plural')
    ).not.toHaveAttribute('data-max-selections');
    expect(
      screen.getByTestId('picker-label.glossary-term-plural')
    ).not.toHaveAttribute('data-max-selections');
    expect(
      screen.getByTestId('picker-label.data-product-plural')
    ).not.toHaveAttribute('data-query-filter');

    fireEvent.click(screen.getByTestId('choose-owner-user'));
    fireEvent.click(screen.getByTestId('choose-owner-team'));

    expect(screen.getByTestId('selected-label.owner-plural')).toHaveTextContent(
      'owner-one,owner-three,owner-team'
    );
  });

  it('requires a domain before selecting a data product when the rule is enabled', () => {
    (useEntityRules as jest.Mock).mockReturnValue({
      entityRules: {
        ...defaultEntityRules,
        requireDomainForDataProduct: true,
      },
      isLoading: false,
      rules: [],
    });
    render(
      <MetricMetadataEditor
        metric={{ ...metric, domains: [] }}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, EditAll: true }}
        onUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('edit-metric-metadata'));

    expect(
      screen.getByText('message.select-domain-to-add-data-product')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('choose-label.data-product-plural')
    ).toBeDisabled();
    expect(
      screen.getByTestId('selected-label.data-product-plural')
    ).toBeEmptyDOMElement();
  });

  it('resets an unsaved data product edit when the dialog is reopened', () => {
    render(
      <MetricMetadataEditor
        metric={metric}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, EditAll: true }}
        onUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('edit-metric-metadata'));

    expect(
      screen.getByTestId('selected-label.data-product-plural')
    ).toHaveTextContent('data-product-one');

    fireEvent.click(screen.getByTestId('choose-label.data-product-plural'));

    expect(
      screen.getByTestId('selected-label.data-product-plural')
    ).toHaveTextContent('data-product-two');

    fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
    fireEvent.click(screen.getByTestId('edit-metric-metadata'));

    expect(
      screen.getByTestId('selected-label.data-product-plural')
    ).toHaveTextContent('data-product-one');
  });

  it('rejects malformed or non-object custom-property JSON', async () => {
    const onUpdate = jest.fn();
    render(
      <MetricMetadataEditor
        metric={metric}
        permissions={{
          ...DEFAULT_ENTITY_PERMISSION,
          EditCustomFields: true,
        }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-metric-metadata'));
    const extensionInput = screen.getByRole('textbox', {
      name: 'label.custom-property-plural',
    });
    fireEvent.change(extensionInput, {
      target: { value: '[]' },
    });
    fireEvent.click(screen.getByTestId('save-metric-metadata'));

    expect(
      await screen.findByText('message.manifest-invalid-json')
    ).toBeInTheDocument();
    expect(extensionInput).toHaveAttribute('aria-invalid', 'true');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('locks inputs during a mutation and keeps a failed edit open', async () => {
    let rejectUpdate: (error: Error) => void = (_error) => undefined;
    const onUpdate = jest.fn().mockReturnValue(
      new Promise((_, reject) => {
        rejectUpdate = reject;
      })
    );
    render(
      <MetricMetadataEditor
        metric={metric}
        permissions={{ ...DEFAULT_ENTITY_PERMISSION, EditAll: true }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('edit-metric-metadata'));
    fireEvent.click(screen.getByTestId('save-metric-metadata'));

    expect(screen.getByTestId('save-metric-metadata')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByTestId('choose-label.owner-plural')).toBeDisabled();
    expect(
      screen.getByTestId('choose-label.data-product-plural')
    ).toBeDisabled();

    rejectUpdate(new Error('save failed'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByTestId('metric-metadata-edit-dialog')
    ).toBeInTheDocument();
  });
});
