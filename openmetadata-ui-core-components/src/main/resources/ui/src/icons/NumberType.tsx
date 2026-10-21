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

export const NumberType: FC<Props> = ({
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
      d="m16.4 9.2 1.6.8A8 8 0 0 0 2.666 6.8m.934 4L2 10a8 8 0 0 0 15.334 3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.38 12.06V8.838a1.2 1.2 0 0 1-.32.209q-.174.075-.409.075a.616.616 0 0 1-.612-.621q0-.249.146-.364.146-.12.369-.24.217-.142.444-.346l.417-.377q.186-.173.266-.208a.5.5 0 0 1 .169-.058q.07-.013.204-.013.297 0 .44.146a.7.7 0 0 1 .19.386q.045.236.045.515v4.118q0 .28-.045.52a.73.73 0 0 1-.186.386q-.143.141-.444.142-.297 0-.444-.142a.73.73 0 0 1-.186-.386 3 3 0 0 1-.045-.52m-6.106-.771V8.67q0-.434.125-.737.12-.3.31-.501.192-.2.422-.315.236-.116.453-.173a2.3 2.3 0 0 1 .395-.071q.172-.014.257-.014h.15q.085 0 .263.014.177.013.39.07.218.06.449.174.217.111.417.315.186.2.306.506.12.301.12.732v2.619q0 .438-.12.754-.12.31-.31.52a1.5 1.5 0 0 1-.413.319 2.6 2.6 0 0 1-.444.173 2 2 0 0 1-.395.075 4 4 0 0 1-.262.014h-.151q-.084 0-.257-.014a2.3 2.3 0 0 1-.4-.07 2.6 2.6 0 0 1-.448-.178 1.5 1.5 0 0 1-.422-.324 1.7 1.7 0 0 1-.315-.515 2.1 2.1 0 0 1-.12-.754m1.456-2.77v3a.62.62 0 0 0 .258.466q.12.085.328.085a.53.53 0 0 0 .32-.085.7.7 0 0 0 .173-.19.8.8 0 0 0 .084-.276v-3a.8.8 0 0 0-.084-.275.6.6 0 0 0-.174-.186.5.5 0 0 0-.32-.09.54.54 0 0 0-.5.276.6.6 0 0 0-.085.275"
      fill="currentColor"
    />
  </svg>
);
NumberType.displayName = 'NumberType';
