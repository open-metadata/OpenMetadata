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
import { Box, Tabs } from '@openmetadata/ui-core-components';
import { Key, ReactNode } from 'react';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { OntologyStudioTab } from '../OntologyStudioHeader/OntologyStudioHeader.types';

interface OntologyStudioSubBarProps<S extends string> {
  readonly caption: string;
  readonly surfaces: OntologyStudioTab<S>[];
  readonly surface?: S;
  readonly onSurfaceChange: (surface: S) => void;
  readonly children?: ReactNode;
  readonly trailing?: ReactNode;
}

const OntologyStudioSubBar = <S extends string>({
  caption,
  surfaces,
  surface,
  onSurfaceChange,
  children,
  trailing,
}: OntologyStudioSubBarProps<S>) => {
  const isAiMode = useIsAiMode();

  const handleSelectionChange = (key: Key) => {
    const nextSurface = surfaces.find((item) => item.id === key)?.id;
    if (nextSurface) {
      onSurfaceChange(nextSurface);
    }
  };

  const tabItems = surfaces.map((tab) => (
    <Tabs.Item data-testid={`submode-tab-${tab.id}`} id={tab.id} key={tab.id}>
      {tab.label}
    </Tabs.Item>
  ));

  // Classic mode: the core card of underline tabs. Stats and Tasks sit over its right edge rather
  // than in its `actions` slot: react-aria renders everything inside Tabs into a window-less
  // document to collect the tabs, and the Tasks button's focus effects throw there.
  if (!isAiMode) {
    return (
      <nav
        aria-label={caption}
        className="tw:relative tw:shrink-0"
        data-testid="ontology-studio-subbar">
        <Tabs selectedKey={surface} onSelectionChange={handleSelectionChange}>
          <Tabs.List
            aria-label={caption}
            size="sm"
            type="underline"
            variant="card">
            {tabItems}
          </Tabs.List>
        </Tabs>
        <Box
          align="center"
          className="tw:absolute tw:inset-y-0 tw:right-5"
          gap={3}>
          {children}
          {trailing}
        </Box>
      </nav>
    );
  }

  return (
    <nav
      aria-label={caption}
      className="tw:flex tw:h-15.5 tw:shrink-0 tw:items-center tw:gap-3.5 tw:overflow-x-auto tw:border-b tw:border-secondary tw:bg-surface tw:pr-3.5 tw:pl-4.5"
      data-testid="ontology-studio-subbar">
      {surfaces.length > 0 ? (
        <Tabs
          className="tw:w-auto tw:shrink-0"
          selectedKey={surface}
          onSelectionChange={handleSelectionChange}>
          <Tabs.List aria-label={caption} size="sm" type="button-border">
            {tabItems}
          </Tabs.List>
        </Tabs>
      ) : null}
      {children}
      <span className="tw:flex-1" />
      {trailing}
    </nav>
  );
};

export default OntologyStudioSubBar;
