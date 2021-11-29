/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import './Loader.css';

type Props = {
  size?: 'default' | 'small';
  type?: 'default' | 'success' | 'error' | 'white';
  className?: string;
};

const Loader: FunctionComponent<Props> = ({
  size = 'default',
  type = 'default',
  className = '',
}: Props): JSX.Element => {
  let classes = 'loader';
  switch (size) {
    case 'small':
      classes += ' loader-sm';

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

  return (
    <div className={classNames(classes, className)} data-testid="loader" />
  );
};

export default Loader;
