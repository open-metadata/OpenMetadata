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

export const Automator: FC<Props> = ({
  size = 20,
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
      d="M10 6.797v2.912c0 .105 0 .157.016.204a.3.3 0 0 0 .066.11c.033.036.08.06.172.11l1.989 1.064"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m14.963 16.265-1.936 1.1c-.143.081-.214.122-.278.128a.27.27 0 0 1-.164-.031c-.057-.029-.118-.104-.239-.253-1.2-1.477-3.491-1.477-4.691 0-.121.15-.181.224-.239.253a.27.27 0 0 1-.163.03c-.064-.005-.136-.046-.279-.127l-1.936-1.1c-.147-.083-.22-.125-.258-.177a.27.27 0 0 1-.057-.159c-.004-.064.032-.157.103-.343.668-1.735-.499-3.686-2.347-3.977-.193-.03-.29-.045-.344-.08a.27.27 0 0 1-.108-.128C2 11.34 2 11.259 2 11.092V8.905c0-.167 0-.25.027-.309a.27.27 0 0 1 .108-.127c.054-.036.15-.05.344-.081 1.848-.291 3.016-2.242 2.348-3.978-.07-.185-.107-.278-.103-.343a.27.27 0 0 1 .057-.158c.038-.053.111-.094.258-.178l1.937-1.099c.143-.081.214-.122.278-.128a.27.27 0 0 1 .163.03c.058.03.118.104.24.253 1.199 1.477 3.489 1.477 4.688 0 .121-.149.181-.223.239-.252a.27.27 0 0 1 .163-.03c.064.005.136.046.279.127l1.936 1.1c.147.083.22.124.258.177a.27.27 0 0 1 .057.159c.004.064-.032.157-.103.342-.668 1.736.499 3.687 2.348 3.978.192.03.289.045.343.08.053.036.082.07.108.128.027.059.027.142.027.309v2.187c0 .167 0 .25-.027.309a.27.27 0 0 1-.108.127c-.054.036-.15.05-.343.081-1.849.291-3.015 2.242-2.347 3.977.071.186.107.278.103.343a.27.27 0 0 1-.056.159c-.039.052-.112.094-.259.177"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Automator.displayName = 'Automator';
