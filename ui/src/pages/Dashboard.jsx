import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, ListItemText, Button, Box, Card, CardContent, CardHeader, Chip, Grid, CircularProgress, LinearProgress, CardActions, Container } from '@mui/material';
import { runOrganizerTask } from '../api';

function StatusCard({ status }) {
  const isRunning = status.status === 'running';

  const lastRun = status.last_run_ts
    ? `${new Date(status.last_run_ts).toLocaleString()} (${status.last_run_status})`
    : 'Never';

  return (
    <Card variant="outlined">
      <CardHeader
        title="Task Status"
        action={
          isRunning ? (
            <Chip icon={<CircularProgress size={16} />} label={`Running on: ${status.disk}`} color="primary" />
          ) : (
            <Chip label="Idle" color="success" />
          )
        }
      />
      <CardContent>
        <Typography variant="body2">
          Last run: {lastRun}
        </Typography>
      </CardContent>
    </Card>
  );
}

function HostInfoCard({ info }) {
  if (!info) {
    return null;
  }
  return (
    <Card variant="outlined">
      <CardHeader title="Host Information" />
      <CardContent>
        <Typography variant="body2"><strong>Hostname:</strong> {info.hostname}</Typography>
        <Typography variant="body2"><strong>OS:</strong> {info.system}</Typography>
        <Typography variant="body2"><strong>Release:</strong> {info.release}</Typography>
        <Typography variant="body2"><strong>Architecture:</strong> {info.machine}</Typography>
        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
          <strong>Version:</strong> {info.version}
        </Typography>
      </CardContent>
    </Card>
  );
}

function DiskUsage({ disk }) {
  const usage = disk.usage?.source; // The dashboard should primarily show the source disk usage.

  if (!usage || usage.error) {
    return <ListItemText primary={disk.name} secondary={usage?.error || 'Usage data not available'} />;
  }

  const formatBytes = (bytes) => {
    if (bytes === null || typeof bytes === 'undefined' || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const { total, used, free } = usage;
  const usedPercent = total > 0 ? (used / total) * 100 : 0;

  return (
    <>
      <ListItemText
        primary={disk.name}
        secondary={`${formatBytes(free)} free of ${formatBytes(total)}`}
      />
      <LinearProgress
        variant="determinate"
        value={usedPercent}
        sx={{
          height: 8,
          borderRadius: 4,
          mt: 0.5,
          bgcolor: 'grey.300',
          '& .MuiLinearProgress-bar': { bgcolor: usedPercent > 85 ? 'error.main' : 'primary.main' },
        }}
      />
    </>
  );
}

export default function Dashboard({ disks, onRun, onNavigate }) {
  const [status, setStatus] = useState({ status: 'idle' });
  const [hostInfo, setHostInfo] = useState(null);

  // Fetch initial data: disks and status
  useEffect(() => {
    const fetchStatus = () => {
      fetch('/api/status')
        .then(res => res.json())
        .then(data => setStatus(data))
        .catch(err => console.error('Failed to fetch status:', err));
    };

    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 2000); // Poll status every 2 seconds

    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    fetch('/api/host-info').then(res => res.json()).then(setHostInfo)
      .catch(err => console.error('Failed to fetch host info:', err));
  }, []);

  const handleRun = (diskName) => {
    runOrganizerTask({ disk: diskName })
      .then(response => {
        console.log('Run started for disk:', diskName, 'Run ID:', response.run_id);
        // The status card will update automatically via polling.
        // We can also trigger a refresh of disk data if needed.
        setTimeout(onRun, 2000);
      })
      .catch(err => {
        alert(`Failed to start run: ${err.message}`);
      });
  };

  return (
    <Container maxWidth="lg"><Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>Dashboard</Typography>
      </Grid>
      <Grid item xs={12} md={5} lg={4}>
        <Typography variant="h5" gutterBottom>System Status</Typography>
        <Paper sx={{ p: 2 }}>
          <StatusCard status={status} />
          <Box mt={2}>
            <HostInfoCard info={hostInfo} />
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={7} lg={8}>
        <Typography variant="h5" gutterBottom>Configured Disks</Typography>
        <Grid container spacing={2}>
          {disks.map(d => (
            <Grid item xs={12} sm={6} key={d.name}>
              <Card variant="outlined">
                <CardContent>
                  <DiskUsage disk={d} />
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => onNavigate(`/disk-view/${d.name}`)}>Manage</Button>
                  <Button size="small" onClick={() => handleRun(d.name)} disabled={status.status === 'running'}>Run Now</Button>
                  <Button size="small" onClick={() => onNavigate('/disks')}>Edit Settings</Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Grid></Grid>
    </Container>
  );
}