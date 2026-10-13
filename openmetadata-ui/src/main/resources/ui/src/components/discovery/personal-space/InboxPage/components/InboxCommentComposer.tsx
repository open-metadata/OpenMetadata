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
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import React, {
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import ActivityFeedEditorNew from '../../../../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { EditorContentRef } from '../../../../../components/common/RichTextEditor/RichTextEditor.interface';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import {
  getBackendFormat,
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../../utils/FeedUtilsPure';
import './inbox-comment-composer.less';

// quill-emoji opens its picker above the editor when the editor sits in the
// lower half of the window, by this inline top.
const EMOJI_PICKER_ABOVE_TOP = '-250px';

/**
 * quill-emoji drops its picker into the format bar with no horizontal
 * position, so it lands at the composer's far edge. Anchor it to its button,
 * above or below as the module chose, and mark the button open while it shows.
 */
const useEmojiPickerAnchor = (hostRef: RefObject<HTMLElement>) => {
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    // Read afresh each time: the editor loads lazily, and quill rebuilds its
    // bar when it re-initialises.
    const sync = () => {
      const toolbar = host.querySelector<HTMLElement>('.ql-toolbar');
      const button = toolbar?.querySelector<HTMLElement>(
        '.textarea-emoji-control'
      );
      const picker = toolbar?.querySelector<HTMLElement>('#textarea-emoji');
      button?.classList.toggle('ql-active', Boolean(picker));
      button?.setAttribute('aria-expanded', String(Boolean(picker)));
      if (toolbar && button && picker) {
        const isAbove = picker.style.top === EMOJI_PICKER_ABOVE_TOP;
        // Kept inside the bar where the button sits near its far edge.
        const left = Math.min(
          button.offsetLeft,
          toolbar.clientWidth - picker.offsetWidth
        );
        // `''` drops the module's inline top; quill-emoji's CSS pins `right`.
        Object.assign(picker.style, {
          left: `${Math.max(left, 0)}px`,
          right: 'auto',
          top: isAbove ? '' : '100%',
          bottom: isAbove ? '100%' : '',
        });
      }
    };
    // Node changes only: the styles set above never re-trigger it.
    const observer = new MutationObserver(sync);
    observer.observe(host, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [hostRef]);
};

export interface InboxCommentComposerProps {
  // A rejected promise puts the draft back in the editor.
  onSave: (message: string) => void | Promise<unknown>;
  placeHolder?: string;
  focused?: boolean;
}

/**
 * Comment composer shared by the Inbox (activity card threads + Task detail). It
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
  const editorHostRef = useRef<HTMLDivElement>(null);
  const [hasText, setHasText] = useState(false);
  useEmojiPickerAnchor(editorHostRef);

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
        ref={editorHostRef}
        style={
          {
            '--inbox-composer-placeholder': JSON.stringify(placeholderText),
          } as React.CSSProperties
        }>
        <ActivityFeedEditorNew
          className="inbox-comment-composer__editor tw:w-full"
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
          focused={focused}
          placeHolder={placeholderText}
          ref={editorRef}
          onSave={submit}
          onTextChange={handleTextChange}
        />
      </div>
    </Box>
  );
};

export default InboxCommentComposer;
