/*
 *  Copyright 2024 Collate.
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
import React from 'react';
import { Resizable, ResizeCallbackData } from 'react-resizable';

const ResizableTableColumn = (
  props: React.HTMLAttributes<any> & {
    onResize: (
      e: React.SyntheticEvent<Element>,
      data: ResizeCallbackData
    ) => void;
    width: number;
  }
) => {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return (
      <Resizable
        lockAspectRatio
        draggableOpts={{ enableUserSelectHack: false }}
        height={0}
        maxConstraints={[200, 0]}
        minConstraints={[200, 0]}
        width={0}>
        <th {...restProps} />
      </Resizable>
    );
  }

  return (
    <Resizable
      draggableOpts={{ enableUserSelectHack: false }}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      }
      height={0}
      minConstraints={[160, 0]}
      width={width}
      //   maxConstraints={[1200, 0]}
      onResize={onResize}>
      <th {...restProps} />
    </Resizable>
  );
};

export default ResizableTableColumn;
