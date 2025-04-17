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

import { Col, Row } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { ReactComponent as AddIcon } from '../../../../../assets/svg/added-icon.svg';
import { ReactComponent as DeletedIcon } from '../../../../../assets/svg/deleted-icon.svg';

import { Tag } from '../../../../../generated/entity/feed/tag';
import TagsViewer from '../../../../Tag/TagsViewer/TagsViewer';
import { TagsFeedProps } from './TagsFeed.interface';

function TagsFeed({ feed }: Readonly<TagsFeedProps>) {
  const { previousTags, updatedTags } = useMemo(() => {
    return {
      previousTags:
        (feed.feedInfo?.entitySpecificInfo as Tag)?.previousTags ?? [],
      updatedTags:
        (feed.feedInfo?.entitySpecificInfo as Tag)?.updatedTags ?? [],
    };
  }, [feed]);

  return (
    <Row gutter={[8, 8]}>
      {!isEmpty(updatedTags) && (
        <Col span={24}>
          <Row align="middle" gutter={[12, 12]} wrap={false}>
            <Col className="h-4">
              <AddIcon height={16} width={16} />
            </Col>
            <Col>
              <TagsViewer tags={updatedTags} />
            </Col>
          </Row>
        </Col>
      )}
      {!isEmpty(previousTags) && (
        <Col span={24}>
          <Row align="middle" gutter={[12, 12]} wrap={false}>
            <Col className="h-4">
              <DeletedIcon height={14} width={14} />
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
