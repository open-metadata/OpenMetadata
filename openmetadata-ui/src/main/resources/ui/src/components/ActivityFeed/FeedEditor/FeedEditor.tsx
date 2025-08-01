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
/* eslint-disable @typescript-eslint/ban-ts-comment */

import { TextAreaEmoji } from '@windmillcode/quill-emoji';
import classNames from 'classnames';
import { debounce, isNil } from 'lodash';
import { Parchment } from 'quill';
import 'quill-mention/autoregister';
import QuillMarkdown from 'quilljs-markdown';
import {
  forwardRef,
  KeyboardEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactDOMServer from 'react-dom/server';
import { useTranslation } from 'react-i18next';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { BORDER_COLOR } from '../../../constants/constants';
import {
  MENTION_ALLOWED_CHARS,
  MENTION_DENOTATION_CHARS,
  TOOLBAR_ITEMS,
} from '../../../constants/Feeds.constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getUserByName } from '../../../rest/userAPI';
import {
  HTMLToMarkdown,
  suggestions,
  userMentionItemWithAvatar,
} from '../../../utils/FeedUtils';
import { LinkBlot } from '../../../utils/QuillLink/QuillLink';
import { insertMention, insertRef } from '../../../utils/QuillUtils';
import { getSanitizeContent } from '../../../utils/sanitize.utils';
import searchClassBase from '../../../utils/SearchClassBase';
import { EditorContentRef } from '../../common/RichTextEditor/RichTextEditor.interface';
import './feed-editor.less';
import { FeedEditorProp, MentionSuggestionsItem } from './FeedEditor.interface';
import './quill-emoji.css';

Quill.register('modules/markdownOptions', QuillMarkdown);
Quill.register(LinkBlot as unknown as Parchment.RegistryDefinition);
Quill.register('modules/emoji-textarea', TextAreaEmoji, true);
const Delta = Quill.import('delta');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const strikethrough = (_node: any, delta: typeof Delta) => {
  // @ts-ignore
  return 'compose' in delta && delta.compose instanceof Function
    ? // @ts-ignore
      delta.compose(new Delta().retain(delta.length, { strike: true }))
    : null;
};

export const FeedEditor = forwardRef<EditorContentRef, FeedEditorProp>(
  (
    {
      className,
      editorClass,
      onChangeHandler,
      defaultValue,
      focused = false,
      onSave,
    }: FeedEditorProp,
    ref
  ) => {
    const { t, i18n } = useTranslation();
    const editorRef = useRef<ReactQuill>(null);
    const [value, setValue] = useState(() =>
      getSanitizeContent(defaultValue ?? '')
    );
    const [isMentionListOpen, toggleMentionList] = useState(false);
    const [isFocused, toggleFocus] = useState(false);

    const { userProfilePics } = useApplicationStore();

    const handleClickOutside = useCallback((event: MouseEvent) => {
      const emojiContainer = document.querySelector(
        '#om-quill-editor #textarea-emoji'
      ) as HTMLElement;
      const emojiToggleButton = document.querySelector(
        '#om-quill-editor .textarea-emoji-control.ql-list'
      ) as HTMLElement;

      if (
        emojiContainer &&
        !emojiContainer.contains(event.target as Node) &&
        emojiToggleButton &&
        !emojiToggleButton.contains(event.target as Node)
      ) {
        emojiToggleButton.click(); // Simulates a click to close the emoji container
      }
    }, []);

    useEffect(() => {
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [handleClickOutside]);
    const userSuggestionRenderer = async (
      searchTerm: string,
      renderList: (matches: MentionSuggestionsItem[], search: string) => void,
      mentionChar: string
    ) => {
      const matches = await suggestions(searchTerm, mentionChar);
      const newMatches: MentionSuggestionsItem[] = [];
      try {
        // Fetch profile images in case of user listing
        const promises = matches.map(async (item, index) => {
          if (item.type === 'user') {
            return getUserByName(item.name, {
              fields: TabSpecificField.PROFILE,
            }).then((res) => {
              newMatches[index] = {
                ...item,
                avatarEle: userMentionItemWithAvatar(
                  item,
                  userProfilePics[item.name] ?? res
                ),
              };
            });
          } else if (item.type === 'team') {
            newMatches[index] = {
              ...item,
              avatarEle: userMentionItemWithAvatar(item),
            };
          } else {
            newMatches[index] = {
              ...item,
            };
          }

          return Promise.resolve();
        });
        await Promise.allSettled(promises);
      } catch (error) {
        // Empty
      } finally {
        renderList(newMatches, searchTerm);
      }
    };

    const renderItems = useCallback(
      (item: MentionSuggestionsItem) => {
        if (['user', 'team'].includes(item.type as string)) {
          return item.avatarEle;
        }

        const breadcrumbsData = item.breadcrumbs
          ? item.breadcrumbs.map((obj: { name: string }) => obj.name).join('/')
          : '';

        const breadcrumbEle = breadcrumbsData
          ? `<div class="d-flex flex-wrap">
              <span class="text-grey-muted truncate w-max-200 text-xss">${breadcrumbsData}</span>
            </div>`
          : '';

        const icon = searchClassBase.getEntityIcon(item.type ?? '');

        const iconString = ReactDOMServer.renderToString(icon ?? <></>);

        const typeSpan = !breadcrumbEle
          ? `<span class="text-grey-muted text-xs">${item.type}</span>`
          : '';

        const result = `<div class="d-flex items-center gap-2">
          <div class="flex-center mention-icon-image">${iconString}</div>
          <div>
            ${breadcrumbEle}
            <div class="d-flex flex-col">
              ${typeSpan}
              <span class="font-medium truncate w-56">${item.name}</span>
            </div>
          </div>
        </div>`;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = result;

        return wrapper;
      },
      [userProfilePics]
    );
    /**
     * Prepare modules for editor
     */
    const modules = useMemo(
      () => ({
        toolbar: {
          container: TOOLBAR_ITEMS,
          handlers: {
            insertMention: insertMention,
            insertRef: insertRef,
          },
        },
        'emoji-textarea': true,
        mention: {
          allowedChars: MENTION_ALLOWED_CHARS,
          mentionDenotationChars: MENTION_DENOTATION_CHARS,
          blotName: 'link-mention',
          onOpen: () => {
            toggleMentionList(false);
          },
          onClose: () => {
            toggleMentionList(true);
          },
          onSelect: (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            item: Record<string, any>,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            insertItem: (item: Record<string, any>) => void
          ) => {
            toggleMentionList(true);
            insertItem(item);
          },
          source: debounce(userSuggestionRenderer, 300),
          showDenotationChar: false,
          renderLoading: () => `${t('label.loading')}...`,
          renderItem: renderItems,
        },
        markdownOptions: {},
        clipboard: {
          matchers: [['del, strike', strikethrough]],
        },
      }),
      []
    );

    const onSaveHandle = () => {
      if (onSave) {
        onSave();
      }
    };

    const onFocusHandle = () => {
      toggleFocus(true);
    };

    const onBlurHandle = () => {
      toggleFocus(false);
    };

    const getEditorStyles = () => {
      return isFocused ? { border: `1px solid ${BORDER_COLOR}` } : {};
    };

    /**
     * handle onKeyDown logic
     * @param e - keyboard event
     */
    const handleKeyDown = (e: KeyboardEvent) => {
      // This logic will handle Enter key binding
      if (e.key === 'Enter') {
        // Ignore Enter keydown events caused by IME operations during CJK text input.
        // https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event#keydown_events_with_ime
        // Note: `compositionstart` may fire after keydown when typing the first character that opens up the IME,
        // and compositionend may fire before keydown when typing the last character that closes the IME.
        // In these cases, isComposing is false even when the event is part of composition.
        // However, KeyboardEvent.keyCode is still 229 in these cases,
        // so it's still advisable to check keyCode as well, although it's deprecated.
        if (e.nativeEvent.isComposing || e.keyCode === 229) {
          return;
        }
        // handle enter keybinding for save
        if (!e.shiftKey && !isMentionListOpen) {
          e.preventDefault();
          onSaveHandle();
        }
        // handle enter keybinding for mention popup
        // set mention list state to false when mention item is selected
        else {
          toggleMentionList(false);
        }
      }
    };

    /**
     * Handle onChange logic and set updated value to state
     * @param updatedValue - updated value
     */
    const handleOnChange = (updatedValue: string) => {
      setValue(updatedValue);

      // sanitize the content before sending it to the parent component
      const sanitizedContent = getSanitizeContent(updatedValue);
      onChangeHandler?.(sanitizedContent);
    };

    /**
     * Handle forward ref logic and provide method access to parent component
     */
    useImperativeHandle(ref, () => ({
      getEditorContent() {
        setValue('');

        // sanitize the content before sending it to the parent component
        return HTMLToMarkdown.turndown(getSanitizeContent(value));
      },
      clearEditorContent() {
        setValue('');
      },
      setEditorContent(content: string) {
        setValue(content);
      },
    }));

    useEffect(() => {
      if (focused) {
        // Set focus on the ReactQuill editor when `focused` prop is true
        editorRef.current?.focus();
      }
    }, [focused, editorRef]);

    useEffect(() => {
      // get the editor container
      const container = document.getElementById('om-quill-editor');

      if (container && editorRef.current) {
        // get the editor instance
        const editorInstance = editorRef.current.getEditor();
        const direction = i18n.dir();

        // get the current direction of the editor
        const { align } = editorInstance.getFormat();

        if (direction === 'rtl' && isNil(align)) {
          container.setAttribute('data-dir', direction);
          editorInstance.format('align', 'right', 'user');
        } else if (align === 'right') {
          editorInstance.format('align', false, 'user');
          container.setAttribute('data-dir', 'ltr');
        }
        editorInstance.format('direction', direction, 'user');
      }
    }, [i18n, editorRef]);

    return (
      <div
        className={className}
        data-testid="editor-wrapper"
        id="om-quill-editor">
        <ReactQuill
          className={classNames('editor-container', editorClass)}
          modules={modules}
          placeholder={t('message.markdown-editor-placeholder')}
          ref={editorRef}
          style={getEditorStyles()}
          theme="snow"
          value={value}
          onBlur={onBlurHandle}
          onChange={handleOnChange}
          onFocus={onFocusHandle}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }
);

FeedEditor.displayName = 'FeedEditor';
