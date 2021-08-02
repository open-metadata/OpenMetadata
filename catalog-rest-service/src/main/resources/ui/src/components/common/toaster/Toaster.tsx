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

import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { TIMEOUT } from '../../../constants/constants';
import Toast from '../Toast/Toast';
import { ToastProp } from './ToasterTypes';
const Toaster = ({ toastList }: { toastList: Array<ToastProp> }) => {
  const [list, setList] = useState<Array<ToastProp>>(toastList);
  useEffect(() => {
    setList(toastList);
  }, [toastList]);

  return (
    <>
      {list.map((toast: ToastProp, id: number) => {
        return (
          <Toast
            autoDelete={toast.variant !== 'error'}
            body={toast.body}
            dismissTime={TIMEOUT.TOAST_DELAY}
            key={id}
            position="top-right"
            variant={toast.variant}
          />
        );
      })}
    </>
  );
};

Toaster.propTypes = {
  toastList: PropTypes.array.isRequired,
};

export default Toaster;
