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

import { Typography } from 'antd';
import { isNil, isObject, noop } from 'lodash';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import SchemaModal from '../../Modals/SchemaModal/SchemaModal';
import { SampleDataType } from './SampleData.interface';

export const RowData = ({ data }: { data: SampleDataType }) => {
  const [isFullView, setIsFullView] = useState<boolean>(false);

  const onClose = useCallback(() => setIsFullView(false), []);
  const onOpen = useCallback(() => setIsFullView(true), []);

  const dataElementRenderer = useMemo(() => {
    if (isNil(data) || data === '') {
      return (
        <Typography.Text data-testid="empty-data">
          {NO_DATA_PLACEHOLDER}
        </Typography.Text>
      );
    } else if (isObject(data)) {
      return (
        <Typography.Paragraph
          className="w-52 cursor-pointer"
          data-testid="json-object"
          ellipsis={{ rows: 4 }}
          onClick={onOpen}>
          {JSON.stringify(data)}
        </Typography.Paragraph>
      );
    } else {
      return (
        <Typography.Text data-testid="string-data">
          {data.toString()}
        </Typography.Text>
      );
    }
  }, [data, onOpen]);

  return (
    <Fragment>
      {dataElementRenderer}
      {isFullView && (
        <SchemaModal
          data={data}
          visible={isFullView}
          onClose={onClose}
          onSave={noop}
        />
      )}
    </Fragment>
  );
};
