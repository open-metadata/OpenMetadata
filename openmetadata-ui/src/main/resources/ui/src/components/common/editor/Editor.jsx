/*
 *  Copyright 2021 Collate
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

import { isUndefined } from 'lodash';
import propTypes from 'prop-types';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
// import { Button } from 'react-bootstrap';
import { createEditor, Editor, Range, Transforms } from 'slate';
import { withHistory } from 'slate-history';
import { Editable, ReactEditor, Slate, withReact } from 'slate-react';
import appState from '../../../AppState';
import { searchData } from '../../../axiosAPIs/miscAPI';
import {
  focusAtEnd,
  insertDataset,
  insertMention,
  isBlockActive,
  isMarkActive,
  serializeData,
  toggleBlock,
  toggleMark,
  withDatasets,
  withMentions,
} from '../../../utils/EditorUtils';
import { Button as LinkButton } from '../../buttons/Button/Button';
import ContentList from './ContentList';
import Element from './Element';
import FormatButton from './FormatButton';
import Leaf from './Leaf';
import Portal from './Portal';
import { editor as editorStyles } from './styles/Editor.styles';

const MarkdownEditor = ({
  placeholder,
  onCancel,
  onSave,
  onSuggest,
  initValue,
  className,
  editorRef,
  contentListClasses,
}) => {
  const ref = useRef();
  const classes = editorStyles;
  const [editorValue, setEditorValue] = useState(initValue);
  const [target, setTarget] = useState(null);
  const [index, setIndex] = useState(0);
  const [topIndex, setTopIndex] = useState(0);
  const [charSearch, setCharSearch] = useState('');
  const [datasetSearch, setDatasetSearch] = useState('');
  const [datasets, setDatasets] = useState([]);
  const renderElement = useCallback((props) => <Element {...props} />, []);
  const renderLeaf = useCallback((props) => <Leaf {...props} />, []);
  const editor = useMemo(
    () => withDatasets(withMentions(withReact(withHistory(createEditor())))),
    []
  );

  const chars = appState.users
    .filter((user) => {
      const userName = user.displayName || user.name;
      if (!charSearch) {
        return true;
      }
      let isMatch = false;
      const nameSplit = userName.split(' ');
      for (let i = 0; i < nameSplit.length; i++) {
        const name = nameSplit[i];
        isMatch = name.toLowerCase().startsWith(charSearch.toLowerCase());
        if (isMatch) break;
      }

      return isMatch;
    })
    .sort((user1, user2) => {
      const [name1, name2] =
        user1.displayName && user2.displayName
          ? [user1.displayName, user2.displayName]
          : [user1.name, user2.name];

      return name1.toLowerCase().startsWith(charSearch.toLowerCase())
        ? name2.toLowerCase().startsWith(charSearch.toLowerCase())
          ? 0
          : -1
        : 1;
    });

  useEffect(() => {
    if (target && chars.length > 0 && charSearch !== '') {
      const el = ref.current;
      const domRange = ReactEditor.toDOMRange(editor, target);
      const rect = domRange.getBoundingClientRect();
      el.style.top = `${rect.top + window.pageYOffset + 24}px`;
      el.style.left = `${rect.left + window.pageXOffset}px`;
    }
    if (target && datasets.length > 0 && datasetSearch !== '') {
      const el = ref.current;
      const domRange = ReactEditor.toDOMRange(editor, target);
      const rect = domRange.getBoundingClientRect();
      el.style.top = `${rect.top + window.pageYOffset + 24}px`;
      el.style.left = `${rect.left + window.pageXOffset}px`;
    }
    if (datasetSearch !== '') {
      searchData(datasetSearch).then((res) => {
        const hits = res.data.hits.hits;
        if (hits.length) {
          const newDatasets = hits.map((hit) => {
            return hit.sourceAsMap.name;
          });
          setDatasets(newDatasets);
        } else {
          setDatasets([]);
        }
      });
    }
  }, [
    chars.length,
    datasets.length,
    editor,
    index,
    datasetSearch,
    charSearch,
    target,
  ]);

  const selectUser = useCallback(
    (idx) => {
      if (target) {
        const selIndex = !isUndefined(idx) ? idx : index;
        const contentList = charSearch
          ? chars.map((user) => user.displayName || user.name)
          : datasets;
        Transforms.select(editor, target);
        if (charSearch !== '') insertMention(editor, contentList[selIndex]);
        else insertDataset(editor, contentList[selIndex]);
        setTarget(null);
      }
    },
    [index, charSearch, target, chars, datasets, editor]
  );

  const onKeyDown = useCallback(
    (event) => {
      const contentList = charSearch
        ? chars.map((user) => user.displayName || user.name)
        : datasets;
      if (target) {
        switch (event.key) {
          case 'ArrowDown': {
            event.preventDefault();
            const prevIndex = index >= contentList.length - 1 ? 0 : index + 1;
            if (
              topIndex >= contentList.length - 7 &&
              index === contentList.length - 1
            ) {
              ref.current.scrollTop = 0;
              setTopIndex(0);
            } else if (prevIndex > topIndex + 6) {
              ref.current.scrollTop += 36;
              setTopIndex(topIndex + 1);
            }
            setIndex(prevIndex);

            break;
          }
          case 'ArrowUp': {
            event.preventDefault();
            const nextIndex = index <= 0 ? contentList.length - 1 : index - 1;
            if (topIndex === 0 && index === 0) {
              ref.current.scrollTop = contentList.length * 36;
              setTopIndex(contentList.length - 7);
            } else if (nextIndex < topIndex) {
              ref.current.scrollTop -= 36;
              setTopIndex(topIndex - 1);
            }
            setIndex(nextIndex);

            break;
          }
          case 'Tab':
          case 'Enter':
            event.preventDefault();
            selectUser();

            break;
          case 'Escape':
            event.preventDefault();
            setTarget(null);

            break;
          default:
            break;
        }
      } else {
        if (event.ctrlKey && event.shiftKey) {
          if (event.key === 'x' || event.key === 'X') {
            toggleMark(editor, 'strikethrough');
          }
          if (event.key === '7' || event.key === '&') {
            toggleBlock(editor, 'numbered-list');
          }
          if (event.key === '8' || event.key === '*') {
            toggleBlock(editor, 'bulleted-list');
          }
          if (event.key === '9' || event.key === '(') {
            toggleBlock(editor, 'block-quote');
          }
        } else if (event.ctrlKey) {
          if (event.key === 'b') {
            toggleMark(editor, 'bold');
          }
          if (event.key === 'i') {
            toggleMark(editor, 'italic');
          }
          if (event.key === 'u') {
            toggleMark(editor, 'underline');
          }
          if (event.key === '`') {
            toggleMark(editor, 'code');
          }
        }
      }
    },
    [index, charSearch, target, chars, datasets, editor, topIndex, selectUser]
  );

  const onEditorChange = (value) => {
    setEditorValue(value);
    const { selection } = editor;

    if (selection && Range.isCollapsed(selection)) {
      const [start] = Range.edges(selection);
      const wordBefore = Editor.before(editor, start, {
        unit: 'word',
      });
      const before = wordBefore && Editor.before(editor, wordBefore);
      const beforeRange = before && Editor.range(editor, before, start);
      const beforeText = beforeRange && Editor.string(editor, beforeRange);
      const mentionBeforeMatch =
        beforeText && (beforeText.match(/^@(\w+)$/) || beforeText.match(/@$/));
      const tableBeforeMatch = beforeText && beforeText.match(/^#(\w+)$/);
      const after = Editor.after(editor, start);
      const afterRange = Editor.range(editor, start, after);
      const afterText = Editor.string(editor, afterRange);
      const afterMatch = afterText.match(/^(\s|$)/);

      if (mentionBeforeMatch && afterMatch) {
        setTarget(beforeRange);
        setCharSearch(
          mentionBeforeMatch.length <= 1 || mentionBeforeMatch[1] === '@'
            ? ''
            : mentionBeforeMatch[1]
        );
        setDatasetSearch('');
        setIndex(0);
        setTopIndex(0);

        return;
      }
      if (tableBeforeMatch && afterMatch) {
        setTarget(beforeRange);
        setDatasetSearch(
          tableBeforeMatch.length <= 1 || tableBeforeMatch[1] === '#'
            ? ''
            : tableBeforeMatch[1]
        );
        setCharSearch('');
        setIndex(0);
        setTopIndex(0);

        return;
      }
    }

    setTarget(null);
  };

  const saveUpdates = () => {
    const updatedHTML = serializeData(editor);
    onSave(updatedHTML);
  };

  const suggestUpdate = () => {
    const updatedHTML = serializeData(editor);
    onSuggest(updatedHTML);
  };

  useEffect(() => {
    if (typeof editorRef === 'function') {
      editorRef({
        fetchUpdatedHTML: () => {
          return serializeData(editor);
        },
      });
    }
  }, []);

  return (
    <Slate editor={editor} value={editorValue} onChange={onEditorChange}>
      <div className={`editor-wrapper ${classes.base} ${className}`}>
        <div
          className="tw-flex-1 tw-overflow-y-auto tw-p-3"
          onClick={() => {
            focusAtEnd(editor);
          }}>
          <Editable
            placeholder={placeholder}
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            onKeyDown={onKeyDown}
            // onClick={selectUser}
            // onContextMenuCapture={selectUser}
          />
        </div>
        <div className="tw-flex-initial tw-p-3">
          <div className="editor-actions">
            <FormatButton
              format="bold"
              icon="bold"
              isFormatActive={isMarkActive}
              toggleFormat={toggleMark}
            />
            <FormatButton
              format="italic"
              icon="italic"
              isFormatActive={isMarkActive}
              toggleFormat={toggleMark}
            />
            <FormatButton
              format="underline"
              icon="underline"
              isFormatActive={isMarkActive}
              toggleFormat={toggleMark}
            />
            <FormatButton
              format="strikethrough"
              icon="strikethrough"
              isFormatActive={isMarkActive}
              toggleFormat={toggleMark}
            />
            <FormatButton
              format="code"
              icon="code"
              isFormatActive={isMarkActive}
              toggleFormat={toggleMark}
            />
            <FormatButton
              format="block-quote"
              icon="quote-right"
              isFormatActive={isBlockActive}
              toggleFormat={toggleBlock}
            />
            <FormatButton
              format="numbered-list"
              icon="list-ol"
              isFormatActive={isBlockActive}
              toggleFormat={toggleBlock}
            />
            <FormatButton
              format="bulleted-list"
              icon="list-ul"
              isFormatActive={isBlockActive}
              toggleFormat={toggleBlock}
            />
            <div className="float-right editor-footer-actions">
              {onSuggest && (
                <LinkButton
                  size="x-small"
                  theme="primary"
                  variant="link"
                  onClick={suggestUpdate}>
                  Suggest
                </LinkButton>
              )}
              {onCancel && (
                <LinkButton
                  size="x-small"
                  theme="primary"
                  variant="outlined"
                  onClick={onCancel}>
                  Cancel
                </LinkButton>
              )}
              {onSave && (
                <LinkButton
                  className="tw-ml-2"
                  size="x-small"
                  theme="primary"
                  variant="contained"
                  onClick={saveUpdates}>
                  Save
                </LinkButton>
              )}
            </div>
          </div>
        </div>
      </div>
      {target && chars.length > 0 && charSearch !== '' && (
        <Portal>
          <ContentList
            showImage
            className={contentListClasses}
            contentList={chars.map((user) => user.displayName || user.name)}
            index={index}
            ref={ref}
            onItemSelect={(idx) => {
              selectUser(idx);
            }}
          />
        </Portal>
      )}
      {target && datasets.length > 0 && datasetSearch !== '' && (
        <Portal>
          <ContentList contentList={datasets} index={index} ref={ref} />
        </Portal>
      )}
    </Slate>
  );
};

MarkdownEditor.propTypes = {
  placeholder: propTypes.string,
  onCancel: propTypes.func,
  onSave: propTypes.func,
  onSuggest: propTypes.func,
  initValue: propTypes.arrayOf(propTypes.object),
  className: propTypes.string,
  editorRef: propTypes.func,
  contentListClasses: propTypes.string,
};

export default MarkdownEditor;

MarkdownEditor.defaultProps = {
  initValue: [
    {
      type: 'paragraph',
      children: [
        {
          text: '',
        },
      ],
    },
  ],
};
