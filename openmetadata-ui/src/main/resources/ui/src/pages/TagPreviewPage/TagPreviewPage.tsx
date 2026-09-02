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

/**
 * DEV-ONLY preview page — NOT for production.
 * Navigate to /tag-preview to verify Tag component variants visually.
 */

import { Typography } from '@openmetadata/ui-core-components';
import { useState } from 'react';
import Tag from '../../components/common/atoms/Tag/Tag';
import Tags from '../../components/Tag/Tags/Tags';
import { DisplayType } from '../../components/Tag/Tags/Tags.interface';
import { TagSource } from '../../generated/type/tagLabel';

// ─── Static data ─────────────────────────────────────────────────────────────

const PALETTE = [
  '#1470EF',
  '#7D81E9',
  '#F14C75',
  '#05C4EA',
  '#05A580',
  '#FFB01A',
  '#BF4CF1',
];

const MOCK_CLASSIFICATION_TAGS = [
  {
    tagFQN: 'PII.Sensitive',
    source: TagSource.Classification,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'Sensitive',
    displayName: 'Sensitive',
    description: 'Personally Identifiable Information — Sensitive data.',
    style: { color: '#F14C75' },
  },
  {
    tagFQN: 'Certification.Gold',
    source: TagSource.Classification,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'Gold',
    displayName: 'Gold',
    description: 'Gold certification.',
    style: { color: '#FFB01A' },
  },
  {
    tagFQN: 'Quality.Verified',
    source: TagSource.Classification,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'Verified',
    displayName: 'Verified',
    description: 'Quality verified.',
    style: {},
  },
  {
    tagFQN: 'Tier.Tier1',
    source: TagSource.Classification,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'Tier1',
    displayName: 'Tier 1',
    description: 'Top-tier asset.',
    style: { color: '#7D81E9' },
  },
  {
    tagFQN: 'Security.Confidential',
    source: TagSource.Classification,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'Confidential',
    displayName: 'Confidential',
    description: 'Confidential data.',
    style: { color: '#1470EF' },
  },
  {
    tagFQN: 'Category.Finance',
    source: TagSource.Classification,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'Finance',
    displayName: 'Finance',
    description: 'Finance category.',
    style: { color: '#05A580' },
  },
];

const MOCK_GLOSSARY_TAGS = [
  {
    tagFQN: 'BusinessGlossary.Revenue',
    source: TagSource.Glossary,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'Revenue',
    displayName: 'Revenue',
    description: 'Revenue-related glossary term.',
    style: {},
  },
  {
    tagFQN: 'BusinessGlossary.Customer',
    source: TagSource.Glossary,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'Customer',
    displayName: 'Customer',
    description: 'Customer glossary term.',
    style: {},
  },
  {
    tagFQN: 'BusinessGlossary.Acquisition',
    source: TagSource.Glossary,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'Acquisition',
    displayName: 'Acquisition',
    description: 'Acquisition glossary term.',
    style: {},
  },
  {
    tagFQN: 'TechGlossary.MicroService',
    source: TagSource.Glossary,
    labelType: 'Manual' as const,
    state: 'Confirmed' as const,
    name: 'MicroService',
    displayName: 'Micro Service',
    description: 'Micro service architecture term.',
    style: {},
  },
];

const ALL_TAGS = [...MOCK_CLASSIFICATION_TAGS, ...MOCK_GLOSSARY_TAGS];

// ─── Sub-sections ─────────────────────────────────────────────────────────────

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="tw:mb-10">
    <Typography
      className="tw:mb-4 tw:border-b tw:border-b-secondary tw:pb-2"
      size="text-lg"
      weight="semibold">
      {title}
    </Typography>
    <div className="tw:flex tw:flex-col tw:gap-6">{children}</div>
  </section>
);

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="tw:flex tw:items-start tw:gap-4">
    <span className="tw:w-52 tw:shrink-0 tw:text-xs tw:text-tertiary tw:font-mono tw:pt-1">
      {label}
    </span>
    <div className="tw:flex tw:flex-wrap tw:gap-2 tw:items-center">
      {children}
    </div>
  </div>
);

// ─── Deletable wrapper (tracks local state) ───────────────────────────────────

const DeletableTagDemo = ({
  label,
  ...props
}: React.ComponentProps<typeof Tag>) => {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <button
        className="tw:text-xs tw:text-primary tw:bg-transparent tw:border-0 tw:cursor-pointer"
        onClick={() => setVisible(true)}>
        + restore {label}
      </button>
    );
  }

  return (
    <Tag
      {...props}
      label={label}
      onDelete={() => setVisible(false)}
    />
  );
};

// ─── Tags container demo ──────────────────────────────────────────────────────

const TagsSelectorDemo = () => {
  const [tags, setTags] = useState(ALL_TAGS.slice(0, 3));

  return (
    <Tags
      mode="selector"
      permission
      tagType={TagSource.Classification}
      tags={tags}
      onSelectionChange={async (updated) => {
        setTags(updated);
      }}
    />
  );
};

const GlossarySelectorDemo = () => {
  const [tags, setTags] = useState(MOCK_GLOSSARY_TAGS.slice(0, 2));

  return (
    <Tags
      mode="selector"
      permission
      tagType={TagSource.Glossary}
      tags={tags}
      onSelectionChange={async (updated) => {
        setTags(updated);
      }}
    />
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const TagPreviewPage = () => {
  return (
    <div className="tw:max-w-5xl tw:mx-auto tw:p-8">
      <Typography className="tw:mb-2" size="display-xs" weight="semibold">
        Tag Component Preview
      </Typography>
      <Typography className="tw:mb-8 tw:text-tertiary" size="text-sm">
        Dev-only. All variants · all sizes · display and selector modes.
      </Typography>

      {/* ── 1. ATOM: Tag variants ── */}
      <Section title="1. Tag atom — variants">
        <Row label="classification (no color)">
          <Tag label="No Color" size="sm" variant="classification" />
          <Tag label="No Color" size="md" variant="classification" />
          <Tag label="No Color" size="lg" variant="classification" />
        </Row>

        <Row label="classification + colors">
          {PALETTE.map((color) => (
            <Tag
              color={color}
              key={color}
              label={color}
              size="sm"
              variant="classification"
            />
          ))}
        </Row>

        <Row label="glossary (always blue-gray)">
          <Tag label="Revenue" size="sm" variant="glossary" />
          <Tag label="Customer" size="md" variant="glossary" />
          <Tag label="Acquisition Term" size="lg" variant="glossary" />
        </Row>

        <Row label="tier (always purple)">
          <Tag label="Tier.Tier1" size="sm" variant="tier" />
          <Tag label="Tier.Tier2" size="md" variant="tier" />
          <Tag label="Tier.Tier3" size="lg" variant="tier" />
        </Row>

        <Row label="domain (2 px left accent)">
          <Tag
            color="#1470EF"
            label="Engineering"
            size="sm"
            variant="domain"
          />
          <Tag color="#05A580" label="Finance" size="md" variant="domain" />
          <Tag color="#BF4CF1" label="Marketing" size="lg" variant="domain" />
          <Tag label="Domain (no color)" size="sm" variant="domain" />
        </Row>

        <Row label="dataProduct (2 px left accent)">
          <Tag
            color="#7D81E9"
            label="Orders Pipeline"
            size="sm"
            variant="dataProduct"
          />
          <Tag
            color="#F14C75"
            label="Customer 360"
            size="md"
            variant="dataProduct"
          />
          <Tag
            label="Data Product (no color)"
            size="sm"
            variant="dataProduct"
          />
        </Row>

        <Row label="pill">
          <Tag label="Pill Gray" size="sm" variant="pill" />
          <Tag label="Pill Gray" size="md" variant="pill" />
          <Tag label="Pill Gray" size="lg" variant="pill" />
        </Row>
      </Section>

      {/* ── 2. ATOM: Icon variants ── */}
      <Section title="2. Tag atom — with / without icon">
        <Row label="default icons per variant">
          <Tag label="Classification" size="sm" variant="classification" />
          <Tag label="Glossary" size="sm" variant="glossary" />
          <Tag label="Tier" size="sm" variant="tier" />
          <Tag label="Domain" size="sm" variant="domain" />
          <Tag label="DataProduct" size="sm" variant="dataProduct" />
        </Row>

        <Row label="showIcon=false">
          <Tag
            label="Classification"
            showIcon={false}
            size="sm"
            variant="classification"
          />
          <Tag
            label="Glossary"
            showIcon={false}
            size="sm"
            variant="glossary"
          />
          <Tag
            color="#1470EF"
            label="Domain"
            showIcon={false}
            size="sm"
            variant="domain"
          />
        </Row>

        <Row label="custom image URL icon">
          <Tag
            color="#1470EF"
            icon="https://www.svgrepo.com/show/513317/tag.svg"
            label="Image Icon"
            size="sm"
            variant="classification"
          />
        </Row>
      </Section>

      {/* ── 3. ATOM: Deletable ── */}
      <Section title="3. Tag atom — deletable (click × to remove, button to restore)">
        <Row label="static variants">
          <DeletableTagDemo label="Glossary Term" size="sm" variant="glossary" />
          <DeletableTagDemo label="Tier.Tier1" size="sm" variant="tier" />
          <DeletableTagDemo label="Pill" size="sm" variant="pill" />
        </Row>

        <Row label="classification + color">
          {PALETTE.slice(0, 4).map((color) => (
            <DeletableTagDemo
              color={color}
              key={color}
              label={color}
              size="sm"
              variant="classification"
            />
          ))}
        </Row>

        <Row label="domain + color">
          <DeletableTagDemo
            color="#1470EF"
            label="Engineering"
            size="sm"
            variant="domain"
          />
          <DeletableTagDemo
            color="#05A580"
            label="Finance"
            size="sm"
            variant="domain"
          />
        </Row>

        <Row label="disabled">
          <Tag
            color="#F14C75"
            disabled
            label="Can't remove"
            size="sm"
            variant="classification"
            onDelete={() => undefined}
          />
          <Tag
            disabled
            label="Can't remove"
            size="sm"
            variant="glossary"
            onDelete={() => undefined}
          />
        </Row>
      </Section>

      {/* ── 4. Tags container — display mode ── */}
      <Section title="4. Tags container — display mode">
        <Row label="classification tags (sizeCap=3)">
          <Tags
            sizeCap={3}
            tagType={TagSource.Classification}
            tags={MOCK_CLASSIFICATION_TAGS}
          />
        </Row>

        <Row label="glossary tags (sizeCap=3)">
          <Tags
            sizeCap={3}
            tagType={TagSource.Glossary}
            tags={MOCK_GLOSSARY_TAGS}
          />
        </Row>

        <Row label="mixed — no tagType filter (sizeCap=5)">
          <Tags sizeCap={5} tags={ALL_TAGS} />
        </Row>

        <Row label="read-more overflow (sizeCap=3)">
          <Tags
            displayType={DisplayType.READ_MORE}
            sizeCap={3}
            tags={ALL_TAGS}
          />
        </Row>

        <Row label="popover overflow (sizeCap=3)">
          <Tags
            displayType={DisplayType.POPOVER}
            sizeCap={3}
            tags={ALL_TAGS}
          />
        </Row>

        <Row label="empty — with placeholder">
          <Tags showNoDataPlaceholder tags={[]} />
        </Row>
      </Section>

      {/* ── 5. Tags container — selector mode ── */}
      <Section title="5. Tags container — selector mode (live)">
        <Row label="classification selector">
          <TagsSelectorDemo />
        </Row>

        <Row label="glossary selector">
          <GlossarySelectorDemo />
        </Row>
      </Section>
    </div>
  );
};

export default TagPreviewPage;
