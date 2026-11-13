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

export const KeyHand: FC<Props> = ({
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
      d="M2.031 15.609v-4.781c0-.37 0-.556.041-.708.11-.412.433-.734.845-.845.152-.04.337-.04.708-.04s.556 0 .708.04c.412.11.734.433.845.845.04.152.04.337.04.708v4.78c0 .371 0 .556-.04.708-.11.413-.433.735-.845.846-.152.04-.338.04-.708.04s-.556 0-.708-.04a1.2 1.2 0 0 1-.845-.846c-.04-.152-.04-.337-.04-.707m3.187-5.578h1.409a4.8 4.8 0 0 1 1.883.387l3.765 1.613c.553.237.91.78.91 1.381 0 .553-.448 1.002-1 1.002h-.514c-.579 0-1.152-.11-1.688-.325l-1.18-.472"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.593 14.414h5.239a1.135 1.135 0 0 1 .312 2.227l-4.16 1.189a4.4 4.4 0 0 1-2.348.02L5.22 16.407m6.882-9.375a2.948 2.948 0 1 0-.262-3.87c-.13.171-.195.257-.25.298a.4.4 0 0 1-.161.08c-.066.018-.149.018-.314.018h-3.55c-.12 0-.18 0-.237.014a.5.5 0 0 0-.142.058 1 1 0 0 0-.177.158l-.604.604c-.195.194-.292.292-.328.404a.5.5 0 0 0 0 .303c.036.113.133.21.328.404l.834.834.694-.695.695.695.695-.695.695.695h1.097c.165 0 .248 0 .314.019a.4.4 0 0 1 .16.08c.056.04.12.126.251.297q.12.156.262.299"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
KeyHand.displayName = 'KeyHand';
