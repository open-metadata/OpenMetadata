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
 * Navigate to /tag-preview to verify all four Tag component variants.
 */

import { Typography } from '@openmetadata/ui-core-components';
import { useState } from 'react';
import ClassificationTag from '../../components/common/atoms/Tag/ClassificationTag';
import DataProductTag from '../../components/common/atoms/Tag/DataProductTag';
import DomainTag from '../../components/common/atoms/Tag/DomainTag';
import GlossaryTag from '../../components/common/atoms/Tag/GlossaryTag';

const PALETTE = [
  '#175CD3', '#026AA2', '#3538CD', '#5925DC', '#C11574',
  '#B93815', '#414651', '#363F72', '#067647', '#B54708', '#B42318',
];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="tw:mb-10">
    <Typography
      className="tw:mb-4 tw:border-b tw:pb-2"
      size="text-lg"
      weight="semibold">
      {title}
    </Typography>
    <div className="tw:flex tw:flex-col tw:gap-4">{children}</div>
  </section>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="tw:flex tw:items-start tw:gap-4">
    <span className="tw:w-56 tw:shrink-0 tw:text-xs tw:text-tertiary tw:font-mono tw:pt-0.5">
      {label}
    </span>
    <div className="tw:flex tw:flex-wrap tw:gap-2 tw:items-center">{children}</div>
  </div>
);

type TagFC = React.FC<{ label: string; color?: string; onDelete?: (e: Event) => void }>;

const DeletableDemo = ({
  Component,
  label,
  color,
}: {
  Component: TagFC;
  label: string;
  color?: string;
}) => {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <button
        className="tw:text-xs tw:text-primary tw:bg-transparent tw:border-0 tw:cursor-pointer"
        onClick={() => setVisible(true)}>
        + restore
      </button>
    );
  }

  return (
    <Component color={color} label={label} onDelete={() => setVisible(false)} />
  );
};

const TagPreviewPage = () => (
  <div className="tw:max-w-5xl tw:mx-auto tw:p-8">
    <Typography className="tw:mb-2" size="display-xs" weight="semibold">
      Tag Component Preview
    </Typography>
    <Typography className="tw:mb-8 tw:text-tertiary" size="text-sm">
      DEV-ONLY · All four variants · xs/sm/md sizes · default + palette colors
    </Typography>

    {/* Classification */}
    <Section title="ClassificationTag — chip, rounded-md, bg + border">
      <Row label="sizes (default color)">
        <ClassificationTag label="XS 10px/16px" size="xs" />
        <ClassificationTag label="SM 12px/20px" size="sm" />
        <ClassificationTag label="MD 14px/24px" size="md" />
      </Row>
      <Row label="palette colors (sm)">
        {PALETTE.map((c) => (
          <ClassificationTag color={c} key={c} label={c} size="sm" />
        ))}
      </Row>
      <Row label="deletable (sm)">
        {PALETTE.slice(0, 5).map((c) => (
          <DeletableDemo Component={ClassificationTag} color={c} key={c} label={c} />
        ))}
      </Row>
    </Section>

    {/* Glossary */}
    <Section title="GlossaryTag — pill, rounded-full, bg + border">
      <Row label="sizes (default color)">
        <GlossaryTag label="XS 10px/16px" size="xs" />
        <GlossaryTag label="SM 12px/20px" size="sm" />
        <GlossaryTag label="MD 14px/24px" size="md" />
      </Row>
      <Row label="palette colors (sm)">
        {PALETTE.map((c) => (
          <GlossaryTag color={c} key={c} label={c} size="sm" />
        ))}
      </Row>
      <Row label="deletable (sm)">
        {PALETTE.slice(0, 5).map((c) => (
          <DeletableDemo Component={GlossaryTag} color={c} key={c} label={c} />
        ))}
      </Row>
    </Section>

    {/* Domain */}
    <Section title="DomainTag — modern, 4px left accent, no bg">
      <Row label="sizes (default color)">
        <DomainTag label="XS 10px/16px" size="xs" />
        <DomainTag label="SM 12px/20px" size="sm" />
        <DomainTag label="MD 14px/24px" size="md" />
      </Row>
      <Row label="palette colors (sm)">
        {PALETTE.map((c) => (
          <DomainTag color={c} key={c} label={c} size="sm" />
        ))}
      </Row>
      <Row label="deletable (sm)">
        {PALETTE.slice(0, 5).map((c) => (
          <DeletableDemo Component={DomainTag} color={c} key={c} label={c} />
        ))}
      </Row>
    </Section>

    {/* DataProduct */}
    <Section title="DataProductTag — modern, 4px left accent, no bg">
      <Row label="sizes (default color)">
        <DataProductTag label="XS 10px/16px" size="xs" />
        <DataProductTag label="SM 12px/20px" size="sm" />
        <DataProductTag label="MD 14px/24px" size="md" />
      </Row>
      <Row label="palette colors (sm)">
        {PALETTE.map((c) => (
          <DataProductTag color={c} key={c} label={c} size="sm" />
        ))}
      </Row>
      <Row label="deletable (sm)">
        {PALETTE.slice(0, 5).map((c) => (
          <DeletableDemo Component={DataProductTag} color={c} key={c} label={c} />
        ))}
      </Row>
    </Section>
  </div>
);

export default TagPreviewPage;
