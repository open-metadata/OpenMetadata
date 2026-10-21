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

export const Dataflow03: FC<Props> = ({
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
      d="M9.167 3.75h6.083c.933 0 1.4 0 1.757.182a1.67 1.67 0 0 1 .728.728c.182.357.182.823.182 1.757V7.5c0 .777 0 1.165-.127 1.471a1.67 1.67 0 0 1-.902.903c-.306.126-.695.126-1.471.126m-4.584 6.25H4.75c-.933 0-1.4 0-1.757-.182a1.67 1.67 0 0 1-.728-.728c-.182-.357-.182-.823-.182-1.757V12.5c0-.777 0-1.165.127-1.471a1.67 1.67 0 0 1 .903-.902C3.418 10 3.807 10 4.583 10m4 2.083h2.833c.233 0 .35 0 .439-.046a.4.4 0 0 0 .182-.182c.046-.089.046-.206.046-.439V8.583c0-.233 0-.35-.046-.439a.4.4 0 0 0-.182-.182c-.088-.045-.205-.045-.438-.045H8.584c-.233 0-.35 0-.439.046a.4.4 0 0 0-.182.182c-.046.089-.046.206-.046.439v2.833c0 .233 0 .35.046.439a.4.4 0 0 0 .182.182c.089.046.206.046.439.046Zm6.25 6.25h2.833c.233 0 .35 0 .439-.046a.4.4 0 0 0 .182-.182c.046-.088.046-.205.046-.438v-2.833c0-.233 0-.35-.046-.439a.4.4 0 0 0-.182-.182c-.088-.046-.205-.046-.438-.046h-2.833c-.233 0-.35 0-.439.046a.4.4 0 0 0-.182.182c-.046.088-.046.205-.046.438v2.833c0 .233 0 .35.046.439a.4.4 0 0 0 .182.182c.089.046.206.046.439.046Zm-12.5-12.5h2.833c.233 0 .35 0 .439-.045a.4.4 0 0 0 .182-.182c.046-.089.046-.206.046-.439V2.333c0-.233 0-.35-.045-.439a.4.4 0 0 0-.182-.182c-.089-.045-.206-.045-.439-.045H2.333c-.233 0-.35 0-.439.045a.4.4 0 0 0-.182.183c-.045.088-.045.205-.045.438v2.833c0 .233 0 .35.045.439a.4.4 0 0 0 .183.182c.088.046.205.046.438.046"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Dataflow03.displayName = 'Dataflow03';
