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

import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Card, Typography } from 'antd';
import { AxiosError } from 'axios';
import Loader from 'components/Loader/Loader';
import { isUndefined } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSampleDataByTopicId } from 'rest/topicsAPI';
import { Transi18next } from 'utils/CommonUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { WORKFLOWS_METADATA_DOCS } from '../../constants/docs.constants';
import { TopicSampleData } from '../../generated/entity/data/topic';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import SchemaEditor from '../schema-editor/SchemaEditor';

const MessageCard = ({ message }: { message: string }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      className="m-b-xlg"
      data-testid="message-card"
      onClick={() => setIsExpanded((pre) => !pre)}>
      <div className="d-flex">
        <div className="cursor-pointer">
          {isExpanded ? (
            <UpOutlined className="text-xs" />
          ) : (
            <DownOutlined className="text-xs" />
          )}
        </div>
        {isExpanded ? (
          <div>
            <Button
              className="active"
              data-testid="value"
              id="sampleData-value">
              {t('label.value')}
            </Button>
            <SchemaEditor
              className="m-t-xs"
              editorClass="topic-sample-data"
              options={{
                styleActiveLine: false,
              }}
              value={message.replace(/'/g, '"')}
            />
          </div>
        ) : (
          <div>
            <p
              className="m-y-xs topic-sample-data-message"
              style={{ color: '#450de2' }}>
              {message}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

const SampleDataTopic: FC<{ topicId: string }> = ({ topicId }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<TopicSampleData>();
  const [loading, setLoading] = useState(false);

  const fetchTopicSampleData = async () => {
    setLoading(true);
    try {
      const { sampleData } = await getSampleDataByTopicId(topicId);

      setData(sampleData);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.sample-data') })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopicSampleData();
  }, []);

  if (loading) {
    return <Loader />;
  }

  if (isUndefined(data)) {
    return (
      <div className="m-t-xlg" data-testid="no-data">
        <ErrorPlaceHolder>
          <Typography.Paragraph>
            <Transi18next
              i18nKey="message.view-sample-data-entity"
              renderElement={
                <a
                  href={WORKFLOWS_METADATA_DOCS}
                  rel="noreferrer"
                  style={{ color: '#1890ff' }}
                  target="_blank"
                />
              }
              values={{
                entity: t('label.metadata-ingestion'),
              }}
            />
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      </div>
    );
  }

  return (
    <div className="d-flex flex-col p-md">
      {data.messages?.map((message, i) => (
        <MessageCard key={i} message={message} />
      ))}
    </div>
  );
};

export default SampleDataTopic;
