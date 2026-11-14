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

export const Page: FC<Props> = ({
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
      d="M6.799 6h6.4m-6.4 3.2h3.2m.801 8.4v-.4c0-2.263 0-3.394.703-4.097s1.834-.703 4.097-.703h.4m.4-1.325V8.4c0-3.017 0-4.525-.938-5.463S13.017 2 10 2s-4.526 0-5.463.937S3.6 5.383 3.6 8.4v3.635c0 2.596 0 3.894.708 4.774a3.2 3.2 0 0 0 .483.482C5.671 18 6.968 18 9.564 18c.565 0 .847 0 1.105-.091q.081-.03.158-.066c.248-.118.447-.317.846-.716l3.79-3.79c.462-.462.693-.693.815-.987s.122-.621.122-1.275"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Page.displayName = 'Page';
