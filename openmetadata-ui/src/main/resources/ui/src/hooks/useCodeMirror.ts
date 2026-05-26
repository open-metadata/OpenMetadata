/*
 *  Copyright 2024 Collate.
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

import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import {
  bracketMatching,
  codeFolding,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  StreamLanguage,
  syntaxHighlighting,
} from '@codemirror/language';
import { c } from '@codemirror/legacy-modes/mode/clike';
import {
  Annotation,
  Compartment,
  EditorState,
  Extension,
} from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { RefObject, useCallback, useEffect, useRef } from 'react';
import { Mode } from '../components/Database/SchemaEditor/SchemaEditor.interface';
import { CSMode } from '../enums/codemirror.enum';

const externalChange = Annotation.define<boolean>();

function getLanguageExtension(mode: Mode): Extension {
  switch (mode.name) {
    case CSMode.SQL:
      return sql();
    case CSMode.PYTHON:
      return python();
    case CSMode.YAML:
      return yaml();
    case CSMode.CLIKE:
      return StreamLanguage.define(c);
    default:
      return mode.json ? json() : javascript();
  }
}

export interface UseCodeMirrorOptions {
  value?: string;
  mode?: Mode;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  lineWrapping?: boolean;
  showFoldGutter?: boolean;
  styleActiveLine?: boolean;
  matchBrackets?: boolean;
  autoCloseBrackets?: boolean;
  tabSize?: number;
  onChange?: (value: string) => void;
  onFocus?: () => void;
}

export interface UseCodeMirrorReturn {
  editorRef: RefObject<HTMLDivElement>;
  viewRef: RefObject<EditorView | null>;
  requestRefresh: () => void;
}

function buildDynamicExtensions(opts: UseCodeMirrorOptions): Extension[] {
  const extensions: Extension[] = [];

  if (opts.mode) {
    extensions.push(getLanguageExtension(opts.mode));
  }

  if (opts.readOnly) {
    extensions.push(EditorState.readOnly.of(true));
  }

  if (opts.showLineNumbers) {
    extensions.push(lineNumbers());
  }

  if (opts.lineWrapping) {
    extensions.push(EditorView.lineWrapping);
  }

  if (opts.showFoldGutter) {
    extensions.push(codeFolding(), foldGutter());
  }

  if (opts.styleActiveLine) {
    extensions.push(highlightActiveLine());
  }

  if (opts.matchBrackets) {
    extensions.push(bracketMatching());
  }

  if (opts.autoCloseBrackets) {
    extensions.push(closeBrackets());
  }

  if (opts.tabSize) {
    extensions.push(indentUnit.of(' '.repeat(opts.tabSize)));
  }

  return extensions;
}

export function useCodeMirror(opts: UseCodeMirrorOptions): UseCodeMirrorReturn {
  const editorRef = useRef<HTMLDivElement>(null!);
  const viewRef = useRef<EditorView | null>(null);
  const dynamicCompartment = useRef(new Compartment());
  const onChangeRef = useRef(opts.onChange);
  const onFocusRef = useRef(opts.onFocus);

  onChangeRef.current = opts.onChange;
  onFocusRef.current = opts.onFocus;

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const view = new EditorView({
      parent: editorRef.current,
      state: EditorState.create({
        doc: opts.value ?? '',
        extensions: [
          history(),
          drawSelection(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          indentOnInput(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const isExternal = update.transactions.some((tr) =>
                tr.annotation(externalChange)
              );
              if (!isExternal && onChangeRef.current) {
                onChangeRef.current(update.state.doc.toString());
              }
            }
          }),
          EditorView.domEventHandlers({
            focus: () => {
              onFocusRef.current?.();
            },
          }),
          dynamicCompartment.current.of(buildDynamicExtensions(opts)),
        ],
      }),
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const currentValue = view.state.doc.toString();
    const nextValue = opts.value ?? '';
    if (currentValue !== nextValue) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: nextValue },
        annotations: externalChange.of(true),
      });
    }
  }, [opts.value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: dynamicCompartment.current.reconfigure(
        buildDynamicExtensions(opts)
      ),
    });
  }, [
    opts.mode,
    opts.readOnly,
    opts.showLineNumbers,
    opts.lineWrapping,
    opts.showFoldGutter,
    opts.styleActiveLine,
    opts.matchBrackets,
    opts.autoCloseBrackets,
    opts.tabSize,
  ]);

  const requestRefresh = useCallback(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.requestMeasure();
    view.scrollDOM.scrollTo(0, 0);
    requestAnimationFrame(() => {
      view.scrollDOM.scrollTo(0, 0);
    });
  }, []);

  return { editorRef, viewRef, requestRefresh };
}
