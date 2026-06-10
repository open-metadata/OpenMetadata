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
import {
  Atom01,
  BarChart01,
  BookOpen01,
  CodeBrowser,
  CodeSnippet01,
  Compass03,
  Cube01,
  Database01,
  File05,
  Folder,
  GitBranch01,
  LayoutAlt01,
  Rows01,
  SearchMd,
  Shield01,
  Table,
} from '@untitledui/icons';
import { CSSProperties } from 'react';
import { EntityType } from '../enums/entity.enum';

type StrokeIcon = typeof Database01;

/**
 * Explore-only stroke icon set matching the redesign (Untitled-UI style).
 * Scoped on purpose: the global getEntityIcon serves 30+ surfaces with the
 * legacy colored glyphs and is not changed here.
 */
const EXPLORE_ASSET_ICONS: Record<string, StrokeIcon> = {
  [EntityType.DATABASE]: Database01,
  [EntityType.DATABASE_SCHEMA]: Database01,
  [EntityType.TABLE]: Table,
  [EntityType.TABLE_COLUMN]: Table,
  [EntityType.STORED_PROCEDURE]: CodeSnippet01,
  [EntityType.DASHBOARD]: LayoutAlt01,
  [EntityType.DASHBOARD_DATA_MODEL]: LayoutAlt01,
  [EntityType.CHART]: BarChart01,
  [EntityType.PIPELINE]: GitBranch01,
  [EntityType.TOPIC]: Rows01,
  [EntityType.MLMODEL]: Atom01,
  [EntityType.CONTAINER]: Cube01,
  [EntityType.SEARCH_INDEX]: SearchMd,
  [EntityType.API_COLLECTION]: CodeBrowser,
  [EntityType.API_ENDPOINT]: CodeBrowser,
  [EntityType.GLOSSARY_TERM]: BookOpen01,
  [EntityType.TAG]: Shield01,
  [EntityType.METRIC]: BarChart01,
  [EntityType.DOMAIN]: Compass03,
  [EntityType.DATA_PRODUCT]: Cube01,
  [EntityType.DIRECTORY]: Folder,
  [EntityType.FILE]: File05,
  [EntityType.SPREADSHEET]: Table,
  [EntityType.WORKSHEET]: Table,
  [EntityType.KNOWLEDGE_PAGE]: BookOpen01,
};

const EXPLORE_ICON_LOOKUP = new Map(
  Object.entries(EXPLORE_ASSET_ICONS).map(([key, icon]) => [
    key.toLowerCase(),
    icon,
  ])
);

export const getExploreAssetIcon = (
  assetType: string,
  className = '',
  style: CSSProperties = {}
): JSX.Element | null => {
  const IconComponent = EXPLORE_ICON_LOOKUP.get(assetType.toLowerCase());

  return IconComponent ? (
    <IconComponent className={className} style={style} />
  ) : null;
};
