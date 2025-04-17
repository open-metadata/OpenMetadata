/*
 *  Copyright 2023 Collate.
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
import { Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { FC } from 'react';
import { Column } from '../../../../generated/entity/data/container';
import { getEntityName } from '../../../../utils/EntityUtils';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import TagsViewer from '../../../Tag/TagsViewer/TagsViewer';

interface ColumnSummaryProps {
  column: Column;
}

const ColumnSummary: FC<ColumnSummaryProps> = ({ column }) => {
  return (
    <div className="summary-card h-full">
      <Space>
        <Typography className="font-medium">{getEntityName(column)}</Typography>

        <Typography.Text className="text-xs text-grey-muted">{`(${column.dataType})`}</Typography.Text>
      </Space>

      <RichTextEditorPreviewerV1
        className="text-grey-muted m-t-xs"
        markdown={column.description ?? ''}
        maxLength={184}
      />

      {!isEmpty(column.tags) ? (
        <div className="m-t-xs">
          <TagsViewer sizeCap={3} tags={column.tags ?? []} />
        </div>
      ) : null}
    </div>
  );
};

export default ColumnSummary;
