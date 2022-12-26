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

import React from 'react';
import { EntityReference } from '../../generated/type/entityReference';
import { getDataLabel } from '../../utils/EntityLineageUtils';
import { getEntityIcon } from '../../utils/TableUtils';

const LineageNodeLabel = ({ node }: { node: EntityReference }) => {
  return (
    <p className="tw-flex tw-items-center tw-m-0 tw-py-3">
      <span className="tw-mr-2">{getEntityIcon(node.type)}</span>
      {getDataLabel(
        node.displayName,
        node.fullyQualifiedName,
        false,
        node.type
      )}
    </p>
  );
};

export default LineageNodeLabel;
