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

import { Grid } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../utils/common/layout.utils';

import { isUndefined } from 'lodash';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WORKFLOWS_METADATA_DOCS } from '../../../constants/docs.constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndexSampleData } from '../../../generated/entity/data/searchIndex';
import { TopicSampleData } from '../../../generated/entity/data/topic';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getSampleDataBySearchIndexId } from '../../../rest/SearchIndexAPI';
import { getSampleDataByTopicId } from '../../../rest/topicsAPI';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import Loader from '../../common/Loader/Loader';
import MessageCard from './MessageCard';

const SampleDataWithMessages: FC<{
  entityId: string;
  entityType: EntityType;
}> = ({ entityId, entityType }) => {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();
  const [data, setData] = useState<TopicSampleData | SearchIndexSampleData>();
  const [loading, setLoading] = useState(false);

  const fetchEntitySampleData = async () => {
    setLoading(true);
    try {
      const { sampleData } =
        entityType === EntityType.TOPIC
          ? await getSampleDataByTopicId(entityId)
          : await getSampleDataBySearchIndexId(entityId);

      setData(sampleData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntitySampleData();
  }, [entityId]);

  if (loading) {
    return <Loader />;
  }

  if (isUndefined(data) || !data.messages?.length) {
    return (
      <div
        className="border-default border-radius-sm p-y-lg tw:relative tw:min-h-60 tw:bg-surface"
        data-testid="no-data">
        <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
          <NoDataPlaceholder
            data-testid="no-data-placeholder"
            description={
              <Transi18next
                i18nKey="message.view-sample-data-entity"
                renderElement={
                  <a
                    aria-label={t('label.documentation')}
                    href={WORKFLOWS_METADATA_DOCS}
                    rel="noreferrer"
                    style={{ color: theme.primaryColor }}
                    target="_blank"
                  />
                }
                values={{
                  entity: t('label.metadata-ingestion'),
                }}
              />
            }
          />
        </div>
      </div>
    );
  }

  return (
    <Grid
      className="layout-row layout-grid p-md"
      style={{ ...getLayoutGutter(16, 16) }}>
      {data.messages?.map((message) => (
        <Grid.Item className="layout-column" key={message} span={24}>
          <MessageCard message={message} />
        </Grid.Item>
      ))}
    </Grid>
  );
};

export default SampleDataWithMessages;
