import React, { useState, useEffect, useRef } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Box, CircularProgress, Typography
} from '@mui/material';

export default function RunLogModal({ runId, open, onClose }) {
  const [logs, setLogs] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!open || !runId) {
      setLogs([]);
      setIsComplete(false);
      return;
    }

    const eventSource = new EventSource(`/stream_run_logs/${runId}`);
    eventSource.onmessage = (event) => {
      if (event.data === '[STREAM_END]') {
        setIsComplete(true);
        eventSource.close();
      } else {
        setLogs(prev => [...prev, event.data]);
      }
    };
    eventSource.onerror = () => {
      setLogs(prev => [...prev, 'Log stream disconnected.']);
      setIsComplete(true);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [runId, open]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Organization Run Logs (Run ID: {runId})</DialogTitle>
      <DialogContent>
        <Paper sx={{ p: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '60vh', overflow: 'auto', bgcolor: 'background.default' }}>
          {logs.map((log, i) => <div key={i}>{log}</div>)}
          <div ref={logsEndRef} />
          {!isComplete && <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}><CircularProgress size={16} sx={{ mr: 1 }} /><Typography variant="caption">Running...</Typography></Box>}
          {isComplete && <Typography variant="caption" color="primary">Run complete.</Typography>}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!isComplete}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}