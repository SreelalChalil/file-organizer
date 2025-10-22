import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, CircularProgress, Paper, Card, CardContent, CardActions,
  LinearProgress, Grid, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, Container, Snackbar, Alert
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RunLogModal from './RunLogModal';
import { getDisks, runOrganization, getDiskEmptyDirs, cleanupEmptyDirs } from '../api';

const formatBytes = (bytes) => {
  if (bytes === null || typeof bytes === 'undefined' || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

function UsageBar({ title, usage }) {
  if (!usage || usage.error) {
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">{title}</Typography>
        <Typography color="error" variant="caption">Could not load disk usage: {usage?.error || 'Unknown error'}</Typography>
      </Box>
    );
  }
  const usedPercent = usage.total > 0 ? (usage.used / usage.total) * 100 : 0;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2">{title}: {`${formatBytes(usage.free)} free of ${formatBytes(usage.total)}`}</Typography>
      <LinearProgress
        variant="determinate"
        value={usedPercent}
        sx={{ height: 10, borderRadius: 5, mt: 1 }}
      />
    </Box>
  );
}

function DiskDetailCard({ disk, onRun, onCleanup, onNavigateToFiles, onEdit }) {
  if (!disk) return null;

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h4" gutterBottom>Manage Disk: {disk.name}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">Source Path:</Typography>
            <Typography><code>{disk.source_dir}</code></Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">Sorted Path:</Typography>
            <Typography><code>{disk.sorted_dir}</code></Typography>
          </Grid>
        </Grid>
        <UsageBar title="Source Usage" usage={disk.usage?.source} />
        <UsageBar title="Sorted Usage" usage={disk.usage?.sorted} />
      </CardContent>
      <CardActions>
        <Button variant="contained" color="primary" onClick={onRun}>
          Run Organization
        </Button>
        <Button variant="outlined" color="secondary" onClick={() => onCleanup(disk.name)}>
          Cleanup Empty Folders
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" onClick={() => onNavigateToFiles('/files', { state: { initialPath: disk.source_dir } })}>
          Broese Files
        </Button>
        <Button size="small" onClick={onEdit}>Edit</Button>
      </CardActions>
    </Card>
  );
}

export default function DiskView() {
    const { diskName } = useParams();
    const navigate = useNavigate();
    const [disk, setDisk] = useState(null);
    const [loading, setLoading] = useState(true);
    const [runLogModalOpen, setRunLogModalOpen] = useState(false);
    const [currentRunId, setCurrentRunId] = useState(null);
    const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
    const [emptyDirs, setEmptyDirs] = useState([]);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    useEffect(() => {
        setLoading(true);
        getDisks()
            .then(data => {
                const foundDisk = data.find(d => d.name === diskName);
                setDisk(foundDisk);
            })
            .finally(() => setLoading(false));
    }, [diskName]);

    const handleRun = () => {
        runOrganization({ disk: diskName }) // Pass payload as an object
            .then(data => {
                if (data.run_id) {
                    setCurrentRunId(data.run_id);
                    setRunLogModalOpen(true);
                } else {
                    setSnackbar({ open: true, message: data.error || 'Failed to start run.', severity: 'error' });
                }
            })
            .catch(err => setSnackbar({ open: true, message: `Request failed: ${err.message}`, severity: 'error' }));
    };

    const handleOpenCleanup = (diskName) => {
        setEmptyDirs([]);
        setCleanupModalOpen(true);
        getDiskEmptyDirs(diskName)
            .then(setEmptyDirs)
            .catch(err => setSnackbar({ open: true, message: `Failed to find empty dirs: ${err.message}`, severity: 'error' }));
    };

    const handleConfirmCleanup = () => {
        cleanupEmptyDirs(emptyDirs)
            .then(data => {
                if (data.errors && data.errors.length > 0) {
                    setSnackbar({ open: true, message: `Cleanup finished with ${data.errors.length} errors.`, severity: 'warning' });
                } else {
                    setSnackbar({ open: true, message: `Successfully deleted ${data.deleted} empty directories.`, severity: 'success' });
                }
                setCleanupModalOpen(false);
            })
            .catch(err => setSnackbar({ open: true, message: `Cleanup failed: ${err.message}`, severity: 'error' }));
    };

    if (loading) {
        return <CircularProgress />;
    }

    if (!disk) {
        return <Typography color="error">Disk '{diskName}' not found.</Typography>;
    }

    return (
        <Container maxWidth="lg">
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
            <Box sx={{ mb: 2 }}>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/disks')}>
                    Back to Disks
                </Button>
            </Box>

            <DiskDetailCard disk={disk} onRun={handleRun} onCleanup={handleOpenCleanup} onNavigateToFiles={navigate} onEdit={() => navigate('/disks', { state: { editDisk: disk.name } })} />

            <RunLogModal
                runId={currentRunId}
                open={runLogModalOpen}
                onClose={() => setRunLogModalOpen(false)}
            />

            <Dialog open={cleanupModalOpen} onClose={() => setCleanupModalOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>Confirm Cleanup</DialogTitle>
                <DialogContent>
                    <Typography>The following empty directories will be permanently deleted:</Typography>
                    {emptyDirs.length > 0 ? (
                        <Paper sx={{ maxHeight: '40vh', overflow: 'auto', mt: 2 }}>
                            <List dense>
                                {emptyDirs.map(dir => (
                                    <ListItem key={dir}>
                                        <ListItemText primary={<code>{dir}</code>} />
                                    </ListItem>
                                ))}
                            </List>
                        </Paper>
                    ) : (
                        <Typography sx={{ mt: 2 }}>No empty directories found.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCleanupModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmCleanup} color="error" disabled={emptyDirs.length === 0}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}