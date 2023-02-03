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
import { Typography } from 'antd';
import { isUndefined } from 'lodash';
import React, { FC, HTMLAttributes, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { WORKFLOWS_METADATA_DOCS } from '../../constants/docs.constants';
import { TopicSampleData } from '../../generated/entity/data/topic';
import { withLoader } from '../../hoc/withLoader';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import SchemaEditor from '../schema-editor/SchemaEditor';

interface SampleDataTopicProp extends HTMLAttributes<HTMLDivElement> {
  sampleData?: TopicSampleData;
}

const MessageCard = ({ message }: { message: string }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="tw-bg-white tw-shadow tw-rounded tw-p-2 tw-mb-6 tw-border tw-border-main"
      data-testid="message-card"
      onClick={() => setIsExpanded((pre) => !pre)}>
      <div className="tw-flex">
        <div className="tw-mr-3 tw-cursor-pointer">
          {isExpanded ? (
            <UpOutlined className="tw-text-xs" />
          ) : (
            <DownOutlined className="tw-text-xs" />
          )}
        </div>
        {isExpanded ? (
          <div>
            <button
              className="tw-gh-tabs active tw--mt-4"
              data-testid="value"
              id="sampleData-value">
              {t('label.value')}
            </button>
            <SchemaEditor
              className="tw-mt-2"
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
              className="tw-my-1 topic-sample-data-message"
              style={{ color: '#450de2' }}>
              {message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const SampleDataTopic: FC<SampleDataTopicProp> = ({ sampleData }) => {
  const { t } = useTranslation();
  if (!isUndefined(sampleData)) {
    return (
      <div className="tw-p-4 tw-flex tw-flex-col">
        {sampleData.messages?.map((message, i) => (
          <MessageCard key={i} message={message} />
        ))}
      </div>
    );
  } else {
    return (
      <div
        className="tw-flex tw-flex-col tw-justify-center tw-font-medium tw-items-center"
        data-testid="no-data">
        <ErrorPlaceHolder>
          {' '}
          <div className="tw-max-w-x tw-text-center">
            <Typography.Paragraph style={{ marginBottom: '4px' }}>
              {' '}
              {t('message.no-entity-data-available', {
                entity: t('label.sample'),
              })}
            </Typography.Paragraph>
            <Typography.Paragraph>
              {t('message.view-sample-data-message')}{' '}
              <Link
                className="tw-ml-1"
                target="_blank"
                to={{
                  pathname: WORKFLOWS_METADATA_DOCS,
                }}>
                {t('label.metadata-ingestion')}
              </Link>
            </Typography.Paragraph>
          </div>
        </ErrorPlaceHolder>
      </div>
    );
  }
};

export default withLoader<SampleDataTopicProp>(SampleDataTopic);
