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

import {
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight, Type01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FORMAT_BAR_ICONS } from '../../../constants/CommentComposer.constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCommentFormatBar } from '../../../hooks/useCommentFormatBar';
import {
  getBackendFormat,
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../utils/FeedUtilsPure';
import ActivityFeedEditorNew from '../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { EditorContentRef } from '../RichTextEditor/RichTextEditor.interface';
import {
  COLLAPSED_CLASS,
  EDITOR_CLASS,
  ICON_CLASS,
} from './CommentComposer.constants';

export interface CommentEditorProps {
  // A rejected promise puts the draft back in the editor.
  onSave: (message: string) => void | Promise<unknown>;
  placeHolder?: string;
  focused?: boolean;
  // The message being edited, as HTML; the send button starts enabled.
  defaultValue?: string;
}

/**
 * A comment editor: the OSS {@link ActivityFeedEditorNew} verbatim —
 * so mention (@), hashtag (#), markdown and Enter-to-send all keep working —
 * restyled through the scoped classes above (EDITOR_CLASS), with the
 * design's format-bar icons and its arrow send button, disabled until there is
 * something to send. The format bar starts hidden, one line of text; the
 * formatting toggle beside send shows it, and stays highlighted while it shows.
 * A new comment and an edited one use the same box.
 */
export const CommentEditor: React.FC<CommentEditorProps> = ({
  onSave,
  placeHolder,
  focused,
  defaultValue,
}) => {
  const { t } = useTranslation();
  const placeholderText = placeHolder ?? t('message.leave-a-comment');
  const editorRef = useRef<EditorContentRef>(null);
  const editorHostRef = useRef<HTMLDivElement>(null);
  const [hasText, setHasText] = useState(Boolean(defaultValue));
  const [isFormatting, setIsFormatting] = useState(false);
  const formatBarButtons = useCommentFormatBar(editorHostRef);

  // The editor reports its markdown on every change; whitespace alone is not a
  // comment, so it keeps the send button disabled.
  const handleTextChange = useCallback((message: string) => {
    setHasText(message.trim().length > 0);
  }, []);

  // The editor is already empty when this runs, so a save that fails writes
  // the draft back rather than losing it.
  const submit = useCallback(
    (message: string) => {
      setHasText(false);
      Promise.resolve(onSave(message)).catch(() => {
        editorRef.current?.setEditorContent(
          MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(message))
        );
        setHasText(true);
      });
    },
    [onSave]
  );

  // Mirrors the editor's own Enter-to-send, which clears itself first.
  const handleSend = () => {
    const content = editorRef.current?.getEditorContent();
    if (content) {
      editorRef.current?.clearEditorContent();
      submit(getBackendFormat(content));
    }
  };

  return (
    // FeedEditor hard-codes its Quill placeholder, so feed it the figma copy
    // through a CSS variable the scoped style reads.
    <div
      className="tw:min-w-0 tw:flex-1"
      ref={editorHostRef}
      style={
        {
          '--comment-composer-placeholder': JSON.stringify(placeholderText),
        } as React.CSSProperties
      }>
      <ActivityFeedEditorNew
        className={classNames(
          EDITOR_CLASS,
          'tw:w-full',
          !isFormatting && COLLAPSED_CLASS
        )}
        defaultValue={defaultValue}
        editAction={
          <Box
            align="center"
            className="tw:absolute tw:right-2 tw:bottom-1.5"
            gap={2}>
            <ButtonUtility
              color="tertiary"
              data-testid="formatting-toggle"
              icon={Type01}
              isSelected={isFormatting}
              size="lg"
              tooltip={t(
                isFormatting ? 'label.hide-formatting' : 'label.show-formatting'
              )}
              onClick={() => setIsFormatting((open) => !open)}
            />
            <span
              aria-hidden
              className="tw:h-5 tw:w-px tw:bg-border-secondary"
            />
            <Button
              aria-label={t('label.send')}
              color="primary"
              data-testid="send-button"
              iconLeading={<ArrowRight className="tw:size-4" />}
              isDisabled={!hasText}
              size="sm"
              onClick={handleSend}
            />
          </Box>
        }
        emptyMentionText={t('message.no-match-found')}
        focused={focused}
        placeHolder={placeholderText}
        ref={editorRef}
        onSave={submit}
        onTextChange={handleTextChange}
      />
      {formatBarButtons.map((button, index) => {
        const [selector, Icon] = FORMAT_BAR_ICONS[index];

        return (
          button &&
          createPortal(
            <Icon className={ICON_CLASS} height={20} width={20} />,
            button,
            selector
          )
        );
      })}
    </div>
  );
};

export interface CommentEditFormProps {
  // The comment being edited, as stored (markdown).
  message: string;
  onSave: (message: string) => Promise<unknown>;
  onCancel: () => void;
  // Names the editor `<testId>-editor` and its cancel `cancel-<testId>`.
  testId: string;
}

/**
 * A comment opened for editing: the same editor a new comment is written in,
 * over a row with the new-line hint on the left and Cancel on the right.
 */
export const CommentEditForm: React.FC<CommentEditFormProps> = ({
  message,
  onSave,
  onCancel,
  testId,
}) => {
  const { t } = useTranslation();

  return (
    <Box data-testid={`${testId}-editor`} direction="col" gap={2}>
      <CommentEditor
        focused
        defaultValue={MarkdownToHTMLConverter.makeHtml(
          getFrontEndFormat(message)
        )}
        onSave={onSave}
      />
      <Box align="center" className="tw:justify-between" gap={2}>
        <Typography color="secondary" size="text-xs">
          <kbd>{t('label.shift')}</kbd>
          {t('label.plus-symbol')} <kbd>{t('label.return')}</kbd>{' '}
          {t('message.to-add-new-line')}
        </Typography>
        <Button
          color="link-gray"
          data-testid={`cancel-${testId}`}
          size="sm"
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
      </Box>
    </Box>
  );
};

export interface CommentComposerProps {
  // A rejected promise puts the draft back in the editor.
  onSave: (message: string) => void | Promise<unknown>;
  placeHolder?: string;
  focused?: boolean;
}

/**
 * A comment composer: the current user's avatar beside the
 * {@link CommentEditor}. Used wherever a thread takes a comment: the Inbox's
 * activity threads and task detail, an entity's Activity tab, and Collate's
 * access-request drawer.
 */
const CommentComposer: React.FC<CommentComposerProps> = (props) => {
  const { currentUser } = useApplicationStore();

  return (
    <Box
      align="end"
      className="comment-composer"
      // Kept from its Inbox days: OSS and Collate specs find it by this id.
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
      <CommentEditor {...props} />
    </Box>
  );
};

export default CommentComposer;
