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

import { Tabs } from '@openmetadata/ui-core-components';
import { Change } from 'diff';
import { isEqual } from 'lodash';
import { lazy, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../../components/AppRouter/withSuspenseFallback';
import { EditorContentRef } from '../../../components/common/RichTextEditor/RichTextEditor.interface';
import RichTextEditorPreviewerV1 from '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorPureUtils';
import { getDescriptionDiff } from '../../../utils/TaskPayloadUtils';
import DiffView from './DiffView/DiffView';
const RichTextEditor = withSuspenseFallback(
  lazy(() => import('../../../components/common/RichTextEditor/RichTextEditor'))
);

interface Props {
  value: string;
  suggestion: string;
  placeHolder?: string;
  onChange?: (value: string) => void;
}

export const DescriptionTabs = ({
  value = '',
  suggestion,
  placeHolder,
  onChange,
}: Props) => {
  const { t } = useTranslation();
  const [description] = useState(value);
  const [diffs, setDiffs] = useState<Change[]>([]);
  const [activeTab, setActiveTab] = useState<string>('3');
  const markdownRef = useRef<EditorContentRef>({} as EditorContentRef);

  const onTabChange = useCallback(
    (key: string) => {
      setActiveTab(key);
      if (isEqual(key, '2')) {
        const newDescription = markdownRef.current?.getEditorContent?.();
        const isEmptyDescription = isDescriptionContentEmpty(newDescription);
        if (newDescription) {
          const diff = getDescriptionDiff(
            description,
            isEmptyDescription ? '' : newDescription
          );
          setDiffs(diff);
        }
      } else {
        setDiffs([]);
      }
    },
    [markdownRef]
  );

  return (
    <Tabs
      data-testid="tabs"
      selectedKey={activeTab}
      onSelectionChange={(key) => onTabChange(String(key))}>
      <Tabs.List className="tw:self-start" size="sm" type="button-border">
        <Tabs.Item data-testid="current-tab" id="1" label="Current" />
        <Tabs.Item data-testid="diff-tab" id="2" label="Diff" />
        <Tabs.Item data-testid="new-tab" id="3" label="New" />
      </Tabs.List>
      <Tabs.Panel id="1">
        <div className="border border-main rounded-4 p-sm m-t-sm">
          {description?.trim() ? (
            <RichTextEditorPreviewerV1
              enableSeeMoreVariant={false}
              markdown={description}
            />
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', { entity: t('label.description') })}
            </span>
          )}
        </div>
      </Tabs.Panel>
      <Tabs.Panel id="2">
        <DiffView
          className="border border-main rounded-4 p-sm m-t-sm"
          diffArr={diffs}
        />
      </Tabs.Panel>
      {/* Kept mounted so the editor keeps its edits and the Diff tab can read them via markdownRef. */}
      <Tabs.Panel shouldForceMount className="tw:data-inert:hidden" id="3">
        <RichTextEditor
          className="m-t-sm"
          initialValue={suggestion}
          placeHolder={placeHolder ?? t('label.update-description')}
          ref={markdownRef}
          onTextChange={onChange}
        />
      </Tabs.Panel>
    </Tabs>
  );
};
