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
import {
  ArrowRight,
  TextEditorBlockquote,
  TextEditorBold,
  TextEditorBulletedList,
  TextEditorCode,
  TextEditorEmoji,
  TextEditorHashtag,
  TextEditorItalic,
  TextEditorLink,
  TextEditorMention,
  TextEditorNumberedList,
  TextEditorStrikethrough,
  Type01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, {
  FC,
  RefObject,
  SVGProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getBackendFormat,
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../utils/FeedUtilsPure';
import ActivityFeedEditorNew from '../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { EditorContentRef } from '../RichTextEditor/RichTextEditor.interface';

// The design's restyle of the OSS ActivityFeedEditorNew, scoped to this
// editor: one input line with the formatting toggle and send button inside it,
// under a format bar of the design's icons. Quill builds this markup itself, so
// these reach it from the editor's root (Tailwind reads `_` in those selectors
// as a space, so no class here has one). `!`: Quill's snow theme and the
// FeedEditor's own styles are unlayered CSS, which beats Tailwind's utilities
// whatever their selector.
const ICON_CLASS = 'comment-composer-icon';

// The design's gray-blue border; in dark that scale turns navy, so it stays
// neutral. It also holds over FeedEditor's inline focus border, which all but
// vanishes in dark — and an edit box opens focused.
const EDITOR_BOX_CLASS = [
  'tw:[&_.editor-container]:border! tw:[&_.editor-container]:border-solid!',
  'tw:[&_.editor-container]:border-utility-gray-blue-100! tw:dark:[&_.editor-container]:border-primary!',
  'tw:[&_.editor-container]:rounded-[10px]! tw:[&_.editor-container]:bg-primary!',
  // Quill sets 13px Helvetica; comments read in the page's font at 14px.
  'tw:[&_.ql-container.ql-snow]:border-none! tw:[&_.ql-container.ql-snow]:bg-transparent!',
  'tw:[&_.ql-container.ql-snow]:font-[inherit]! tw:[&_.ql-container.ql-snow]:text-[14px]!',
];

// The format bar sits in the same box as the text, split by a hairline. It
// anchors the emoji picker, which the composer places by its button. The
// design's icons, drawn into Quill's buttons, replace Quill's and
// quill-emoji's icons and the @ / # glyphs, at 16px in Quill's own button box.
const FORMAT_BAR_CLASS = [
  'tw:[&_.ql-toolbar.ql-snow]:relative! tw:[&_.ql-toolbar.ql-snow]:px-2! tw:[&_.ql-toolbar.ql-snow]:py-1!',
  'tw:[&_.ql-toolbar.ql-snow]:border-0! tw:[&_.ql-toolbar.ql-snow]:border-b!',
  'tw:[&_.ql-toolbar.ql-snow]:border-solid! tw:[&_.ql-toolbar.ql-snow]:border-b-secondary!',
  'tw:[&_.ql-toolbar_.ql-formats_button]:text-quaternary!',
  'tw:[&_.ql-toolbar_.ql-formats_button>svg:not(.comment-composer-icon)]:hidden!',
  'tw:[&_.ql-toolbar_.ql-formats_button]:after:content-none!',
  // The editor zeroes the @ / # buttons' padding for their glyphs.
  'tw:[&_.ql-toolbar_button.ql-insertMention]:px-[5px]! tw:[&_.ql-toolbar_button.ql-insertMention]:py-[3px]!',
  'tw:[&_.ql-toolbar_button.ql-insertRef]:px-[5px]! tw:[&_.ql-toolbar_button.ql-insertRef]:py-[3px]!',
  'tw:[&_.ql-toolbar_.ql-formats_button:hover]:text-fg-brand-primary!',
  'tw:[&_.ql-toolbar_.ql-formats_button:focus-visible]:text-fg-brand-primary!',
  'tw:[&_.ql-toolbar_.ql-formats_button.ql-active]:text-fg-brand-primary!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:block!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:float-none!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:size-4!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:mx-auto!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:my-px!',
];

// One line of text, clear of the toggle and send button on the right.
// `.editor-container` outranks the FeedEditor's own 100px minimum.
const TEXT_CLASS = [
  'tw:[&_.ql-editor]:min-h-11! tw:[&_.ql-editor]:pt-3! tw:[&_.ql-editor]:pb-3!',
  'tw:[&_.ql-editor]:pl-3.5! tw:[&_.ql-editor]:pr-25!',
  'tw:[&_.ql-editor]:bg-transparent! tw:[&_.ql-editor]:rounded-[10px]!',
  // A list starts at the text's edge: its items' padding holds the marker.
  'tw:[&_.ql-editor_ol]:pl-0!',
  // FeedEditor hard-codes the "Use @mention…" placeholder: the design's copy
  // comes from the component as a CSS variable, so it stays translated.
  // Quill's own placeholder color is invisible on a dark surface.
  'tw:[&_.ql-editor.ql-blank]:before:content-(--comment-composer-placeholder)!',
  'tw:[&_.ql-editor.ql-blank]:before:not-italic! tw:[&_.ql-editor.ql-blank]:before:left-3.5!',
  'tw:dark:[&_.ql-editor.ql-blank]:before:text-placeholder!',
];

// The @ / # suggestion list, in the core Dropdown's style: a padded overlay
// with inset rounded rows.
const MENTION_LIST_CLASS = [
  'tw:[&_.ql-mention-list-container]:w-62! tw:[&_.ql-mention-list-container]:py-1!',
  'tw:[&_.ql-mention-list-container]:border-none!',
  'tw:[&_.ql-mention-list-container]:rounded-lg! tw:[&_.ql-mention-list-container]:outline-1!',
  'tw:[&_.ql-mention-list-container]:outline-solid!',
  'tw:[&_.ql-mention-list-container]:-outline-offset-1!',
  'tw:[&_.ql-mention-list-container]:outline-subtle!',
  'tw:[&_.ql-mention-list-container]:bg-overlay-surface!',
  // The theme's `shadow-lg` is empty here; the token carries the values.
  'tw:[&_.ql-mention-list-container]:[box-shadow:var(--om-shadow-lg)]!',
  'tw:[&_.ql-mention-list-item]:mx-1.5! tw:[&_.ql-mention-list-item]:my-px!',
  'tw:[&_.ql-mention-list-item]:px-2.5! tw:[&_.ql-mention-list-item]:py-2!',
  'tw:[&_.ql-mention-list-item]:rounded-md! tw:[&_.ql-mention-list-item]:text-[14px]!',
  'tw:[&_.ql-mention-list-item]:text-secondary!',
  'tw:[&_.ql-mention-list-item.selected]:bg-primary_hover!',
  'tw:[&_.ql-mention-list-item.disabled]:cursor-default! tw:[&_.ql-mention-list-item.disabled]:text-tertiary!',
];

// The link bubble is a fixed 300px with nowrap content, so its chips overflow
// here: a flex row bounded by the editor's width instead. `:not(.ql-hidden)`
// keeps Quill's hide rule winning. Quill's editing mode zeroes the Save chip's
// right padding, leaving its label flush with the chip's edge. Its ::before and
// ::after are reached in the selector, not with `before:`/`after:`, which would
// also reset their `content` ("Enter Url:", "Save").
const LINK_TOOLTIP_CLASS = [
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)]:flex!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)]:items-center!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)]:gap-2!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)]:w-[min(420px,calc(100%-16px))]!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)::before]:shrink-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_input[type=text]]:flex-auto!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_input[type=text]]:min-w-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_input[type=text]]:w-auto!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-preview]:flex-auto!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-preview]:min-w-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-preview]:w-auto!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-action]:shrink-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-remove]:shrink-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden).ql-editing_a.ql-action::after]:pr-2!',
];

const EDITOR_CLASS = classNames(
  EDITOR_BOX_CLASS,
  FORMAT_BAR_CLASS,
  TEXT_CLASS,
  MENTION_LIST_CLASS,
  LINK_TOOLTIP_CLASS
);

// The format bar shows only while the formatting toggle beside send is on.
const COLLAPSED_CLASS = 'tw:[&_.ql-toolbar.ql-snow]:hidden!';

// quill-emoji opens its picker above the editor when the editor sits in the
// lower half of the window, by this inline top.
const EMOJI_PICKER_ABOVE_TOP = '-250px';

/**
 * The format bar's buttons, by the class Quill or quill-emoji gives each, and
 * the design's icon for it. Quill draws its icons from one app-wide registry,
 * so the composer draws these into its own buttons instead and hides Quill's.
 */
const FORMAT_BAR_ICONS: ReadonlyArray<
  readonly [string, FC<SVGProps<SVGSVGElement>>]
> = [
  ['.ql-bold', TextEditorBold],
  ['.ql-italic', TextEditorItalic],
  ['.ql-strike', TextEditorStrikethrough],
  ['.ql-blockquote', TextEditorBlockquote],
  ['.ql-code-block', TextEditorCode],
  ['.ql-list[value="ordered"]', TextEditorNumberedList],
  ['.ql-list[value="bullet"]', TextEditorBulletedList],
  ['.ql-link', TextEditorLink],
  ['.ql-insertMention', TextEditorMention],
  ['.ql-insertRef', TextEditorHashtag],
  ['.textarea-emoji-control', TextEditorEmoji],
];

const isSameButtons = (a: Array<Element | null>, b: Array<Element | null>) =>
  a.length === b.length && a.every((button, index) => button === b[index]);

/**
 * Watches the editor's format bar, which loads lazily, is rebuilt when Quill
 * re-initialises and gains the emoji button after the rest. Returns its
 * buttons in {@link FORMAT_BAR_ICONS} order, and anchors the emoji picker:
 * quill-emoji drops it into the bar with no horizontal position, so it lands
 * at the composer's far edge. It is pinned to its button, above or below as
 * the module chose, and the button is marked open while it shows.
 */
const useFormatBar = (hostRef: RefObject<HTMLElement>) => {
  const [buttons, setButtons] = useState<Array<Element | null>>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    // Read afresh each time: the editor loads lazily, and quill rebuilds its
    // bar when it re-initialises.
    const sync = () => {
      const toolbar = host.querySelector<HTMLElement>('.ql-toolbar');
      const next = FORMAT_BAR_ICONS.map(
        ([selector]) => toolbar?.querySelector(selector) ?? null
      );
      setButtons((current) => (isSameButtons(current, next) ? current : next));
      const button = toolbar?.querySelector<HTMLElement>(
        '.textarea-emoji-control'
      );
      const picker = toolbar?.querySelector<HTMLElement>('#textarea-emoji');
      button?.classList.toggle('ql-active', Boolean(picker));
      button?.setAttribute('aria-expanded', String(Boolean(picker)));
      if (toolbar && button && picker) {
        // Read the module's choice once: the first pass clears that top, and
        // any later node change (an icon drawn, a palette tab) passes again.
        picker.dataset.above ??= String(
          picker.style.top === EMOJI_PICKER_ABOVE_TOP
        );
        const isAbove = picker.dataset.above === 'true';
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
    sync();

    return () => observer.disconnect();
  }, [hostRef]);

  return buttons;
};

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
  const formatBarButtons = useFormatBar(editorHostRef);

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
              className={classNames(
                isFormatting &&
                  'tw:bg-brand-primary tw:text-brand-secondary tw:hover:bg-brand-primary tw:hover:text-brand-secondary'
              )}
              color="tertiary"
              data-testid="formatting-toggle"
              icon={Type01}
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
        <Typography className="tw:text-tertiary" size="text-xs">
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
