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

export const Schema: FC<Props> = ({
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M2.797 3.92c0-.905 0-1.358.281-1.639S3.812 2 4.717 2h.16c.905 0 1.358 0 1.639.281s.28.734.28 1.639v.16c0 .905 0 1.358-.28 1.639C6.235 6 5.782 6 4.876 6h-.16c-.904 0-1.357 0-1.638-.281s-.281-.734-.281-1.639zm10.403 4c0-.905 0-1.358.28-1.639C13.761 6 14.214 6 15.12 6h.16c.904 0 1.357 0 1.638.281s.281.734.281 1.639v.16c0 .905 0 1.358-.281 1.639s-.734.281-1.639.281h-.16c-.905 0-1.357 0-1.639-.281-.28-.281-.28-.734-.28-1.639zm-10.403 4c0-.905 0-1.358.281-1.639S3.812 10 4.717 10h.16c.905 0 1.358 0 1.639.281s.28.734.28 1.639v.16c0 .905 0 1.358-.28 1.639-.281.281-.734.281-1.64.281h-.16c-.904 0-1.357 0-1.638-.281s-.281-.734-.281-1.639zm10.403 4c0-.905 0-1.358.28-1.639.281-.281.734-.281 1.64-.281h.16c.904 0 1.357 0 1.638.281s.281.734.281 1.639v.16c0 .905 0 1.358-.281 1.639s-.734.281-1.639.281h-.16c-.905 0-1.357 0-1.639-.281-.28-.281-.28-.734-.28-1.639zM6.797 4l5.6 4-4.8 4 5.6 4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Schema.displayName = 'Schema';
