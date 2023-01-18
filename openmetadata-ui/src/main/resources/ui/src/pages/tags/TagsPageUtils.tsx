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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Loader from 'components/Loader/Loader';
import React from 'react';
import SVGIcons from 'utils/SvgUtils';
import { DeleteTagsType } from './TagsPage.interface';

export const getDeleteIcon = (
  deleteTags: DeleteTagsType,
  id: string | undefined
) => {
  if (deleteTags.data?.id === id) {
    if (deleteTags.data?.status === 'success') {
      return <FontAwesomeIcon icon="check" />;
    }

    return <Loader size="small" type="default" />;
  }

  return (
    <SVGIcons alt="delete" icon="icon-delete" title="Delete" width="16px" />
  );
};
