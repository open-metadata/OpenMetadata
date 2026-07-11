/*
 *  Copyright 2024 Collate.
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
  Card,
  Dot,
  Skeleton,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import {
  getGlossaryHomeCrumb,
  getHomeCrumb,
} from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.utils';
import HeaderShell from '../../components/common/HeaderShell/HeaderShell.component';
import { OntologyExplorer } from '../../components/OntologyExplorer';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import SparqlQueryConsole from '../../components/SparqlQueryConsole/SparqlQueryConsole.component';
import { useIsAiMode } from '../../hooks/useAppMode';

type StudioMode = 'view' | 'edit' | 'query';

const OntologyExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const [mode, setMode] = useState<StudioMode>('view');
  const [stats, setStats] = useState<string[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  const handleStatsChange = useCallback((newStats: string[]) => {
    setStats(newStats);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsStatsLoading(loading);
  }, []);

  const breadcrumb = (
    <HeaderBreadcrumb
      noMargin
      items={[
        isAiMode ? getGlossaryHomeCrumb(t) : getHomeCrumb(t),
        { label: t('label.ontology-explorer') },
      ]}
      showHome={false}
    />
  );

  const heading = (
    <Typography
      as="span"
      data-testid="heading"
      size="text-md"
      weight="semibold">
      {t('label.ontology-explorer')}
    </Typography>
  );

  const betaBadge = (
    <Badge color="blue-light" data-testid="beta-badge" size="sm" type="color">
      {t('label.beta').toUpperCase()}
    </Badge>
  );

  const modeTabs = (
    <Tabs
      className="tw:w-fit!"
      selectedKey={mode}
      onSelectionChange={(key) => {
        if (key === 'view' || key === 'edit' || key === 'query') {
          setMode(key);
        }
      }}>
      <Tabs.List size="sm" type="button-border">
        <Tabs.Item id="view" label={t('label.view')} />
        <Tabs.Item id="edit" label={t('label.edit')} />
        <Tabs.Item id="query" label={t('label.query')} />
      </Tabs.List>
      <Tabs.Panel className="tw:hidden" id="view" />
      <Tabs.Panel className="tw:hidden" id="edit" />
      <Tabs.Panel className="tw:hidden" id="query" />
    </Tabs>
  );

  const statsRow =
    mode !== 'query' ? (
      <Box
        align="center"
        data-testid="ontology-explorer-stats"
        gap={3}
        wrap="wrap">
        {isStatsLoading
          ? [1, 2, 3].map((i) => (
              <Skeleton height={20} key={i} variant="rounded" width={80} />
            ))
          : stats.map((item, index) => {
              const spaceIndex = item.indexOf(' ');
              const count = spaceIndex > 0 ? item.slice(0, spaceIndex) : item;
              const label = spaceIndex > 0 ? item.slice(spaceIndex + 1) : '';

              return (
                <React.Fragment key={item}>
                  {index > 0 && (
                    <Dot className="tw:text-quaternary" size="tiny" />
                  )}
                  <Typography
                    as="span"
                    data-testid={
                      index === 0 ? 'ontology-explorer-stats-item' : undefined
                    }
                    size="text-sm">
                    <span className="tw:font-semibold">{count}</span>
                    {label && (
                      <span className="tw:text-xs tw:font-normal">
                        {' '}
                        {label}
                      </span>
                    )}
                  </Typography>
                </React.Fragment>
              );
            })}
      </Box>
    ) : null;

  return (
    <PageLayoutV1 pageTitle={t('label.ontology-explorer')}>
      <Box direction="col" gap={3}>
        {isAiMode ? (
          <HeaderShell
            actions={modeTabs}
            badge={betaBadge}
            breadcrumb={breadcrumb}
            hasStats={mode !== 'query'}
            meta={statsRow}
            title={heading}
            variant="gradient"
          />
        ) : (
          <>
            {breadcrumb}
            <Card className="tw:p-5">
              <Box align="center" justify="between" wrap="wrap">
                <Box align="center" gap={2}>
                  {heading}
                  {betaBadge}
                </Box>
                {modeTabs}
              </Box>
              {statsRow}
            </Card>
          </>
        )}

        {mode === 'query' ? (
          <SparqlQueryConsole />
        ) : (
          <OntologyExplorer
            height="calc(100vh - 230px)"
            isEditMode={mode === 'edit'}
            scope="global"
            onLoadingChange={handleLoadingChange}
            onStatsChange={handleStatsChange}
          />
        )}
      </Box>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
