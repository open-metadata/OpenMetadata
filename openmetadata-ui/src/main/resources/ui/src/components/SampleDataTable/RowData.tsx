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

import React, { Fragment, useState } from 'react';
import SchemaModal from '../Modals/SchemaModal/SchemaModal';

// eslint-disable-next-line
export const RowData = ({ data }: { data: any }) => {
  const [isFullView, setIsFullView] = useState<boolean>(false);

  const onClose = () => setIsFullView(false);
  const onOpen = () => setIsFullView(true);

  // eslint-disable-next-line
  const getDataElement = (rowValue: any) => {
    if (typeof rowValue === 'object') {
      return (
        <p
          className="tw-w-52 tw-truncate tw-cursor-pointer"
          data-testid="json-object"
          onClick={onOpen}>
          {JSON.stringify(rowValue)}
        </p>
      );
    }

    return <p data-testid="string-data">{rowValue.toString()}</p>;
  };

  return (
    <Fragment>
      {data ? getDataElement(data) : <p data-testid="empty-data">--</p>}
      <SchemaModal data={data} visible={isFullView} onClose={onClose} />
    </Fragment>
  );
};
