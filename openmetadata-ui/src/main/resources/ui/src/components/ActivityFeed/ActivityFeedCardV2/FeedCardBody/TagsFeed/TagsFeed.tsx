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

import { Col, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddIcon } from '../../../../../assets/svg/added-icon.svg';
import { ReactComponent as UpdatedIcon } from '../../../../../assets/svg/updated-icon.svg';
import TagsViewer from '../../../../Tag/TagsViewer/TagsViewer';
import { TagsFeedProps } from './TagsFeed.interface';

function TagsFeed({ feed }: Readonly<TagsFeedProps>) {
  const { t } = useTranslation();
  const { previousTags, updatedTags } = useMemo(() => {
    return {
      previousTags: feed.feedInfo?.entitySpecificInfo?.previousTags ?? [],
      updatedTags: feed.feedInfo?.entitySpecificInfo?.updatedTags ?? [],
    };
  }, [feed]);

  return (
    <Row gutter={[8, 8]}>
      {!isEmpty(updatedTags) && (
        <Col span={24}>
          <Row align="middle" gutter={[12, 12]}>
            <Col>
              <Row align="middle" gutter={[4, 4]} wrap={false}>
                <Col className="h-4">
                  <AddIcon height={16} width={16} />
                </Col>
                <Col>
                  <Typography.Text>
                    {`${t('label.added-entity', {
                      entity: t('label.tag-plural'),
                    })}:`}
                  </Typography.Text>
                </Col>
              </Row>
            </Col>
            <Col>
              <TagsViewer tags={updatedTags} />
            </Col>
          </Row>
        </Col>
      )}
      {!isEmpty(previousTags) && (
        <Col span={24}>
          <Row align="middle" gutter={[12, 12]}>
            <Col>
              <Row align="middle" gutter={[4, 4]} wrap={false}>
                <Col className="h-4">
                  <UpdatedIcon height={16} width={16} />
                </Col>
                <Col>
                  <Typography.Text>
                    {`${t('label.removed-entity', {
                      entity: t('label.tag-plural'),
                    })}:`}
                  </Typography.Text>
                </Col>
              </Row>
            </Col>
            <Col>
              <TagsViewer tags={previousTags} />
            </Col>
          </Row>
        </Col>
      )}
    </Row>
  );
}

export default TagsFeed;
