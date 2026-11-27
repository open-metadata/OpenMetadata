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
import { FC } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AutoClassificationTag } from './auto-classification-tag';
import { ClassificationTag } from './classification-tag';
import { DataProductTag } from './data-product-tag';
import { DomainTag } from './domain-tag';
import { GlossaryTag } from './glossary-tag';
import { MetricTag } from './metric-tag';
import { EntityTagProps } from './tag.types';

// The test env has no i18n instance, so `t` would return the bare key and
// hide whether the chip label is interpolated into the button name.
vi.mock('@/i18n/useCoreTranslation', () => ({
  useCoreTranslation: () => ({
    t: (key: string, options?: { entity?: string }) =>
      `${key}:${options?.entity}`,
  }),
}));

const TAGS: [string, FC<EntityTagProps>][] = [
  ['AutoClassificationTag', AutoClassificationTag],
  ['ClassificationTag', ClassificationTag],
  ['DataProductTag', DataProductTag],
  ['DomainTag', DomainTag],
  ['GlossaryTag', GlossaryTag],
  ['MetricTag', MetricTag],
];

describe('entity tag close button', () => {
  it.each(TAGS)('%s names its remove button after the chip label', (_, Tag) => {
    render(<Tag label="Engineering" onDelete={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'label.remove-entity:Engineering' })
    ).toBeInTheDocument();
  });
});
