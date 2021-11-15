import { Divider } from 'antd';
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
      {children ? (
        <>
          <Divider>OR</Divider>
          {children}
        </>
      ) : null}
    </div>
  );
};

export default CronEditor;
