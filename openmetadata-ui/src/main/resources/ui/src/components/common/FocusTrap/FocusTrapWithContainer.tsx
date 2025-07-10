/*
 *  Copyright 2023 Collate.
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

import { FocusTrap } from 'focus-trap-react';
import { useRef } from 'react';

export const FocusTrapWithContainer = ({
  children,
  active = true,
}: {
  children: React.ReactNode;
  active?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <FocusTrap
      active={active}
      focusTrapOptions={{
        fallbackFocus: () => containerRef.current || document.body,
        initialFocus: () =>
          (containerRef.current?.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement) || containerRef.current,
      }}>
      <div
        ref={containerRef}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
          }
        }}>
        {children}
      </div>
    </FocusTrap>
  );
};
