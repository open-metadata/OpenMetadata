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
  Dot,
  PageHeader,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Fragment, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HeaderBreadcrumb from '../../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import {
  getGlossaryHomeCrumb,
  getHomeCrumb,
} from '../../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.utils';
import OntologyExplorer from '../../../../components/OntologyExplorer/OntologyExplorer';
import PageLayoutV1 from '../../../../components/PageLayoutV1/PageLayoutV1';
import { useIsAiMode } from '../../../../hooks/useAppMode';

/** Splits "12 Glossaries" into its count and label for the stats row. */
const splitStat = (item: string) => {
  const spaceIndex = item.indexOf(' ');

  return spaceIndex > 0
    ? { count: item.slice(0, spaceIndex), label: item.slice(spaceIndex + 1) }
    : { count: item, label: '' };
};

/**
 * The read-only Ontology Explorer: the relations graph of every glossary.
 * Authoring lives in Collate's Ontology Studio, which serves this route there.
 * ADR:2026-11-15-ontology-studio-ui-ships-only-in-collate
 */
const OntologyExplorerPage = () => {
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

  const statsRow = (
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
            const { count, label } = splitStat(item);

            return (
              <Fragment key={item}>
                {index > 0 && (
                  <Dot className="tw:text-quaternary" size="tiny" />
                )}
                <Typography as="span" size="text-sm">
                  <span className="tw:font-semibold">{count}</span>
                  {label && (
                    <span className="tw:text-xs tw:font-normal"> {label}</span>
                  )}
                </Typography>
              </Fragment>
            );
          })}
    </Box>
  );

  return (
    <PageLayoutV1
      className="ontology-explorer-page"
      fullHeight={isAiMode}
      pageTitle={t('label.ontology-explorer')}>
      <Box
        className={
          isAiMode ? 'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col' : undefined
        }
        direction="col"
        gap={4}>
        <PageHeader
          hasStats
          badge={
            <Badge
              color="blue-light"
              data-testid="beta-badge"
              size="sm"
              type="color">
              {t('label.beta').toUpperCase()}
            </Badge>
          }
          breadcrumb={
            <HeaderBreadcrumb
              noMargin
              items={[
                isAiMode ? getGlossaryHomeCrumb(t) : getHomeCrumb(t),
                { label: t('label.ontology-explorer') },
              ]}
              showHome={false}
            />
          }
          data-testid="ontology-explorer-header"
          meta={statsRow}
          title={t('label.ontology-explorer')}
          variant={isAiMode ? 'gradient' : 'flat'}
        />
        <div
          className={isAiMode ? 'tw:min-h-0 tw:flex-1' : undefined}
          data-testid="ontology-explorer-page">
          <OntologyExplorer
            height={isAiMode ? '100%' : 'calc(100vh - 230px)'}
            scope="global"
            onLoadingChange={handleLoadingChange}
            onStatsChange={handleStatsChange}
          />
        </div>
      </Box>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
