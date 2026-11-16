/*
 *  Copyright 2025 Collate.
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
  Divider,
  Grid,
  Owner,
  Typography,
} from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';

import { get } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Domain } from '../../../../generated/entity/domains/domain';
import { getSortedTagsWithHighlight } from '../../../../utils/EntitySummaryPanelPureUtils';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';

interface DomainSummaryProps {
  entityDetails: Domain;
  isLoading?: boolean;
  highlights?: SearchedDataProps['data'][number]['highlight'];
}

const DomainSummary = ({
  entityDetails,
  isLoading,
  highlights,
}: DomainSummaryProps) => {
  const { t } = useTranslation();

  const experts = useMemo(() => entityDetails.experts ?? [], [entityDetails]);

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <SummaryTagsDescription
          entityDetail={entityDetails}
          tags={getSortedTagsWithHighlight(
            entityDetails.tags,
            get(highlights, 'tag.name')
          )}
        />

        <Divider className="m-y-xs summary-panel-divider" />

        <Grid
          className="layout-row layout-grid m-md m-t-0"
          style={getLayoutGutter(0, 8)}>
          <Grid.Item className="layout-column" span={24}>
            <Typography
              className="summary-panel-section-title"
              data-testid="owner-header">
              {t('label.owner-plural')}
            </Typography>
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <Owner
              isCompactView={false}
              owners={entityDetails.owners ?? []}
              showLabel={false}
            />
          </Grid.Item>
        </Grid>

        <Divider className="m-y-xs summary-panel-divider" />

        <Grid
          className="layout-row layout-grid m-md m-t-0"
          style={getLayoutGutter(0, 8)}>
          <Grid.Item className="layout-column" span={24}>
            <Typography
              className="summary-panel-section-title"
              data-testid="expert-header">
              {t('label.expert-plural')}
            </Typography>
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            {experts.length > 0 ? (
              <Owner isCompactView={false} owners={experts} showLabel={false} />
            ) : (
              <Typography
                className="text-grey-body"
                data-testid="no-expert-header">
                {t('label.no-entity', {
                  entity: t('label.expert-lowercase'),
                })}
              </Typography>
            )}
          </Grid.Item>
        </Grid>

        <Divider className="m-y-xs summary-panel-divider" />
      </>
    </SummaryPanelSkeleton>
  );
};

export default DomainSummary;
