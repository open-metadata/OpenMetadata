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
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionFieldSection } from '../utils/ServiceConnectionUtils';

export interface FieldFocusMeta {
  title?: string;
  description?: string;
  section?: ConnectionFieldSection;
}

const FOCUS_DELAY_MS = 50;
const BLUR_DELAY_MS = 100;

/**
 * Manages the "active field" state that drives the service docs side panel.
 * Focus and blur updates are debounced through a single shared timer so a
 * blur immediately followed by a focus (or rapid field switching) never
 * leaves a stale timeout that blanks or clobbers the panel afterwards.
 */
export const useFieldFocusManagement = () => {
  const [activeField, setActiveField] = useState<string>('');
  const [activeFieldMeta, setActiveFieldMeta] = useState<
    FieldFocusMeta | undefined
  >();
  const fieldTimerRef = useRef<number>();

  const handleFieldFocus = useCallback(
    (fieldName: string, schemaMeta?: FieldFocusMeta) => {
      if (isEmpty(fieldName)) {
        return;
      }
      clearTimeout(fieldTimerRef.current);
      fieldTimerRef.current = Number(
        setTimeout(() => {
          setActiveField(fieldName);
          setActiveFieldMeta(schemaMeta);
        }, FOCUS_DELAY_MS)
      );
    },
    []
  );

  const handleFieldBlur = useCallback(() => {
    clearTimeout(fieldTimerRef.current);
    fieldTimerRef.current = Number(
      setTimeout(() => {
        setActiveField('');
        setActiveFieldMeta(undefined);
      }, BLUR_DELAY_MS)
    );
  }, []);

  const resetActiveField = useCallback((fieldName = '') => {
    clearTimeout(fieldTimerRef.current);
    setActiveField(fieldName);
    setActiveFieldMeta(undefined);
  }, []);

  useEffect(() => {
    return () => clearTimeout(fieldTimerRef.current);
  }, []);

  return {
    activeField,
    activeFieldMeta,
    handleFieldBlur,
    handleFieldFocus,
    resetActiveField,
  };
};
