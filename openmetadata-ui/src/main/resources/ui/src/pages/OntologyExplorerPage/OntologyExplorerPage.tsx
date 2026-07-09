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
  Divider,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as GovernanceIcon } from '../../assets/svg/ic-governance.svg';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../../components/common/HeaderShell/HeaderShell.component';
import { OntologyExplorer } from '../../components/OntologyExplorer';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { useIsAiMode } from '../../hooks/useAppMode';

const OntologyExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
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
        {
          label: null,
          ariaLabel: t('label.home'),
          icon: GovernanceIcon,
          href: '/',
        },
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
    <Badge
      color="blue-light"
      data-testid="beta-badge"
      size="sm"
      type="pill-color">
      {t('label.beta')}
    </Badge>
  );

  const statsRow = (
    <Box
      align="center"
      className="tw:mt-3"
      data-testid="ontology-explorer-stats"
      gap={2}
      wrap="wrap">
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
    </Box>
  );

  return (
    <PageLayoutV1 pageTitle={t('label.ontology-explorer')}>
      <Box direction="col" gap={3}>
        {isAiMode ? (
          <HeaderShell
            badge={betaBadge}
            breadcrumb={breadcrumb}
            meta={statsRow}
            title={heading}
            variant="gradient"
          />
        ) : (
          <>
            {breadcrumb}
            <Card className="tw:p-5">
              <Box align="center" gap={2}>
                {heading}
                {betaBadge}
              </Box>
              {statsRow}
            </Card>
          </>
        )}

        <OntologyExplorer
          height="calc(100vh - 230px)"
          scope="global"
          onLoadingChange={handleLoadingChange}
          onStatsChange={handleStatsChange}
        />
      </Box>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
