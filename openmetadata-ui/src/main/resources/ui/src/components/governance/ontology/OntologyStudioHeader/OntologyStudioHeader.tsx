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
  PageHeader,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Key, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsAiMode } from '../../../../hooks/useAppMode';
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
  const isAiMode = useIsAiMode();

  const handleSelectionChange = (key: Key) => {
    const nextMode = modes.find((item) => item.id === key)?.id;
    if (nextMode) {
      onModeChange(nextMode);
    }
  };

  const betaBadge = (
    <Badge
      color="blue-light"
      data-testid="ontology-studio-beta-badge"
      size="sm"
      type="pill-color">
      {t('label.beta')}
    </Badge>
  );

  const modeItems = modes.map((tab) => (
    <Tabs.Item
      className={({ isSelected }) =>
        isSelected ? 'tw:font-semibold' : 'tw:font-medium'
      }
      data-testid={`mode-tab-${tab.id}`}
      id={tab.id}
      key={tab.id}>
      {tab.label}
    </Tabs.Item>
  ));

  return (
    <header
      className="tw:shrink-0 tw:p-2"
      data-testid="ontology-studio-header"
      data-tour-step="ontology-studio">
      <PageHeader
        breadcrumb={breadcrumb}
        data-testid="ontology-studio-page-header"
        footer={
          modes.length > 0 ? (
            <Tabs
              className="tw:w-auto"
              selectedKey={mode}
              onSelectionChange={handleSelectionChange}>
              {/* AI mode matches the Data Quality header; classic keeps the segmented control. */}
              <Tabs.List
                aria-label={t('label.mode')}
                className={
                  isAiMode
                    ? 'tw:mt-2 tw:gap-6 tw:before:hidden'
                    : 'tw:my-4 tw:w-max'
                }
                size="sm"
                type={isAiMode ? 'underline' : 'button-border'}>
                {modeItems}
              </Tabs.List>
            </Tabs>
          ) : undefined
        }
        // PageHeader's actions slot never shrinks or wraps, so beside the AI
        // side panel it ran past the viewport; this row wraps instead.
        title={
          <Box
            align="center"
            className="tw:w-full tw:min-w-0"
            gap={3}
            justify="between"
            wrap="wrap">
            <Box className="tw:min-w-0 tw:gap-0.5" direction="col">
              <Box align="center" className="tw:min-w-0" gap={2}>
                <Typography
                  ellipsis
                  as="h1"
                  className="not-prose tw:m-0 tw:min-w-0"
                  size="text-xl"
                  weight="semibold">
                  {t('label.ontology-studio')}
                </Typography>
                {betaBadge}
              </Box>
              <Typography color="secondary" size="text-sm">
                {t('message.ontology-studio-description')}
              </Typography>
            </Box>
            <Box
              align="center"
              className="tw:min-w-0"
              gap={2}
              justify="end"
              wrap="wrap">
              <Box className="tw:min-w-18 tw:max-w-56 tw:shrink">
                {scopeMenu}
              </Box>
              {actions}
            </Box>
          </Box>
        }
        variant={isAiMode ? 'gradient' : 'flat'}
      />
    </header>
  );
};

export default OntologyStudioHeader;
