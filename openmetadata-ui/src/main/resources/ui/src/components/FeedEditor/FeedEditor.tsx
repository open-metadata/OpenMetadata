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
import { debounce } from 'lodash';
import Emoji from 'quill-emoji';
import 'quill-emoji/dist/quill-emoji.css';
import 'quill-mention';
import QuillMarkdown from 'quilljs-markdown';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactDOMServer from 'react-dom/server';
import { useTranslation } from 'react-i18next';
import ReactQuill, { Quill } from 'react-quill';
import { BORDER_COLOR } from '../../constants/constants';
import {
  MENTION_ALLOWED_CHARS,
  MENTION_DENOTATION_CHARS,
  TOOLBAR_ITEMS,
} from '../../constants/Feeds.constants';
import { getUserByName } from '../../rest/userAPI';
import {
  HTMLToMarkdown,
  suggestions,
  userMentionItemWithAvatar,
} from '../../utils/FeedUtils';
import { LinkBlot } from '../../utils/QuillLink/QuillLink';
import {
  directionHandler,
  insertMention,
  insertRef,
} from '../../utils/QuillUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import { useApplicationConfigContext } from '../ApplicationConfigProvider/ApplicationConfigProvider';
import { editorRef } from '../common/RichTextEditor/RichTextEditor.interface';
import './feed-editor.less';
import { FeedEditorProp, MentionSuggestionsItem } from './FeedEditor.interface';

Quill.register('modules/markdownOptions', QuillMarkdown);
Quill.register('modules/emoji', Emoji);
Quill.register(LinkBlot);
const Delta = Quill.import('delta');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const strikethrough = (_node: any, delta: typeof Delta) => {
  return delta.compose(new Delta().retain(delta.length(), { strike: true }));
};

export const FeedEditor = forwardRef<editorRef, FeedEditorProp>(
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
    const { t } = useTranslation();
    const editorRef = useRef<ReactQuill>(null);
    const [value, setValue] = useState<string>(defaultValue ?? '');
    const [isMentionListOpen, toggleMentionList] = useState(false);
    const [isFocused, toggleFocus] = useState(false);
    const { userProfilePics, updateUserProfilePics } =
      useApplicationConfigContext();

    const userSuggestionRenderer = async (
      searchTerm: string,
      renderList: (matches: MentionSuggestionsItem[], search: string) => void,
      mentionChar: string
    ) => {
      const matches = await suggestions(searchTerm, mentionChar);
      const newMatches: MentionSuggestionsItem[] = [];
      try {
        // Fetch profile images in case of user listing
        const promises = matches.map(async (item) => {
          if (item.type === 'user') {
            return getUserByName(item.name, { fields: 'profile' }).then(
              (res) => {
                updateUserProfilePics({ id: item.name, user: res });

                newMatches.push({
                  ...item,
                  avatarEle: userMentionItemWithAvatar(
                    item,
                    userProfilePics[item.name] ?? res
                  ),
                });
              }
            );
          } else if (item.type === 'team') {
            newMatches.push({
              ...item,
              avatarEle: userMentionItemWithAvatar(item),
            });
          } else {
            newMatches.push({
              ...item,
            });
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

        const icon = ReactDOMServer.renderToString(
          getEntityIcon(item.type as string)
        );

        const typeSpan = !breadcrumbEle
          ? `<span class="text-grey-muted text-xs">${item.type}</span>`
          : '';

        const result = `<div class="d-flex items-center gap-2">
          <div class="flex-center mention-icon-image">${icon}</div>
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
            direction: directionHandler,
          },
        },
        'emoji-toolbar': true,
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
      if (e.key === 'Enter' && !e.shiftKey && !isMentionListOpen) {
        e.preventDefault();
        onSaveHandle();
      }
      // handle enter keybinding for mention popup
      // set mention list state to false when mention item is selected
      else if (e.key === 'Enter') {
        toggleMentionList(false);
      }
    };

    /**
     * Handle onChange logic and set updated value to state
     * @param value - updated value
     */
    const handleOnChange = (value: string) => {
      setValue(value);
      onChangeHandler?.(value);
    };

    /**
     * Handle forward ref logic and provide method access to parent component
     */
    useImperativeHandle(ref, () => ({
      getEditorValue() {
        setValue('');

        return HTMLToMarkdown.turndown(value);
      },
      clearEditorValue() {
        setValue('');
      },
    }));

    useEffect(() => {
      if (focused) {
        // Set focus on the ReactQuill editor when `focused` prop is true
        editorRef.current?.focus();
      }
    }, [focused, editorRef]);

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
