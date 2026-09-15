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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { ChevronRight, Database01 } from '@untitledui/icons';
import classNames from 'classnames';
import { ReactNode } from 'react';
import { getColorSetForType } from '../../utils/KnowledgeGraph.utils';
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
    className={classNames('kg-inspector-tile', 'kg-inspector-tile-' + size)}
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
  color: string;
  family: string;
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

interface SectionProps {
  title: string;
  meta?: string;
  children: ReactNode;
}

export const InspectorSection = ({ title, meta, children }: SectionProps) => (
  <Box direction="col" gap={2}>
    <Box align="center" gap={2} justify="between">
      <span className="kg-inspector-section-title">{title}</span>
      {meta && (
        <Typography className="tw:text-quaternary" size="text-xs">
          {meta}
        </Typography>
      )}
    </Box>
    <Box direction="col" gap={1}>
      {children}
    </Box>
  </Box>
);

interface RowProps {
  tile: ReactNode;
  name: string;
  detail: string;
  isDisabled?: boolean;
  onPress?: () => void;
}

/** A clickable row: tile, name over detail, chevron; the name and detail read as one accessible label. */
export const InspectorRow = ({
  tile,
  name,
  detail,
  isDisabled,
  onPress,
}: RowProps) => (
  <Button
    noTextPadding
    className="kg-inspector-row tw:w-full tw:justify-start tw:*:data-text:flex-1"
    color="tertiary"
    iconTrailing={ChevronRight}
    isDisabled={isDisabled}
    size="sm"
    onPress={onPress}>
    <Box align="center" className="tw:min-w-0 tw:flex-1 tw:text-left" gap={2}>
      {tile}
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={0}>
        <Typography
          className="tw:truncate tw:text-primary"
          size="text-sm"
          weight="medium">
          {name}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {detail}
        </Typography>
      </Box>
    </Box>
  </Button>
);
