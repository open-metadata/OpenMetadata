/*
 *  Copyright 2026 Collate.
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

import { Box, Button } from '@openmetadata/ui-core-components';
import { ArrowRight } from '@untitledui/icons';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ActivityFeedEditorNew from '../../../../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { EditorContentRef } from '../../../../../components/common/RichTextEditor/RichTextEditor.interface';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { getBackendFormat } from '../../../../../utils/FeedUtilsPure';
import './inbox-comment-composer.less';

export interface InboxCommentComposerProps {
  onSave: (message: string) => void;
  placeHolder?: string;
  focused?: boolean;
}

/**
 * Comment composer shared by the Inbox (Activity drawer + Task detail). It
 * reuses the OSS {@link ActivityFeedEditorNew} verbatim — so mention (@),
 * hashtag (#), markdown, the send button and Enter-to-send all keep working —
 * and only restyles it via the scoped `inbox-comment-composer__editor` class:
 * the format bar over one white input line. The send button is the design's
 * arrow button in place of the editor's own, disabled until there is something
 * to send; Enter still sends through the editor. The current user's avatar
 * sits on the left.
 */
const InboxCommentComposer: React.FC<InboxCommentComposerProps> = ({
  onSave,
  placeHolder,
  focused,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const placeholderText = placeHolder ?? t('message.leave-a-comment');
  const editorRef = useRef<EditorContentRef>(null);
  const [hasText, setHasText] = useState(false);

  // The editor reports its markdown on every change; whitespace alone is not a
  // comment, so it keeps the send button disabled.
  const handleTextChange = useCallback((message: string) => {
    setHasText(message.trim().length > 0);
  }, []);

  // Enter sends through the editor, which clears itself; the draft is gone.
  const handleEditorSave = useCallback(
    (message: string) => {
      setHasText(false);
      onSave(message);
    },
    [onSave]
  );

  // Mirrors the editor's own Enter-to-send: post the content, then clear it.
  const handleSend = () => {
    const content = editorRef.current?.getEditorContent();
    if (content) {
      editorRef.current?.clearEditorContent();
      setHasText(false);
      onSave(getBackendFormat(content));
    }
  };

  return (
    <Box
      align="end"
      className="inbox-comment-composer"
      data-testid="inbox-comment-composer"
      gap={2}>
      {/* Centred on the 44px text row, not the toolbar above it. */}
      <ProfilePicture
        matchRingToFill
        className="tw:mb-2.5"
        displayName={currentUser?.displayName ?? currentUser?.name}
        name={currentUser?.name ?? ''}
        width="24"
      />
      {/* FeedEditor hard-codes its Quill placeholder, so feed it the figma
          copy through a CSS variable the scoped style reads. */}
      <div
        className="tw:min-w-0 tw:flex-1"
        style={
          {
            '--inbox-composer-placeholder': JSON.stringify(placeholderText),
          } as React.CSSProperties
        }>
        <ActivityFeedEditorNew
          className="inbox-comment-composer__editor tw:w-full"
          focused={focused}
          editAction={
            <Button
              aria-label={t('label.send')}
              className="tw:absolute tw:right-2 tw:bottom-1.5"
              color="primary"
              data-testid="send-button"
              iconLeading={<ArrowRight className="tw:size-4" />}
              isDisabled={!hasText}
              size="sm"
              onClick={handleSend}
            />
          }
          emptyMentionText={t('message.no-match-found')}
          placeHolder={placeholderText}
          ref={editorRef}
          onSave={handleEditorSave}
          onTextChange={handleTextChange}
        />
      </div>
    </Box>
  );
};

export default InboxCommentComposer;
