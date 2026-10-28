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
  Box,
  Divider,
  FeaturedIcon,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Share07 } from '@openmetadata/ui-core-components/icons';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyStudioTab } from './OntologyStudioHeader.types';

interface OntologyStudioHeaderProps<M extends string> {
  readonly scopeMenu: ReactNode;
  readonly modes: OntologyStudioTab<M>[];
  readonly mode: M;
  readonly onModeChange: (mode: M) => void;
  readonly actions?: ReactNode;
  readonly breadcrumb?: ReactNode;
}

const OntologyStudioHeader = <M extends string>({
  scopeMenu,
  modes,
  mode,
  onModeChange,
  actions,
  breadcrumb,
}: OntologyStudioHeaderProps<M>) => {
  const { t } = useTranslation();

  return (
    <header
      className="tw:shrink-0 tw:border-b tw:border-secondary tw:bg-surface"
      data-testid="ontology-studio-header"
      data-tour-step="ontology-studio">
      {breadcrumb ? <div className="tw:px-4 tw:pt-2">{breadcrumb}</div> : null}
      <Box align="center" className="tw:h-14 tw:px-4" gap={3}>
        <Box align="center" className="tw:shrink-0" gap={2}>
          <FeaturedIcon color="brand" icon={Share07} size="sm" theme="dark" />
          <Typography
            as="h1"
            className="tw:m-0! tw:text-sm! tw:leading-5! tw:whitespace-nowrap"
            weight="bold">
            {t('label.ontology-studio')}
          </Typography>
        </Box>
        <Divider className="tw:h-5.5 tw:self-center" orientation="vertical" />
        {scopeMenu}
        <Tabs
          className="tw:w-auto tw:shrink-0"
          selectedKey={mode}
          onSelectionChange={(key) => {
            const nextMode = modes.find((item) => item.id === key)?.id;
            if (nextMode) {
              onModeChange(nextMode);
            }
          }}>
          <Tabs.List
            aria-label={t('label.mode')}
            size="sm"
            type="button-border">
            {modes.map((tab) => (
              <Tabs.Item
                data-testid={`mode-tab-${tab.id}`}
                id={tab.id}
                key={tab.id}>
                {tab.label}
              </Tabs.Item>
            ))}
          </Tabs.List>
        </Tabs>
        <span className="tw:flex-1" />
        {actions ? (
          <Box align="center" className="tw:shrink-0" gap={2}>
            {actions}
          </Box>
        ) : null}
      </Box>
    </header>
  );
};

export default OntologyStudioHeader;
