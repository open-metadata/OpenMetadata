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

import { Extension } from '@codemirror/state';
import { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeMirrorOptions, Mode } from '../interface/codemirror.interface';
import {
  getCodeMirrorBaseExtensions,
  getCodeMirrorExtensions,
  getCodeMirrorLanguage,
} from '../utils/CodeMirror.utils';
import { getSchemaEditorValue } from '../utils/SchemaEditor.utils';

interface UseCodeMirrorEditorProps {
  value: string;
  autoFormat: boolean;
  mode: Mode;
  defaultOptions: CodeMirrorOptions;
  options?: CodeMirrorOptions;
  readOnly?: boolean;
  extensions?: Extension[];
  onChange?: (value: string) => void;
}

/**
 * Shared editor plumbing for SchemaEditor and CodeEditor: the buffer, the
 * extension set, and the rules for when an incoming `value` may replace what
 * the user is looking at.
 */
export const useCodeMirrorEditor = ({
  value,
  autoFormat,
  mode,
  defaultOptions,
  options,
  readOnly,
  extensions,
  onChange,
}: UseCodeMirrorEditorProps) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [internalValue, setInternalValue] = useState<string>(() =>
    getSchemaEditorValue(value, autoFormat)
  );
  // The last value this editor and its parent agreed on, whether we emitted it
  // or took it in. An incoming value prop equal to this is the parent echoing
  // us back, not an external update.
  const lastSyncedRef = useRef<string>(internalValue);
  // An external value that arrived mid-edit, applied once the editor blurs.
  const pendingExternalRef = useRef<string | null>(null);

  // Option and mode objects are almost always inline literals at the call site,
  // so compare by content — a new extension array reconfigures the editor.
  const optionsKey = JSON.stringify(options ?? {});
  // options.readOnly wins over the prop, which wins over the component default —
  // the same precedence the extension bag below is built with. CodeMirror 5's
  // 'nocursor' spelling is read-only too, hence the truthiness test.
  const isReadOnly = Boolean(
    options?.readOnly ?? readOnly ?? defaultOptions.readOnly
  );
  const editorExtensions = useMemo(
    () => [
      ...getCodeMirrorBaseExtensions(),
      ...getCodeMirrorLanguage(mode),
      // The readOnly prop was accepted but never applied under CodeMirror 5;
      // the call sites that pass it (disabled forms, markdown code blocks) all
      // mean it. options.readOnly still wins when both are given.
      ...getCodeMirrorExtensions({
        ...defaultOptions,
        ...(isUndefined(readOnly) ? {} : { readOnly }),
        ...options,
      }),
      ...(extensions ?? []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode.name, mode.json, optionsKey, readOnly, extensions, defaultOptions]
  );

  const handleChange = useCallback(
    (doc: string) => {
      // A fresh edit supersedes an external value that was waiting for blur;
      // otherwise blur would overwrite what was just typed.
      pendingExternalRef.current = null;
      // The buffer is left exactly as typed; only what the parent receives is
      // formatted. Reformatting the buffer mid-edit is what used to move the
      // caret after an auto-closed bracket.
      setInternalValue(doc);
      const nextValue = getSchemaEditorValue(doc, autoFormat);
      lastSyncedRef.current = nextValue;
      onChange?.(nextValue);
    },
    [autoFormat, onChange]
  );

  // Taking an external value in makes it the agreed value: without recording it,
  // a parent that resets A -> B -> A would be ignored on the way back to A,
  // leaving B on screen.
  const applyExternalValue = useCallback((nextValue: string) => {
    lastSyncedRef.current = nextValue;
    pendingExternalRef.current = null;
    setInternalValue(nextValue);
  }, []);

  const handleBlur = useCallback(() => {
    if (pendingExternalRef.current !== null) {
      applyExternalValue(pendingExternalRef.current);
    }
  }, [applyExternalValue]);

  useEffect(() => {
    const nextValue = getSchemaEditorValue(value, autoFormat);

    if (nextValue === lastSyncedRef.current) {
      return;
    }

    // A read-only editor stays focusable but has no edit to protect, so it takes
    // the update straight away rather than waiting for blur.
    if (!isReadOnly && editorRef.current?.view?.hasFocus) {
      pendingExternalRef.current = nextValue;

      return;
    }

    applyExternalValue(nextValue);
  }, [value, autoFormat, isReadOnly, applyExternalValue]);

  return {
    editorRef,
    editorExtensions,
    internalValue,
    handleChange,
    handleBlur,
  };
};
