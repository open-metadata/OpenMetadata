import { Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ChangeInValueIndicatorProps {
  changeInValue: number;
  suffix: string;
  duration?: number;
}

const ChangeInValueIndicator = ({
  changeInValue,
  suffix,
  duration,
}: ChangeInValueIndicatorProps) => {
  const { t } = useTranslation();

  return (
    <Typography.Paragraph className="data-insight-label-text">
      <Typography.Text type={changeInValue >= 0 ? 'success' : 'danger'}>
        {changeInValue >= 0 ? '+' : ''}
        {changeInValue.toFixed(2)}
        {suffix}
      </Typography.Text>{' '}
      {duration
        ? t('label.days-change-lowercase', {
            days: duration,
          })
        : ''}
    </Typography.Paragraph>
  );
};

export default ChangeInValueIndicator;
