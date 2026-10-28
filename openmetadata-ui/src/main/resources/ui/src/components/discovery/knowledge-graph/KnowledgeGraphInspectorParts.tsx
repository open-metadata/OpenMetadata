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

import {
  Badge,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronRight,
  Database01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { ReactNode } from 'react';
import { getColorSetForType } from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import { getNodeIcon } from './GraphElements/CustomNode';
import { getRelationStyle, RelationCategory } from './KnowledgeGraph.relations';

/** Every icon in the set shares one component type; any member stands in for it. */
type IconComponent = typeof Database01;

interface TileProps {
  icon: IconComponent;
  color: string;
  background: string;
  size?: 'md' | 'sm';
}

/** The tinted icon square the design puts in front of every panel title and row. */
export const InspectorTile = ({
  icon: Icon,
  color,
  background,
  size = 'md',
}: TileProps) => (
  <span
    aria-hidden="true"
    className={classNames(
      'kg-inspector-tile',
      'kg-inspector-tile-' + size,
      size === 'md' && 'tw:mt-1 tw:mr-1'
    )}
    style={{ color, backgroundColor: background, borderColor: color }}>
    <Icon aria-hidden="true" size={size === 'md' ? 18 : 14} />
  </span>
);

export const entityTile = (type: string, size?: TileProps['size']) => {
  const palette = getColorSetForType(type);

  return (
    <InspectorTile
      background={palette.light}
      color={palette.main}
      icon={getNodeIcon(type)}
      size={size}
    />
  );
};

export const relationTile = (
  category: RelationCategory,
  icon: IconComponent,
  size?: TileProps['size']
) => {
  const style = getRelationStyle(category);

  return (
    <InspectorTile
      background={style.labelBg}
      color={style.color}
      icon={icon}
      size={size}
    />
  );
};

interface StatementProps {
  statement: ReactNode;
  code?: string;
  codeTestId?: string;
  /** Dot colour for the family row. Omit together with `family` to hide the row. */
  color?: string;
  /** Family label (e.g. "Ownership · outgoing"). Omit to hide the dot+family row. */
  family?: string;
}

/** The grey card under the header: the statement, its identifier and its family. */
export const InspectorStatement = ({
  statement,
  code,
  codeTestId,
  color,
  family,
}: StatementProps) => (
  <Box className="kg-inspector-statement" direction="col" gap={2}>
    <Typography className="tw:text-secondary" size="text-sm" weight="medium">
      {statement}
    </Typography>
    {code && (
      <Typography
        className="tw:break-all tw:font-mono tw:text-utility-purple-700"
        data-testid={codeTestId}
        size="text-xs"
        weight="medium">
        {code}
      </Typography>
    )}
    {family && (
      <Box align="center" gap={2}>
        <span
          aria-hidden="true"
          className="kg-inspector-dot"
          style={{ backgroundColor: color }}
        />
        <Typography className="tw:text-tertiary" size="text-xs" weight="medium">
          {family}
        </Typography>
      </Box>
    )}
  </Box>
);

interface IdentityCardProps {
  /** Short caps label above the identifier — e.g. "FULL PATH", "USERNAME", "FQN". */
  fieldLabel: string;
  /** Identifier value rendered in mono. */
  value: string;
  /** Dot colour matching the type palette. */
  color: string;
  /** Family label — e.g. "Table", "User", "Database Schema". */
  family: string;
  valueTestId?: string;
}

/**
 * Identity card for an entity selection: a labelled identifier and a type pill.
 * Replaces the sentence-shaped InspectorStatement for entity drawers.
 */
export const InspectorIdentityCard = ({
  fieldLabel,
  value,
  color,
  family,
  valueTestId,
}: IdentityCardProps) => (
  <Box className="kg-inspector-statement" direction="col" gap={2}>
    <Typography
      className="tw:tracking-[0.08em] tw:text-quaternary tw:uppercase"
      size="text-xs"
      weight="semibold">
      {fieldLabel}
    </Typography>
    <Typography
      className="tw:break-all tw:font-mono tw:text-utility-purple-700"
      data-testid={valueTestId}
      size="text-xs"
      weight="medium">
      {value}
    </Typography>
    <Box align="center" gap={2}>
      <span
        aria-hidden="true"
        className="kg-inspector-dot"
        style={{ backgroundColor: color }}
      />
      <Typography className="tw:text-tertiary" size="text-xs" weight="medium">
        {family}
      </Typography>
    </Box>
  </Box>
);

interface KeyValueProps {
  label: string;
  value: ReactNode;
  valueTestId?: string;
}

/** A plain `Label: value` row for drawer meta like "Team: Finance" or "System name: upstream". */
export const InspectorKeyValue = ({
  label,
  value,
  valueTestId,
}: KeyValueProps) => (
  <Box align="baseline" gap={2}>
    <Typography className="tw:text-tertiary" size="text-sm">
      {label + ':'}
    </Typography>
    <Typography
      className="tw:break-all tw:text-primary"
      data-testid={valueTestId}
      size="text-sm">
      {value}
    </Typography>
  </Box>
);

interface GapNoteProps {
  tone: 'warning' | 'success';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  actionTestId?: string;
}

/** Full-width gap callout: an icon, a short status, and an optional CTA. */
export const InspectorGapNote = ({
  tone,
  text,
  actionLabel,
  onAction,
  actionHref,
  actionTestId,
}: GapNoteProps) => {
  const Icon = tone === 'warning' ? AlertTriangle : CheckCircle;
  const toneClass =
    tone === 'warning'
      ? 'tw:border-utility-warning-200 tw:bg-utility-warning-50 tw:text-utility-warning-700'
      : 'tw:border-utility-success-200 tw:bg-utility-success-50 tw:text-utility-success-700';

  return (
    <Box
      align="center"
      className={classNames(
        'tw:rounded-md tw:border tw:px-3 tw:py-2',
        toneClass
      )}
      gap={2}
      justify="between">
      <Box align="center" className="tw:min-w-0 tw:flex-1" gap={2}>
        <Icon aria-hidden="true" size={16} />
        <Typography className="tw:text-current" size="text-sm" weight="medium">
          {text}
        </Typography>
      </Box>
      {actionLabel && (actionHref || onAction) && (
        <Button
          color="secondary"
          data-testid={actionTestId}
          href={actionHref}
          rel={actionHref ? 'noopener noreferrer' : undefined}
          size="sm"
          target={actionHref ? '_blank' : undefined}
          onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

interface SectionProps {
  title: string;
  meta?: string;
  children: ReactNode;
}

export const InspectorSection = ({ title, meta, children }: SectionProps) => (
  <Box direction="col" gap={2}>
    <Box align="center" className="tw:mt-0.5" gap={2} justify="between">
      <Typography
        className="tw:tracking-[0.08em] tw:text-quaternary tw:uppercase"
        size="text-xs"
        weight="semibold">
        {title}
      </Typography>
      {meta && (
        <Typography className="tw:text-quaternary" size="text-xs">
          {meta}
        </Typography>
      )}
    </Box>
    <Box direction="col" gap={2}>
      {children}
    </Box>
  </Box>
);

interface RelationshipRowProps {
  tile: ReactNode;
  subject: string;
  predicate: string;
  object: string;
  isDisabled?: boolean;
  onPress?: () => void;
}

/**
 * Full relationship row in the drawer: tile, then `subject → [predicate pill]
 * → object` with a trailing chevron. Subject + object render as emphasised
 * entity text; the predicate wears a bordered pill so the triple reads as the
 * same statement the user picked out of the canvas. Wraps on narrow drawers.
 */
export const InspectorRelationshipRow = ({
  tile,
  subject,
  predicate,
  object,
  isDisabled,
  onPress,
}: RelationshipRowProps) => (
  <button
    className={classNames(
      'kg-inspector-row kg-inspector-rel-row',
      'tw:flex tw:w-full tw:items-center tw:gap-2 tw:text-left'
    )}
    disabled={isDisabled}
    type="button"
    onClick={onPress}>
    {tile}
    <Box
      align="center"
      className="tw:min-w-0 tw:flex-1 tw:flex-wrap tw:gap-x-2 tw:gap-y-1"
      wrap="wrap">
      <Typography
        className="tw:text-brand-secondary"
        size="text-sm"
        weight="medium">
        {subject}
      </Typography>
      <ArrowRight
        aria-hidden="true"
        className="tw:shrink-0 tw:text-tertiary"
        size={12}
      />
      <Badge color="gray" size="sm" type="pill-color">
        {predicate}
      </Badge>
      <ArrowRight
        aria-hidden="true"
        className="tw:shrink-0 tw:text-tertiary"
        size={12}
      />
      <Typography
        className="tw:text-brand-secondary"
        size="text-sm"
        weight="medium">
        {object}
      </Typography>
    </Box>
    <ChevronRight
      aria-hidden="true"
      className="tw:shrink-0 tw:text-tertiary"
      size={16}
    />
  </button>
);
