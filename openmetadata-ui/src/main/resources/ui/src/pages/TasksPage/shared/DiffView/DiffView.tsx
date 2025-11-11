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

import classNames from 'classnames';
import { Change } from 'diff';
import { uniqueId } from 'lodash';
import { useTranslation } from 'react-i18next';
import RichTextEditorPreviewerV1 from '../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import './diff-view.less';

const DiffView = ({
  diffArr,
  className,
}: {
  diffArr: Change[];
  className?: string;
}) => {
  const { t } = useTranslation();
  const elements = diffArr.map((diff) => {
    if (diff.added) {
      return (
        <ins className="diff-added" data-testid="diff-added" key={uniqueId()}>
          <RichTextEditorPreviewerV1 markdown={diff.value} />
        </ins>
      );
    }
    if (diff.removed) {
      return (
        <del
          data-testid="diff-removed"
          key={uniqueId()}
          style={{ color: 'grey', textDecoration: 'line-through' }}>
          <RichTextEditorPreviewerV1 markdown={diff.value} />
        </del>
      );
    }

    return (
      <span data-testid="diff-normal" key={uniqueId()}>
        <RichTextEditorPreviewerV1 markdown={diff.value} />
      </span>
    );
  });

  return (
    <div className={classNames('w-full h-max-56 overflow-y-auto', className)}>
      <pre
        className="whitespace-pre-wrap m-b-0 diff-container"
        data-testid="diff-container">
        {diffArr.length ? (
          elements
        ) : (
          <span className="text-grey-muted" data-testid="noDiff-placeholder">
            {t('label.no-diff-available')}
          </span>
        )}
      </pre>
    </div>
  );
};

export default DiffView;
