/*
 *  Copyright 2025 Collate.
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
/* eslint-disable i18next/no-literal-string */
import { MoreVert as MoreVertIcon } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ArrowLeft,
  ArrowRight,
  BarChart03,
  Coins01,
  Database03,
  PaintPour,
  Settings01,
  Tag03,
} from '@untitledui/icons';

export function TableExample() {
  const theme = useTheme();
  // Domain table data based on screenshot
  const domains = [
    {
      id: 1,
      name: 'Engineering',
      icon: Settings01,
      iconColor: 'brand',
      owner: 'Owner 1',
      ownerAvatar:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=40&q=80',
      glossaryTerms: ['Required'],
      domainType: 'Engineering',
      tags: ['Required'],
    },
    {
      id: 2,
      name: 'Sales',
      icon: Settings01,
      iconColor: 'warning',
      owner: 'Owner 1',
      ownerAvatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=40&q=80',
      glossaryTerms: ['Required', 'URL'],
      domainType: 'Sales',
      tags: ['Required', 'URL'],
    },
    {
      id: 3,
      name: 'Finance',
      icon: Coins01,
      iconColor: 'success',
      owner: 'Owner 1',
      ownerAvatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=40&q=80',
      glossaryTerms: ['Required'],
      domainType: 'Finance',
      tags: ['Required'],
    },
    {
      id: 4,
      name: 'Marketing',
      icon: BarChart03,
      iconColor: 'brand',
      owner: 'Owner 1',
      ownerAvatar:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=40&q=80',
      glossaryTerms: ['Required', 'URL'],
      domainType: 'Marketing',
      tags: ['Required', 'URL'],
    },
    {
      id: 5,
      name: 'Data Catalog',
      icon: Database03,
      iconColor: 'warning',
      owner: 'Owner 1',
      ownerAvatar:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=40&q=80',
      glossaryTerms: ['Required'],
      domainType: 'Engineering',
      tags: ['Required'],
    },
    {
      id: 6,
      name: 'Product Design',
      icon: PaintPour,
      iconColor: 'success',
      owner: 'Owner 1',
      ownerAvatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=40&q=80',
      glossaryTerms: ['Required'],
      domainType: 'Product',
      tags: ['Required'],
    },
  ];

  return (
    <Box>
      <TableContainer component={Paper}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            gap: 2,
            borderBottom: `1px solid ${theme.palette.allShades.gray[200]}`,
            backgroundColor: 'background.paper',
            px: { xs: 2, md: 3 },
            py: 2.5,
          }}>
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '1.125rem',
                  color: 'text.primary',
                }}
                variant="h6">
                Domains
              </Typography>
              <Chip
                color="primary"
                label="8 domains"
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              />
            </Box>
            <Typography
              sx={{ color: 'text.secondary', fontSize: '0.875rem' }}
              variant="body2">
              Manage your data domains and their metadata configuration.
            </Typography>
          </Box>
          <IconButton color="primary" size="small">
            <MoreVertIcon />
          </IconButton>
        </Box>

        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox size="medium" />
              </TableCell>
              <TableCell>Domain</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>Glossary Terms</TableCell>
              <TableCell>Domain Type</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell align="right" width={50} />
            </TableRow>
          </TableHead>
          <TableBody>
            {domains.map((domain) => (
              <TableRow hover key={domain.id}>
                <TableCell padding="checkbox">
                  <Checkbox size="medium" />
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      fontWeight: 500,
                    }}>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        backgroundColor:
                          theme.palette.allShades[domain.iconColor]?.[200] ||
                          theme.palette.allShades.gray[200],
                        color: 'white',
                        border: `1px solid ${
                          theme.palette.allShades[domain.iconColor]?.[300] ||
                          theme.palette.allShades.gray[300]
                        }90`,
                      }}>
                      <domain.icon size={20} />
                    </Avatar>
                    {domain.name}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      alt={domain.owner}
                      src={domain.ownerAvatar}
                      sx={{
                        width: 16,
                        height: 16,
                      }}
                    />
                    {domain.owner}
                  </Box>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    {domain.glossaryTerms.map((term) => (
                      <Chip
                        icon={<Tag03 size={12} />}
                        key={term}
                        label={term}
                        size="large"
                        variant="blueGray"
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>{domain.domainType}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    {domain.tags.map((tag) => (
                      <Chip
                        icon={<Tag03 size={12} />}
                        key={tag}
                        label={tag}
                        size="large"
                        variant="blueGray"
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ pr: 2 }}>
                  <IconButton
                    color="primary"
                    size="small"
                    sx={{
                      p: 0.5,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: `1px solid ${theme.palette.allShades.gray[200]}`,
            pt: 3.5,
            px: 6,
            pb: 5,
          }}>
          <Button
            color="secondary"
            size="small"
            startIcon={
              <ArrowLeft style={{ color: theme.palette.allShades.gray[400] }} />
            }
            variant="contained">
            Previous
          </Button>

          <Pagination
            hideNextButton
            hidePrevButton
            count={10}
            page={3}
            shape="rounded"
            variant="outlined"
          />

          <Button
            color="secondary"
            endIcon={
              <ArrowRight
                style={{ color: theme.palette.allShades.gray[400] }}
              />
            }
            size="small"
            variant="contained">
            Next
          </Button>
        </Box>
      </TableContainer>
    </Box>
  );
}
