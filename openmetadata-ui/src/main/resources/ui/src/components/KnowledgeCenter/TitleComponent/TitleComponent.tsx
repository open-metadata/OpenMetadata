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
  ChangeEvent,
  forwardRef,
  KeyboardEvent,
  MutableRefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import useAutoSizeTextArea from '../../../hooks/useAutosizeTextArea';
import i18n from '../../../utils/i18next/LocalUtil';
import './title-component.less';

interface Props {
  value: string;
  autoFocus?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

export const TitleComponent = forwardRef<HTMLTextAreaElement, Props>(
  (
    {
      value,
      onChange,
      onKeyDown,
      autoFocus = false,
      placeholder,
      readOnly = false,
    },
    ref
  ) => {
    const [titleValue, setTitleValue] = useState<string>(value);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const prevValueRef = useRef<string>(value);

    // Only sync from prop when the user has not diverged from the last known
    // saved value. If titleValue !== prevValueRef.current, the user has typed
    // ahead of the save and we must not clobber their in-progress edit.
    useEffect(() => {
      if (titleValue === prevValueRef.current) {
        setTitleValue(value);
      }
      prevValueRef.current = value;
    }, [value]);

    useAutoSizeTextArea('title-input', textAreaRef.current, titleValue);

    // Defer focus by 100ms to ensure TipTap/ProseMirror (sibling BlockEditor) has
    // finished initializing its EditorView, which can otherwise steal focus on mount.
    useEffect(() => {
      if (!autoFocus) {
        return;
      }
      const id = setTimeout(() => textAreaRef.current?.focus(), 100);

      return () => clearTimeout(id);
    }, [autoFocus]);

    const setRef = (el: HTMLTextAreaElement | null) => {
      (textAreaRef as MutableRefObject<HTMLTextAreaElement | null>).current =
        el;
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        (ref as MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }
    };

    const handleOnChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = e.target;
      setTitleValue(value);
      onChange(value);
    };

    return (
      <textarea
        className="knowledge-page-title-input"
        data-testid="entity-header-display-name"
        id="title-input"
        placeholder={placeholder || i18n.t('label.untitled')}
        readOnly={readOnly}
        ref={setRef}
        rows={1}
        spellCheck={false}
        value={titleValue}
        onChange={handleOnChange}
        onKeyDown={onKeyDown}
      />
    );
  }
);

TitleComponent.displayName = 'TitleComponent';
