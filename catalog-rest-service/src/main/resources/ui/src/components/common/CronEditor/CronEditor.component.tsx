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

import 'antd/dist/antd.css';
import React, { useCallback, useEffect, useState } from 'react';
import Cron, { CronError } from 'react-js-cron';

type Props = {
  defaultValue: string;
  onChangeHandler?: (v: string) => void;
  children?: React.ReactNode;
  isReadOnly?: boolean;
  className?: string;
  onError?: (v: CronError) => void;
};

const CronEditor = ({
  defaultValue,
  onChangeHandler,
  children,
  isReadOnly = false,
  className,
  onError,
}: Props) => {
  const [value, setValue] = useState(defaultValue);
  const customSetValue = useCallback((newValue) => {
    setValue(newValue);
    onChangeHandler?.(newValue);
  }, []);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return (
    <div className={className}>
      <Cron
        className="tw-z-9999 my-project-cron"
        readOnly={isReadOnly}
        setValue={customSetValue}
        value={value}
        onError={onError}
      />
      {children ? <>{children}</> : null}
    </div>
  );
};

export default CronEditor;
