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
import { Check, X } from '@untitledui/icons';
import {
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../../enums/codemirror.enum';
import { Language } from '../../../../generated/entity/data/metric';
import SchemaEditor from '../../../Database/SchemaEditor/SchemaEditor';
import { KeyDownStopPropagationWrapper } from '../../KeyDownStopPropagationWrapper/KeyDownStopPropagationWrapper';
import './expression-code-cell.less';
import {
  ExpressionCodeCellProps,
  LANGUAGE_TO_CODEMIRROR_MODE,
} from './ExpressionCodeCell.interface';

const EXPRESSION_LANGUAGES = Object.values(Language);
const EDITOR_WIDTH = 560;
const EDITOR_HEIGHT = 320;

const ExpressionCodeCell = ({
  language,
  onCancel,
  onCommit,
  value,
}: ExpressionCodeCellProps) => {
  const { t } = useTranslation();
  const [code, setCode] = useState(value ?? '');
  const [activeLanguage, setActiveLanguage] = useState<Language>(
    language ?? Language.SQL
  );
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Computed once so the floating editor can escape the grid's scroll clipping
  // and sit over the rows like the design (flips above the cell near the bottom).
  const [position, setPosition] = useState<{ top: number; left: number }>();
  const lineCount = Math.max(1, code.split('\n').length);

  useLayoutEffect(() => {
    const cell = anchorRef.current?.closest('.rdg-cell') ?? anchorRef.current;
    const rect = cell?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow >= EDITOR_HEIGHT
          ? rect.bottom + 4
          : Math.max(8, rect.top - EDITOR_HEIGHT - 4);
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - EDITOR_WIDTH - 8)
      );
      setPosition({ top, left });
    }
  }, []);

  useEffect(() => {
    const handleOutsideMouseDown = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onCommit(code, activeLanguage);
      }
    };
    document.addEventListener('mousedown', handleOutsideMouseDown);

    return () =>
      document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [code, activeLanguage, onCommit]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onCommit(code, activeLanguage);
    }
  };

  return (
    <>
      <span className="bulk-edit-code-anchor" ref={anchorRef} />
      {position &&
        createPortal(
          <KeyDownStopPropagationWrapper keys={['Enter', 'Escape', 'Tab']}>
            <div
              className="bulk-edit-code-editor"
              data-testid="bulk-edit-code-editor"
              ref={panelRef}
              style={{ top: position.top, left: position.left }}
              onKeyDown={handleKeyDown}
              onMouseDown={(event) => event.stopPropagation()}>
              <div className="bulk-edit-code-editor-head">
                <div className="bulk-edit-code-editor-tabs">
                  {EXPRESSION_LANGUAGES.map((lang) => (
                    <button
                      className={`bulk-edit-code-editor-tab${
                        activeLanguage === lang ? ' active' : ''
                      }`}
                      data-testid={`code-lang-${lang.toLowerCase()}`}
                      key={lang}
                      type="button"
                      onClick={() => setActiveLanguage(lang)}>
                      {lang}
                    </button>
                  ))}
                </div>
                <div className="bulk-edit-code-editor-actions">
                  <button
                    aria-label={t('label.save')}
                    className="bulk-edit-code-editor-btn"
                    data-testid="code-editor-save"
                    type="button"
                    onClick={() => onCommit(code, activeLanguage)}>
                    <Check size={14} />
                  </button>
                  <button
                    aria-label={t('label.cancel')}
                    className="bulk-edit-code-editor-btn"
                    data-testid="code-editor-cancel"
                    type="button"
                    onClick={onCancel}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="bulk-edit-code-editor-body">
                <SchemaEditor
                  className="bulk-edit-code-editor-cm"
                  mode={{
                    name:
                      LANGUAGE_TO_CODEMIRROR_MODE[activeLanguage] ?? CSMode.SQL,
                  }}
                  showCopyButton={false}
                  value={code}
                  onChange={setCode}
                />
              </div>
              <div className="bulk-edit-code-editor-foot">
                <span className="bulk-edit-code-editor-hint">
                  <span className="bulk-edit-code-editor-kbd">⌘↵</span>{' '}
                  {t('label.save').toLowerCase()}
                  {' · '}
                  <span className="bulk-edit-code-editor-kbd">Esc</span>{' '}
                  {t('label.cancel').toLowerCase()}
                </span>
                <span>{`${lineCount} ${t(
                  'label.line-plural'
                ).toLowerCase()}`}</span>
              </div>
            </div>
          </KeyDownStopPropagationWrapper>,
          document.body
        )}
    </>
  );
};

export default ExpressionCodeCell;
