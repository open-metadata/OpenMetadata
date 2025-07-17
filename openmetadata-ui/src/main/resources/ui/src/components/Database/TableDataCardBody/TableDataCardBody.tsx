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

import { RichTextEditorPreviewerV1 } from '@openmetadata/common-ui';
import { isEmpty, isNil } from 'lodash';
import { ExtraInfo } from 'Models';
import { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getTagValue } from '../../../utils/CommonUtils';
import EntitySummaryDetails from '../../common/EntitySummaryDetails/EntitySummaryDetails';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';

type Props = {
  description: string;
  extraInfo: Array<ExtraInfo>;
  tags?: string[] | TagLabel[];
};

const TableDataCardBody: FunctionComponent<Props> = ({
  description,
  extraInfo,
  tags,
}: Props) => {
  const { t } = useTranslation();

  return (
    <div data-testid="table-body">
      <div className="m-b-sm description-text" data-testid="description-text">
        {description.trim() ? (
          <RichTextEditorPreviewerV1
            className="max-two-lines"
            markdown={description}
            showReadMoreBtn={false}
          />
        ) : (
          <span className="">{t('label.no-description')}</span>
        )}
      </div>
      <div className="d-flex items-center flex-wrap text-xs text-grey-muted">
        {extraInfo.map((info, i) =>
          !isNil(info.value) ? (
            <span
              className="d-flex items-center"
              data-testid={info.key}
              key={info.key}>
              <EntitySummaryDetails data={info} />
              {i !== extraInfo.length - 1 && (
                <span className="px-1.5 d-inline-block text-lg font-semibold">
                  {t('label.middot-symbol')}
                </span>
              )}
            </span>
          ) : null
        )}
      </div>
      {!isEmpty(tags) && (
        <div className="m-t-md" data-testid="tags-container">
          <TagsViewer
            sizeCap={3}
            tags={(tags ?? []).map((tag) => getTagValue(tag))}
          />
        </div>
      )}
    </div>
  );
};

export default TableDataCardBody;
