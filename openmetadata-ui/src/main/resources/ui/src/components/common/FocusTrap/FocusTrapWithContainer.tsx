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

import { createFocusTrap, FocusTrap as FocusTrapInstance } from 'focus-trap';
import { useEffect, useRef } from 'react';

type UseMultiContainerFocusTrapProps = {
  containers: Array<HTMLElement | null | undefined>;
  active?: boolean;
  options?: Parameters<typeof createFocusTrap>[1];
};

export function useMultiContainerFocusTrap({
  containers,
  active = true,
  options = {},
}: UseMultiContainerFocusTrapProps) {
  const trapRef = useRef<FocusTrapInstance | null>(null);

  useEffect(() => {
    if (active) {
      const validContainers = containers.filter(Boolean) as HTMLElement[];
      if (validContainers.length === 0) {
        return;
      }

      // If already active, deactivate before re-activating with new containers
      trapRef.current?.deactivate();

      trapRef.current = createFocusTrap(validContainers, {
        fallbackFocus: validContainers[0],
        ...options,
      });

      trapRef.current.activate();

      return () => {
        trapRef.current?.deactivate();
      };
    } else {
      trapRef.current?.deactivate();

      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...containers]);

  return {
    trapRef,
  };
}

export const FocusTrapWithContainer = ({
  children,
  active = true,
}: {
  children: React.ReactNode;
  active?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useMultiContainerFocusTrap({
    containers: [containerRef.current],
    active,
  });

  return (
    <div
      ref={containerRef}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
        }
      }}>
      {children}
    </div>
  );
};
