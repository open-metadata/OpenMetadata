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
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Closes a drawer once the app navigates, so it does not stay open over the
 * page a link inside it led to. It reacts to the navigation, not the click:
 * a modified click, a link that opens a new tab or a mention inside an editor
 * leaves the drawer, and any draft in it, as it was.
 */
export const useCloseOnNavigation = (onClose?: () => void) => {
  const { key } = useLocation();
  const openedAt = useRef(key);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (key !== openedAt.current) {
      onCloseRef.current?.();
    }
  }, [key]);
};
