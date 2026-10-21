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
import { Tabs, Typography } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
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
}: OntologyStudioSubBarProps<S>) => (
  <nav
    aria-label={caption}
    className="tw:flex tw:h-11.5 tw:shrink-0 tw:items-center tw:gap-3 tw:overflow-x-auto tw:border-b tw:border-secondary tw:bg-surface tw:px-4.5"
    data-testid="ontology-studio-subbar">
    <Typography
      className="tw:shrink-0 tw:tracking-wider tw:uppercase"
      color="secondary"
      size="text-xs"
      weight="semibold">
      {caption}
    </Typography>
    {surfaces.length > 0 ? (
      <Tabs
        className="tw:w-auto tw:shrink-0"
        selectedKey={surface}
        onSelectionChange={(key) => {
          const nextSurface = surfaces.find((item) => item.id === key)?.id;
          if (nextSurface) {
            onSurfaceChange(nextSurface);
          }
        }}>
        <Tabs.List aria-label={caption} size="sm" type="button-brand">
          {surfaces.map((tab) => (
            <Tabs.Item
              data-testid={`submode-tab-${tab.id}`}
              id={tab.id}
              key={tab.id}>
              {tab.label}
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
    ) : null}
    {children}
    <span className="tw:flex-1" />
    {trailing}
  </nav>
);

export default OntologyStudioSubBar;
