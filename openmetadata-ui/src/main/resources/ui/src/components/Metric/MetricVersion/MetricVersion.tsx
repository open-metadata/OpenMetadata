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
  Breadcrumbs,
  Button,
  Card,
  Skeleton,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowLeft, ClockRewind } from '@untitledui/icons';
import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityTabs } from '../../../enums/entity.enum';
import type { ChangeDescription } from '../../../generated/entity/data/metric';
import { Operation } from '../../../generated/entity/policies/policy';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getMetricEnumLabel } from '../../../utils/MetricEntityUtils/MetricDisplayUtils';
import { getPrioritizedViewPermission } from '../../../utils/PermissionsUtils';
import MetricCustomPropertyValue from '../MetricCustomPropertyValue/MetricCustomPropertyValue.component';
import MetricExpression from '../MetricExpression/MetricExpression';
import type { MetricVersionProp } from './MetricVersion.interface';
import {
  getMetricVersionField,
  getMetricVersionMetadata,
  getMetricVersionTags,
} from './MetricVersion.utils';

const MetricVersion: FC<MetricVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owners,
  tier,
  slashedMetricName,
  versionList,
  backHandler,
  versionHandler,
  entityPermissions,
  domains,
}) => {
  const { t } = useTranslation();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  const { ownerDisplayName, tierDisplayName, domainDisplayName } = useMemo(
    () => getMetricVersionMetadata({ owners, tier, domains }),
    [domains, owners, tier]
  );
  const tags = useMemo(
    () => getMetricVersionTags(currentVersionData),
    [currentVersionData]
  );
  const description = useMemo(
    () =>
      getMetricVersionField(
        changeDescription,
        'description',
        currentVersionData.description
      ),
    [changeDescription, currentVersionData.description]
  );
  const displayName = useMemo(
    () =>
      getMetricVersionField(
        changeDescription,
        'displayName',
        currentVersionData.displayName
      ),
    [changeDescription, currentVersionData.displayName]
  );
  const canViewCustomProperties = getPrioritizedViewPermission(
    entityPermissions,
    Operation.ViewCustomFields
  );
  const customProperties = Object.entries(currentVersionData.extension ?? {});
  const versions = (versionList.versions ?? []).map(String);
  const breadcrumbItems = [
    ...slashedMetricName.map((item, index) => ({
      id: `${index}-${item.name}`,
      label: item.name,
      ...(typeof item.url === 'string' ? { href: item.url } : {}),
    })),
    {
      id: 'version',
      label: `${t('label.version')} ${version ?? ''}`.trim(),
    },
  ];

  if (isVersionLoading) {
    return (
      <main className="tw:min-h-full tw:bg-secondary tw:p-6">
        <Box
          aria-label={t('label.loading')}
          direction="col"
          gap={3}
          role="status">
          <Skeleton height={72} variant="rounded" />
          <Skeleton height={320} variant="rounded" />
        </Box>
      </main>
    );
  }

  return (
    <main
      className="tw:min-h-full tw:bg-secondary"
      data-testid="metric-version-page">
      <Box
        className="tw:border-b tw:border-secondary tw:bg-primary tw:px-4 tw:py-5 tw:md:px-6"
        direction="col"
        gap={4}>
        <Breadcrumbs autoCollapse items={breadcrumbItems} size="sm" />
        <Box align="start" className="tw:flex-wrap" gap={3} justify="between">
          <Box align="start" gap={3}>
            <Button
              aria-label={t('label.back')}
              color="secondary"
              iconLeading={ArrowLeft}
              onPress={backHandler}
            />
            <Box direction="col" gap={1}>
              <Typography size="display-xs" weight="semibold">
                <h1>{displayName ?? getEntityName(currentVersionData)}</h1>
              </Typography>
              <Box align="center" className="tw:flex-wrap" gap={2}>
                <Badge color="brand" size="sm">
                  {t('label.version')} {version}
                </Badge>
                {currentVersionData.metricType && (
                  <Badge color="gray" size="sm">
                    {getMetricEnumLabel(t, currentVersionData.metricType)}
                  </Badge>
                )}
                {currentVersionData.entityStatus && (
                  <Badge color="gray" size="sm">
                    {getMetricEnumLabel(t, currentVersionData.entityStatus)}
                  </Badge>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
        <Tabs selectedKey={EntityTabs.OVERVIEW}>
          <Tabs.List
            aria-label={t('label.metric')}
            items={[{ id: EntityTabs.OVERVIEW, label: t('label.overview') }]}
            type="underline">
            {(item) => <Tabs.Item id={item.id} label={item.label} />}
          </Tabs.List>
        </Tabs>
      </Box>

      <Box className="tw:grid tw:grid-cols-1 tw:gap-4 tw:p-4 tw:xl:grid-cols-[minmax(0,1fr)_20rem] tw:md:p-6">
        <Box direction="col" gap={4}>
          <Card>
            <Card.Header title={t('label.description')} />
            <Card.Content>
              <Typography
                className="tw:whitespace-pre-wrap tw:text-secondary"
                size="text-sm">
                {description ?? t('label.no-description')}
              </Typography>
            </Card.Content>
          </Card>
          <Card>
            <Card.Header title={t('label.definition')} />
            <Card.Content>
              <MetricExpression metric={currentVersionData} />
            </Card.Content>
          </Card>
          {canViewCustomProperties && (
            <Card data-testid="metric-version-custom-properties">
              <Card.Header title={t('label.custom-property-plural')} />
              <Card.Content>
                {customProperties.length ? (
                  <Box direction="col" gap={3}>
                    {customProperties.map(([name, value]) => (
                      <Box direction="col" gap={1} key={name}>
                        <Typography
                          className="tw:text-tertiary"
                          size="text-xs"
                          weight="semibold">
                          {name}
                        </Typography>
                        <MetricCustomPropertyValue value={value} />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography className="tw:text-tertiary" size="text-sm">
                    {t('label.empty-dash')}
                  </Typography>
                )}
              </Card.Content>
            </Card>
          )}
        </Box>

        <Box direction="col" gap={4}>
          <Card data-testid="entity-right-panel">
            <Card.Header title={t('label.metadata')} />
            <Card.Content>
              <Box direction="col" gap={3}>
                {[
                  [t('label.owner-plural'), ownerDisplayName],
                  [t('label.domain-plural'), domainDisplayName],
                  [t('label.tier'), tierDisplayName],
                ].map(([label, value]) => (
                  <Box direction="col" gap={1} key={label}>
                    <Typography
                      className="tw:text-tertiary"
                      size="text-xs"
                      weight="semibold">
                      {label}
                    </Typography>
                    <Typography size="text-sm">
                      {value || t('label.empty-dash')}
                    </Typography>
                  </Box>
                ))}
                <Box direction="col" gap={1}>
                  <Typography
                    className="tw:text-tertiary"
                    size="text-xs"
                    weight="semibold">
                    {t('label.tag-plural')}
                  </Typography>
                  <Box className="tw:flex-wrap" gap={1}>
                    {tags.length ? (
                      tags.map((tag) => (
                        <Badge color="gray" key={tag.tagFQN} size="sm">
                          {tag.displayName ?? tag.name ?? tag.tagFQN}
                        </Badge>
                      ))
                    ) : (
                      <Typography className="tw:text-tertiary" size="text-sm">
                        {t('label.empty-dash')}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Card.Content>
          </Card>

          <Card data-testid="versions-list-container">
            <Card.Header title={t('label.version-plural-history')} />
            <Card.Content>
              <Box direction="col" gap={2}>
                {versions.map((candidateVersion) => (
                  <Button
                    color={
                      candidateVersion === String(version)
                        ? 'secondary'
                        : 'tertiary'
                    }
                    data-testid={`version-${candidateVersion}`}
                    iconLeading={ClockRewind}
                    key={candidateVersion}
                    onPress={() => versionHandler(candidateVersion)}>
                    {t('label.version')} {candidateVersion}
                  </Button>
                ))}
              </Box>
            </Card.Content>
          </Card>
        </Box>
      </Box>
    </main>
  );
};

export default MetricVersion;
