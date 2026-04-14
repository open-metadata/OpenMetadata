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
  Card,
  Divider,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Home02 } from '@untitledui/icons';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { OntologyExplorer } from '../../components/OntologyExplorer';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';

const OntologyExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<string[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  const handleStatsChange = useCallback((newStats: string[]) => {
    setStats(newStats);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsStatsLoading(loading);
  }, []);

  return (
    <PageLayoutV1 pageTitle={t('label.ontology-explorer')}>
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
              name: t('label.ontology-explorer'),
              url: '',
            },
          ]}
        />

        <Card className="tw:p-5">
          <Typography
            as="span"
            data-testid="heading"
            size="text-md"
            weight="semibold">
            {t('label.ontology-explorer')}
          </Typography>
          <div
            className="tw:mt-1 tw:flex tw:flex-wrap tw:items-center tw:gap-2"
            data-testid="ontology-explorer-stats">
            {isStatsLoading
              ? [1, 2, 3].map((i) => (
                  <Skeleton height={20} key={i} variant="rounded" width={80} />
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
                        index === 0 ? 'ontology-explorer-stats-item' : undefined
                      }
                      size="text-sm"
                      weight="regular">
                      {item}
                    </Typography>
                  </React.Fragment>
                ))}
          </div>
        </Card>

        <OntologyExplorer
          height="calc(100vh - 230px)"
          scope="global"
          onLoadingChange={handleLoadingChange}
          onStatsChange={handleStatsChange}
        />
      </div>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
