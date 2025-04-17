/*
 *  Copyright 2022 Collate.
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

import classNames from 'classnames';
import { CSSProperties, FunctionComponent } from 'react';
import './Loader.less';

type Props = {
  size?: 'default' | 'small' | 'x-small';
  type?: 'default' | 'success' | 'error' | 'white';
  className?: string;
  fullScreen?: boolean;
  style?: CSSProperties;
};

const Loader: FunctionComponent<Props> = ({
  size = 'default',
  type = 'default',
  className = '',
  fullScreen = false,
  style,
}: Props): JSX.Element => {
  let classes = 'loader';
  switch (size) {
    case 'small':
      classes += ' loader-sm';

      break;
    case 'x-small':
      classes += ' loader-x-sm';

      break;

    default:
      break;
  }

  switch (type) {
    case 'success':
      classes += ' loader-success';

      break;
    case 'error':
      classes += ' loader-error';

      break;
    case 'white':
      classes += ' loader-white';

      break;
    default:
      break;
  }

  if (fullScreen) {
    return (
      <div className="h-min-100 flex-center" data-testid="full-screen-loader">
        <div
          className={classNames(classes, className)}
          data-testid="loader"
          style={style}
        />
      </div>
    );
  }

  return (
    <div
      className={classNames(classes, className)}
      data-testid="loader"
      style={style}
    />
  );
};

export default Loader;
