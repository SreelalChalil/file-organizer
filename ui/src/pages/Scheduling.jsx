import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    List,
    ListItem,
    CircularProgress,
    Alert,
    Divider,
    Snackbar,
    Container
} from '@mui/material';
import ScheduleEditor from '../components/ScheduleEditor';
import { getDisks, updateDisk, getKeywords } from '../api';
import GettingStarted from './GettingStarted';
import { useNavigate } from 'react-router-dom';

function Scheduling() {
    const [disks, setDisks] = useState([]);
    const [keywords, setKeywords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const navigate = useNavigate();

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [disksData, keywordsData] = await Promise.all([
                getDisks(),
                getKeywords(),
            ]);
            setDisks(disksData);
            setKeywords(keywordsData);
        } catch (err) {
            setError(err.message || 'Failed to fetch initial data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async (diskName, newSchedule) => {
        try {
            // Find the full disk object to send back all its data
            const diskToUpdate = disks.find(d => d.name === diskName);
            if (!diskToUpdate) {
                throw new Error("Disk not found locally. Please refresh.");
            }

            const updatedData = {
                name: diskToUpdate.name,
                source: diskToUpdate.source_dir, // Correctly use source_dir from the fetched disk object
                sorted: diskToUpdate.sorted_dir, // Correctly use sorted_dir from the fetched disk object
                schedule: newSchedule,
            };

            await updateDisk(diskName, updatedData);

            // Optimistically update UI
            setDisks(disks.map(d => d.name === diskName ? { ...d, schedule: newSchedule } : d));
            setSnackbar({ open: true, message: `Schedule for '${diskName}' saved successfully!`, severity: 'success' });
        } catch (err) {
            setSnackbar({ open: true, message: `Failed to save schedule: ${err.message}`, severity: 'error' });
        }
    };

    const handleCloseSnackbar = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar({ ...snackbar, open: false });
    };

    const showGettingStarted = !loading && (disks.length === 0 || keywords.length === 0);
    const handleNavigate = (page) => {
        navigate(`/${page}`);
    };

    return (
        <Container maxWidth="lg">
            <Typography variant="h4" gutterBottom>
                Automated Organization Schedules
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Configure a schedule for each disk to run the file organization process automatically. All times are based on the server's timezone.
            </Typography>

            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

            {!loading && !error && showGettingStarted && (
                <GettingStarted
                    onNavigate={handleNavigate}
                    hasDisks={disks.length > 0}
                    hasKeywords={keywords.length > 0}
                />
            )}

            {!loading && !error && !showGettingStarted && (
                <Paper elevation={3}>
                        <List disablePadding>
                            {disks.map((disk, index) => (
                                <React.Fragment key={disk.name}>
                                    <ListItem sx={{ p: 3 }}>
                                        <ScheduleEditor
                                            diskName={disk.name}
                                            initialSchedule={disk.schedule}
                                            onSave={handleSave}
                                        />
                                    </ListItem>
                                    {index < disks.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                </Paper>
            )}

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
}

export default Scheduling;