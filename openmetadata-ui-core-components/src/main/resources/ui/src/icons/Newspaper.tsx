/*
 *  Copyright 2025 Collate.
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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const Newspaper: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M16.316 17.58H6.21c-1.985 0-2.978 0-3.594-.617S2 15.354 2 13.37V6.632c0-1.984 0-2.977.617-3.594.616-.616 1.609-.616 3.594-.616h4.21c1.985 0 2.977 0 3.594.616.617.617.617 1.61.617 3.594"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 4.95H6.63c-.793 0-1.19 0-1.437.246-.247.247-.247.643-.247 1.437s0 1.191.247 1.438.644.247 1.437.247H10c.794 0 1.19 0 1.438-.247.246-.247.246-.644.246-1.438s0-1.19-.246-1.437c-.247-.247-.644-.247-1.438-.247Zm-5.053 6.734h6.737m-6.737 3.371h4.21m5.473-8.422h.843c1.19 0 1.786 0 2.156.37s.37.965.37 2.156v6.737a1.684 1.684 0 1 1-3.368 0z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Newspaper.displayName = 'Newspaper';
