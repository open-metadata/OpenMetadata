import { Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';

export const EmptyGraphPlaceholder = () => {
  const { t } = useTranslation();

  return (
    <ErrorPlaceHolder>
      <Typography.Text type="secondary">
        {t('label.no-data-available')}
      </Typography.Text>
    </ErrorPlaceHolder>
  );
};
