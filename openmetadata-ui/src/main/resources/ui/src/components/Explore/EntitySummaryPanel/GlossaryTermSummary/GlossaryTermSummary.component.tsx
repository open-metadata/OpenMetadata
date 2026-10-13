/*
 *  Copyright 2022 Collate.
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

import { Box, Grid, Owner, Typography } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';

import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { getGlossaryTermByFQN } from '../../../../rest/glossaryAPI';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import { SynonymBadge } from '../../../Glossary/GlossaryTermBadges/GlossaryTermBadges';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';
import { GlossaryTermSummaryProps } from './GlossaryTermSummary.interface';

function GlossaryTermSummary({
  entityDetails,
  isLoading,
}: GlossaryTermSummaryProps) {
  const { t } = useTranslation();
  const [selectedData, setSelectedData] = useState<GlossaryTerm>();

  const formattedColumnsData: BasicEntityInfo[] = useMemo(() => {
    if (selectedData?.children) {
      return getFormattedEntityData(
        SummaryEntityType.COLUMN,
        selectedData.children
      );
    } else {
      return [];
    }
  }, [selectedData]);

  const reviewers = useMemo(
    () => entityDetails.reviewers ?? [],
    [selectedData]
  );

  const synonyms = useMemo(
    () => entityDetails.synonyms?.filter((item) => !isEmpty(item)) ?? [],
    [selectedData]
  );

  const fetchGlossaryTermDetails = useCallback(async () => {
    try {
      const response = await getGlossaryTermByFQN(
        entityDetails.fullyQualifiedName,
        {
          fields: [
            TabSpecificField.RELATED_TERMS,
            TabSpecificField.OWNERS,
            TabSpecificField.REVIEWERS,
            TabSpecificField.TAGS,
            TabSpecificField.CHILDREN,
          ],
        }
      );
      setSelectedData(response);
    } catch (error) {
      // Error
    }
  }, [entityDetails.fullyQualifiedName, setSelectedData]);

  useEffect(() => {
    fetchGlossaryTermDetails();
  }, [entityDetails]);

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <Box
        inline
        align="stretch"
        className="layout-space w-full"
        direction="col"
        gap={5}
        itemClassName="layout-space-item">
        <Grid
          className="layout-row layout-grid p-md border-radius-card summary-panel-card"
          style={getLayoutGutter(0, 8)}>
          <Grid.Item className="layout-column" span={24}>
            <Typography
              className="summary-panel-section-title"
              data-testid="reviewer-header">
              {t('label.reviewer-plural')}
            </Typography>
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            {reviewers.length > 0 ? (
              <Owner
                isCompactView={false}
                owners={reviewers}
                showLabel={false}
              />
            ) : (
              <Typography
                className="no-data-chip-placeholder"
                data-testid="no-reviewer-header">
                {t('label.no-reviewer')}
              </Typography>
            )}
          </Grid.Item>
        </Grid>

        <Grid
          className="layout-row layout-grid p-md border-radius-card summary-panel-card"
          style={getLayoutGutter(0, 8)}>
          <Grid.Item className="layout-column" span={24}>
            <Typography
              className="summary-panel-section-title"
              data-testid="synonyms-header">
              {t('label.synonym-plural')}
            </Typography>
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            {synonyms.length > 0 ? (
              <div className="tw:flex tw:flex-wrap tw:gap-1">
                {synonyms.map((synonym: string) => (
                  <SynonymBadge key={synonym} synonym={synonym} />
                ))}
              </div>
            ) : (
              <Typography
                className="no-data-chip-placeholder"
                data-testid="no-synonyms-available-header">
                {t('message.no-synonyms-available')}
              </Typography>
            )}
          </Grid.Item>
        </Grid>

        <Grid
          className="layout-row layout-grid p-md border-radius-card summary-panel-card"
          style={getLayoutGutter(0, 8)}>
          <Grid.Item className="layout-column" span={24}>
            <Typography
              className="summary-panel-section-title"
              data-testid="children-header">
              {t('label.children')}
            </Typography>
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <SummaryList
              emptyPlaceholderText={t('label.no-entity', {
                entity: t('label.children-lowercase'),
              })}
              entityType={SummaryEntityType.COLUMN}
              formattedEntityData={formattedColumnsData}
            />
          </Grid.Item>
        </Grid>
      </Box>
    </SummaryPanelSkeleton>
  );
}

export default GlossaryTermSummary;
