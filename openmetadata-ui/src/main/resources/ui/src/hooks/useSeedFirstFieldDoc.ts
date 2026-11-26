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
import { useFieldDocRegistry } from '@openmetadata/ui-core-components';
import { RefObject, useEffect, useRef } from 'react';

/**
 * Opens the Form Hint column on the first documented field on screen, so it is
 * not empty when the form opens. A field's doc registers even when the field is
 * hidden, so this reads the DOM for the first rendered `data-field-doc` anchor
 * rather than the registry. Focusing any field replaces it as usual.
 *
 * @param ref An element inside the form; its form is searched, or the
 * element itself when it is not inside one.
 */
export const useSeedFirstFieldDoc = (ref: RefObject<HTMLElement | null>) => {
  const { setActive, entries } = useFieldDocRegistry();
  const hasSeededRef = useRef(false);

  useEffect(() => {
    if (hasSeededRef.current) {
      return;
    }
    const root = ref.current?.closest('form') ?? ref.current;
    const firstFieldName = root
      ?.querySelector('[data-field-doc]')
      ?.getAttribute('data-field-doc');
    if (firstFieldName) {
      setActive(firstFieldName);
      hasSeededRef.current = true;
    }
  }, [entries, setActive, ref]);
};
