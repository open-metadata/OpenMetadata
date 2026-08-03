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
import type { Metric } from '../../../generated/entity/data/metric';
import type { EntityReference } from '../../../generated/entity/type';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import MetricMetadataEditor from './MetricMetadataEditor';

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
    id: 'domain-two',
    name: 'domain-two',
    type: 'domain',
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
    onChange,
    selected,
  }: {
    isDisabled?: boolean;
    label: string;
    onChange: (references: EntityReference[]) => void;
    selected: EntityReference[];
  }) => (
    <div data-testid={`picker-${label}`}>
      <span>{selected.map(({ id }) => id).join(',')}</span>
      <button
        data-testid={`choose-${label}`}
        disabled={isDisabled}
        onClick={() => onChange([selectedByLabel[label]])}>
        choose
      </button>
    </div>
  ),
}));

const metric: Metric = {
  id: 'metric-id',
  name: 'gross_margin',
  owners: [{ id: 'owner-one', name: 'owner-one', type: 'user' }],
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

    fireEvent.change(extensionInput, {
      target: { value: '{"thresholds":{"warning":80},"enabled":true}' },
    });
    fireEvent.click(screen.getByTestId('save-metric-metadata'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: { enabled: true, thresholds: { warning: 80 } },
          owners: metric.owners,
          tags: metric.tags,
        })
      )
    );
  });

  it('updates owners, experts, reviewers, domain, tier, glossary terms, and tags under EditAll', async () => {
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
    fireEvent.click(screen.getByTestId('save-metric-metadata'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
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
    let rejectUpdate: (error: Error) => void = () => undefined;
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

    rejectUpdate(new Error('save failed'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByTestId('metric-metadata-edit-dialog')
    ).toBeInTheDocument();
  });
});
