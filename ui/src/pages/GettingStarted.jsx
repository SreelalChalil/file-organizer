import React from 'react';
import { Card, CardContent, Typography, Button, Box, Alert } from '@mui/material';

export default function GettingStarted({ onNavigate, hasDisks, hasKeywords }) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Welcome to File Organizer!
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          To get started, you need to configure at least one disk and one keyword category.
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          {!hasDisks && (
            <Box>
              <Alert severity="info" sx={{ mb: 1 }}>
                Step 1: Add a disk to organize.
              </Alert>
              <Button variant="contained" onClick={() => onNavigate('disks')}>
                Configure Disks
              </Button>
            </Box>
          )}

          {!hasKeywords && (
            <Box>
              <Alert severity="info" sx={{ mb: 1 }}>
                Step 2: Set up keyword rules.
              </Alert>
              <Button variant="contained" onClick={() => onNavigate('keywords')}>
                Configure Keywords
              </Button>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}