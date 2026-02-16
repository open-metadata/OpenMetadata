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
import { useMemo } from 'react';
import { ReactComponent as AddIcon } from '../../../../../assets/svg/added-icon.svg';
import { ReactComponent as UpdatedIcon } from '../../../../../assets/svg/updated-icon.svg';
import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import { getFrontEndFormat } from '../../../../../utils/FeedUtils';
import RichTextEditorPreviewNew from '../../../../common/RichTextEditor/RichTextEditorPreviewNew';

interface ActivityDescriptionFeedProps {
  activity: ActivityEvent;
}

function ActivityDescriptionFeed({
  activity,
}: Readonly<ActivityDescriptionFeedProps>) {
  const { description, isAdded } = useMemo(() => {
    const oldDesc = activity.oldValue ?? '';
    const newDesc = activity.newValue ?? '';

    const isAdded = !oldDesc && newDesc;

    return {
      description: newDesc || oldDesc,
      isAdded,
    };
  }, [activity.oldValue, activity.newValue]);

  const operationIcon = useMemo(() => {
    const Icon = isAdded ? AddIcon : UpdatedIcon;

    return <Icon height={16} width={16} />;
  }, [isAdded]);

  return (
    <Row gutter={[12, 12]} wrap={false}>
      <Col className="h-4">{operationIcon}</Col>
      <Col>
        <RichTextEditorPreviewNew
          className="text-wrap"
          markdown={getFrontEndFormat(description)}
        />
      </Col>
    </Row>
  );
}

export default ActivityDescriptionFeed;
