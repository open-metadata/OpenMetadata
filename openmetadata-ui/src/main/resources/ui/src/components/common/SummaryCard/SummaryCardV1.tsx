import { Box, Card, Chip, Typography } from '@mui/material';
import { ReactComponent as NoDataIcon } from '../../../assets/svg/ticket-with-check.svg';

const SummaryCardV1 = () => {
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
        <Chip
          color="secondary"
          icon={<NoDataIcon />}
          sx={{
            backgroundColor: 'white',
            height: '40px',
            width: '40px',
            borderRadius: '8px',
            '.MuiChip-icon': {
              m: 0,
            },
          }}
          variant="outlined"
        />
        <Box>
          <Typography sx={{ fontSize: '18px', fontWeight: 600 }} variant="h6">
            1245
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ fontSize: '14px', fontWeight: 500 }}>
            Row Count
          </Typography>
        </Box>
      </Card>
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
          Last updated: Sep 17, 2025 12:34 PM
        </Typography>
      </Box>
    </Box>
  );
};

export default SummaryCardV1;
