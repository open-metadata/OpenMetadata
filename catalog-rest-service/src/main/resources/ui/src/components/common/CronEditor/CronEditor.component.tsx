import { Divider } from 'antd';
import 'antd/dist/antd.css';
import React, { useCallback, useEffect, useState } from 'react';
import Cron from 'react-js-cron';

type Props = {
  defaultValue: string;
  onChangeHandler?: (v: string) => void;
  children?: React.ReactNode;
  isReadOnly?: boolean;
  className?: string;
};

const CronEditor = ({
  defaultValue,
  onChangeHandler,
  children,
  isReadOnly = false,
  className,
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
      />
      {children ? <Divider>OR</Divider> : null}

      {children}
    </div>
  );
};

export default CronEditor;
