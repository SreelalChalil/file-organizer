import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, IconButton } from '@mui/material';
import { CheckCircle, Error, Dns, GitHub } from '@mui/icons-material';

function ServerStatus({ isConnected }) {
  return (
    <Chip
      icon={isConnected ? <CheckCircle /> : <Error />}
      label={isConnected ? 'Connected' : 'Disconnected'}
      color={isConnected ? 'success' : 'error'}
      size="small"
      variant="outlined"
    />
  );
}

export default function StatusBar() {
  const [status, setStatus] = useState({ status: 'idle' });
  const [version, setVersion] = useState('N/A');
  const [isConnected, setIsConnected] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchData = () => {
      // Fetch status and version in parallel
      Promise.all([
        fetch('/api/status'),
        fetch('/api/version')
      ])
      .then(([statusRes, versionRes]) => {
        if (!statusRes.ok || !versionRes.ok) {
          throw new Error('Server not responding');
        }
        setIsConnected(true);
        return Promise.all([statusRes.json(), versionRes.json()]);
      })
      .then(([statusData, versionData]) => {
        setStatus(statusData);
        setVersion(versionData.version);
      })
      .catch(() => {
        setIsConnected(false);
      });
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <AppBar position="fixed" color="default" sx={{ top: 'auto', bottom: 0, zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar variant="dense">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <ServerStatus isConnected={isConnected} />
          <Chip
            icon={<Dns />}
            label={`Task: ${status.status}`}
            size="small"
            color={status.status === 'running' ? 'primary' : 'default'}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Version: {version}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            © Sreelal C  -- {currentYear}
          </Typography>
          <IconButton
            component="a"
            href="https://github.com/SreelalChalil/file-organizer/"
            target="_blank"
            rel="noopener noreferrer"
            size="small"
          >
            <GitHub fontSize="small" />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}