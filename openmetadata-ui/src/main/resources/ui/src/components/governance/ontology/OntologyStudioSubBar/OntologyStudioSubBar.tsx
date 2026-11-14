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
import { Box, Card, Tabs } from '@openmetadata/ui-core-components';
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

  // Classic mode: a card of underline tabs with stats and Tasks beside them in flow, so a narrow
  // bar squeezes the tabs (they scroll) instead of covering them. Tasks stays outside Tabs (and
  // so outside `Tabs.List variant="card"`'s actions slot): react-aria renders everything inside
  // Tabs into a window-less document to collect the tabs, and the Tasks button's focus effects
  // throw there.
  if (!isAiMode) {
    return (
      <nav
        aria-label={caption}
        className="tw:shrink-0"
        data-testid="ontology-studio-subbar">
        <Card className="tw:flex tw:min-h-12">
          <Box className="tw:min-w-0 tw:flex-1 tw:overflow-x-auto tw:pl-5">
            <Tabs
              className="tw:h-full tw:justify-end"
              selectedKey={surface}
              onSelectionChange={handleSelectionChange}>
              <Tabs.List
                aria-label={caption}
                className="tw:gap-6 tw:before:hidden"
                size="sm"
                type="underline">
                {tabItems}
              </Tabs.List>
            </Tabs>
          </Box>
          <Box
            align="center"
            className="tw:shrink-0 tw:py-1.5 tw:pr-5 tw:pl-3"
            gap={3}>
            {children}
            {trailing}
          </Box>
        </Card>
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
