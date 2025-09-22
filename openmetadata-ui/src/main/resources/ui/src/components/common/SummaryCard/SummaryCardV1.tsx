import { Box, Card, Skeleton, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { ReactComponent as AddItemIcon } from '../../../assets/svg/add-item-icon.svg';

const SummaryCardV1 = ({
  isLoading,
  title,
  value,
  icon,
  extra,
}: {
  isLoading: boolean;
  title: ReactNode;
  value: string | number;
  icon?: SvgComponent;
  extra?: ReactNode;
}) => {
  if (isLoading) {
    return <Skeleton height={120} variant="rounded" width={210} />;
  }

  const Icon = icon ?? AddItemIcon;

  return (
    <Box>
      <Card
        sx={{
          borderRadius: '12px',
          border: '1px solid #E9E9F5',
          boxShadow: '0 4px 3px 0 rgba(235, 239, 250, 0.25)',
          minWidth: '210px',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          p: '20px',
          width: '100%',
        }}
        variant="outlined">
        <Icon height={40} width={40} />
        <Box>
          <Typography sx={{ fontSize: '18px', fontWeight: 600 }} variant="h6">
            {value}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ fontSize: '14px', fontWeight: 500 }}>
            {title}
          </Typography>
        </Box>
      </Card>
      {extra && (
        <Box
          sx={{
            mt: 0,
            mx: 2,
            px: 2,
            py: 1,
            background: '#F8F9FC',
            borderRadius: '0 0 12px 12px',
            boxShadow: '0 4px 3px 0 rgba(235, 239, 250, 0.10)',
            border: 'none',
          }}>
          <Typography sx={{ fontSize: 10, fontWeight: 500 }}>
            {extra}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SummaryCardV1;
