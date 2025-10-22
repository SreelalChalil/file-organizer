import React, { useState, useEffect } from 'react';
import {
  Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Dialog, DialogTitle, DialogContent, Container,
  DialogActions, Chip
} from '@mui/material';

function LogViewer({ runId, open, onClose }) {
  const [logContent, setLogContent] = useState('');

  useEffect(() => {
    if (open && runId) {
      setLogContent('Loading...');
      fetch(`/api/runs/${runId}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch logs');
          return res.text();
        })
        .then(text => setLogContent(text))
        .catch(err => setLogContent(err.message));
    }
  }, [runId, open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Logs for Run #{runId}</DialogTitle>
      <DialogContent>
        <Paper sx={{ p: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '60vh', overflow: 'auto', bgcolor: 'background.default' }}>
          {logContent}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Logs() {
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);

  const fetchRuns = () => {
    fetch('/api/runs')
      .then(res => res.json())
      .then(data => setRuns(data))
      .catch(err => console.error('Failed to fetch runs:', err));
  };

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusChip = (status) => {
    const colorMap = {
      success: 'success',
      error: 'error',
      running: 'primary',
    };
    return <Chip label={status} color={colorMap[status] || 'default'} size="small" />;
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>Run History</Typography>
      <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 220px)' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Disk</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>End Time</TableCell>
              <TableCell>Files Moved</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {runs.map(run => (
              <TableRow key={run.id}>
                <TableCell>{run.id}</TableCell>
                <TableCell>{run.disk_name}</TableCell>
                <TableCell>{getStatusChip(run.status)}</TableCell>
                <TableCell>{new Date(run.start_ts).toLocaleString()}</TableCell>
                <TableCell>{run.end_ts ? new Date(run.end_ts).toLocaleString() : 'N/A'}</TableCell>
                <TableCell>{run.files_moved}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => setSelectedRun(run.id)}>View Log</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <LogViewer runId={selectedRun} open={Boolean(selectedRun)} onClose={() => setSelectedRun(null)} />
    </Container>
  );
}