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

import { Box, Grid } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../../../utils/common/layout.utils';

import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { ReactComponent as AddIcon } from '../../../../../assets/svg/added-icon.svg';
import { ReactComponent as DeletedIcon } from '../../../../../assets/svg/deleted-icon.svg';
import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import { TagLabel } from '../../../../../generated/type/tagLabel';
import TagsViewer from '../../../../Tag/TagsViewer/TagsViewer';

interface ActivityTagsFeedProps {
  activity: ActivityEvent;
}

function ActivityTagsFeed({ activity }: Readonly<ActivityTagsFeedProps>) {
  const { previousTags, updatedTags } = useMemo(() => {
    let oldTags: TagLabel[] = [];
    let newTags: TagLabel[] = [];

    try {
      if (activity.oldValue) {
        const parsed = JSON.parse(activity.oldValue);
        oldTags = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      oldTags = [];
    }

    try {
      if (activity.newValue) {
        const parsed = JSON.parse(activity.newValue);
        newTags = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      newTags = [];
    }

    const oldTagFQNs = new Set(oldTags.map((t) => t.tagFQN));
    const newTagFQNs = new Set(newTags.map((t) => t.tagFQN));

    const addedTags = newTags.filter((t) => !oldTagFQNs.has(t.tagFQN));
    const removedTags = oldTags.filter((t) => !newTagFQNs.has(t.tagFQN));

    return {
      previousTags: removedTags,
      updatedTags: addedTags,
    };
  }, [activity.oldValue, activity.newValue]);

  return (
    <Grid
      className="layout-row layout-grid"
      style={{ ...getLayoutGutter(8, 8) }}>
      {!isEmpty(updatedTags) && (
        <Grid.Item className="layout-column" span={24}>
          <Box
            align="center"
            className="layout-row"
            style={{ ...getLayoutGutter(12, 12) }}
            wrap="nowrap">
            <Box className="layout-column tw:block h-4">
              <AddIcon height={16} width={16} />
            </Box>
            <Box className="layout-column tw:block">
              <TagsViewer tags={updatedTags} />
            </Box>
          </Box>
        </Grid.Item>
      )}
      {!isEmpty(previousTags) && (
        <Grid.Item className="layout-column" span={24}>
          <Box
            align="center"
            className="layout-row"
            style={{ ...getLayoutGutter(12, 12) }}
            wrap="nowrap">
            <Box className="layout-column tw:block h-4">
              <DeletedIcon height={14} width={14} />
            </Box>
            <Box className="layout-column tw:block">
              <TagsViewer tags={previousTags} />
            </Box>
          </Box>
        </Grid.Item>
      )}
    </Grid>
  );
}

export default ActivityTagsFeed;
