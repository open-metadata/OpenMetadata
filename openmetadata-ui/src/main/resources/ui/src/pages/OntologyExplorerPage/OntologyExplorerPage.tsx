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
  Card,
  Divider,
  Skeleton,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Home02 } from '@untitledui/icons';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { OntologyExplorer } from '../../components/OntologyExplorer';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import SparqlQueryConsole from '../../components/SparqlQueryConsole/SparqlQueryConsole.component';

type StudioMode = 'view' | 'edit' | 'query';

const OntologyExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<StudioMode>('view');
  const [stats, setStats] = useState<string[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  const handleStatsChange = useCallback((newStats: string[]) => {
    setStats(newStats);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsStatsLoading(loading);
  }, []);

  return (
    <PageLayoutV1 pageTitle={t('label.ontology-studio')}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <TitleBreadcrumb
          useCustomArrow
          titleLinks={[
            {
              name: '',
              icon: <Home02 size={12} />,
              url: '/',
              activeTitle: true,
            },
            {
              name: t('label.ontology-studio'),
              url: '',
            },
          ]}
        />

        <Card className="tw:p-5">
          <div className="tw:grid tw:grid-cols-[1fr_auto_1fr] tw:items-center tw:gap-2">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Typography
                as="span"
                data-testid="heading"
                size="text-md"
                weight="semibold">
                {t('label.ontology-studio')}
              </Typography>
              <Badge
                color="blue-light"
                data-testid="beta-badge"
                size="sm"
                type="pill-color">
                {t('label.beta')}
              </Badge>
            </div>
            <div className="tw:flex tw:justify-center">
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
            </div>
            <div />
          </div>

          {mode === 'view' ? (
            <div
              className="tw:mt-1 tw:flex tw:flex-wrap tw:items-center tw:gap-2"
              data-testid="ontology-explorer-stats">
              {isStatsLoading
                ? [1, 2, 3].map((i) => (
                    <Skeleton
                      height={20}
                      key={i}
                      variant="rounded"
                      width={80}
                    />
                  ))
                : stats.map((item, index) => (
                    <React.Fragment key={item}>
                      {index > 0 && (
                        <Divider
                          className="tw:h-4 tw:self-center"
                          orientation="vertical"
                        />
                      )}
                      <Typography
                        data-testid={
                          index === 0
                            ? 'ontology-explorer-stats-item'
                            : undefined
                        }
                        size="text-sm"
                        weight="regular">
                        {item}
                      </Typography>
                    </React.Fragment>
                  ))}
            </div>
          ) : null}
        </Card>

        {mode === 'view' ? (
          <OntologyExplorer
            height="calc(100vh - 230px)"
            scope="global"
            onLoadingChange={handleLoadingChange}
            onStatsChange={handleStatsChange}
          />
        ) : null}

        {mode === 'query' ? <SparqlQueryConsole /> : null}

        {mode === 'edit' ? (
          <Card
            className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-2 tw:p-10 tw:text-center"
            data-testid="ontology-studio-edit-placeholder">
            <Typography as="span" size="text-md" weight="semibold">
              {t('label.edit')}
            </Typography>
            <Typography as="p" className="tw:text-tertiary" size="text-sm">
              {t('message.ontology-studio-edit-coming-soon')}
            </Typography>
          </Card>
        ) : null}
      </div>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
