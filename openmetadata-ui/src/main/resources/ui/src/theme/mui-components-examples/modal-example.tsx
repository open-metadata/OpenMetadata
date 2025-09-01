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
import { ThemedCheckbox as Checkbox } from '@/theme/themed-checkbox';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Modal,
  Stack,
  Typography,
} from '@mui/material';
import { CheckCircle, X } from '@untitledui/icons';
import { useState } from 'react';

export function ModalExample() {
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleModalOpen = () => setModalOpen(true);
  const handleModalClose = () => setModalOpen(false);

  const handleDialogOpen = () => setDialogOpen(true);
  const handleDialogClose = () => setDialogOpen(false);

  return (
    <>
      <Card>
        <CardContent>
          <Box>
            <Typography gutterBottom variant="h6">
              Modal & Dialog Examples
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button variant="contained" onClick={handleModalOpen}>
                Open Modal
              </Button>
              <Button variant="outlined" onClick={handleDialogOpen}>
                Open Confirm Dialog
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Modal Example - Matching Native Structure */}
      <Modal
        aria-describedby="modal-description"
        aria-labelledby="modal-title"
        open={modalOpen}
        onClose={handleModalClose}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: { xs: '100%', sm: '544px' }, // sm:max-w-136
            borderRadius: { xs: '12px', sm: '16px' }, // rounded-2xl, max-sm:rounded-xl
            bgcolor: 'background.paper', // bg-primary
            overflow: 'hidden',
            outline: 'none',
          }}>
          {/* Close Button - absolute positioned */}
          <IconButton
            sx={{
              position: 'absolute',
              top: 12, // top-3
              right: 12, // right-3
              zIndex: 20, // z-20
              bgcolor: 'transparent',
              color: 'grey.400', // text-fg-quaternary
              '&:hover': {
                bgcolor: 'grey.50', // hover:bg-primary_hover
                color: 'grey.500', // hover:text-fg-quaternary_hover
              },
            }}
            onClick={handleModalClose}>
            <X className="h-6 w-6" />
          </IconButton>

          {/* Modal Content - matching native layout */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' }, // flex-col sm:flex-row
              gap: 2, // gap-4
              px: { xs: 2, sm: 3 }, // px-4 sm:px-6
              pt: { xs: 2.5, sm: 3 }, // pt-5 sm:pt-6
            }}>
            {/* Featured Icon */}
            <Box sx={{ position: 'relative', width: 'max-content' }}>
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48, // size-12
                  height: 48, // size-12
                  borderRadius: '50%', // rounded-full
                  bgcolor: 'success.light', // bg-success-secondary
                  color: 'success.main', // text-featured-icon-light-fg-success
                }}>
                <CheckCircle className="h-6 w-6" />
              </Box>
            </Box>

            {/* Text Content */}
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5, // gap-0.5
              }}>
              <Typography
                id="modal-title"
                sx={{
                  fontSize: '1rem', // text-md
                  fontWeight: 600, // font-semibold
                  color: 'text.primary', // text-primary
                }}
                variant="h6">
                Blog post published
              </Typography>
              <Typography
                id="modal-description"
                sx={{
                  fontSize: '0.875rem', // text-sm
                  color: 'text.secondary', // text-tertiary
                  display: { xs: 'block', sm: 'none' }, // sm:hidden
                }}>
                This blog post has been published. Team members will be able to
                edit this post.
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.875rem', // text-sm
                  color: 'text.secondary', // text-tertiary
                  display: { xs: 'none', sm: 'block' }, // hidden sm:flex
                }}>
                This blog post has been published. Team members will be able to
                edit this post and republish changes.
              </Typography>
            </Box>
          </Box>

          {/* Modal Footer - matching native layout */}
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: { xs: 'column-reverse', sm: 'row' }, // flex-col-reverse sm:flex-row
              alignItems: { xs: 'stretch', sm: 'center' }, // sm:items-center
              gap: 1.5, // gap-3
              px: { xs: 2, sm: 3 }, // p-4 sm:px-6
              pt: 3, // pt-6
              pb: { xs: 2, sm: 3 }, // sm:pb-6
            }}>
            {/* Checkbox */}
            <FormControlLabel
              control={<Checkbox size="small" />}
              label="Don't show again"
              sx={{
                '& .MuiFormControlLabel-label': {
                  fontSize: '0.875rem', // text-sm
                  fontWeight: 500, // font-medium
                  color: 'text.primary', // text-secondary
                },
              }}
            />

            {/* Buttons */}
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                ml: { xs: 0, sm: 'auto' }, // sm:ml-auto
              }}>
              <Button
                color="secondary"
                variant="contained"
                onClick={handleModalClose}>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleModalClose}>
                Confirm
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>

      {/* Confirmation Dialog - Simple Version */}
      <Dialog
        aria-describedby="alert-dialog-description"
        aria-labelledby="alert-dialog-title"
        open={dialogOpen}
        onClose={handleDialogClose}>
        <DialogTitle id="alert-dialog-title">Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography id="alert-dialog-description">
            Are you sure you want to delete this item? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="secondary"
            variant="contained"
            onClick={handleDialogClose}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDialogClose}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
