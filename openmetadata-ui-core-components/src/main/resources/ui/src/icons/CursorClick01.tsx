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

export const CursorClick01: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M9 3.5V2M5.06 5.06 4 4m1.06 9L4 14.06m9-9L14.06 4M3.5 9H2m13.864 7.19-2.491 4.627c-.285.529-.427.793-.598.86a.5.5 0 0 1-.451-.044c-.155-.099-.243-.386-.42-.96L8.445 9.445c-.144-.468-.216-.703-.158-.861a.5.5 0 0 1 .297-.297c.158-.058.393.014.861.158l11.228 3.459c.574.177.86.265.96.42a.5.5 0 0 1 .044.45c-.067.172-.331.314-.86.599l-4.627 2.492a1 1 0 0 0-.153.09.5.5 0 0 0-.082.082 1 1 0 0 0-.09.153Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CursorClick01.displayName = 'CursorClick01';
