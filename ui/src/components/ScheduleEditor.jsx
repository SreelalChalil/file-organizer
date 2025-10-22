import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    FormGroup,
    FormControlLabel,
    Checkbox,
    TextField,
    Button,
    Switch,
    Grid,
    Stack
} from '@mui/material';

const daysOfWeek = [
    { label: 'Mon', value: '1' },
    { label: 'Tue', value: '2' },
    { label: 'Wed', value: '3' },
    { label: 'Thu', value: '4' },
    { label: 'Fri', value: '5' },
    { label: 'Sat', value: '6' },
    { label: 'Sun', value: '0' }, // Cron standard for Sunday
];

// Helper to parse a cron string into UI state
const parseCron = (cronString) => {
    if (!cronString || cronString.split(' ').length !== 5) {
        return { time: '22:00', days: [], enabled: false };
    }
    const parts = cronString.split(' ');
    const minute = parts[0].padStart(2, '0');
    const hour = parts[1].padStart(2, '0');
    const days = parts[4].split(',');

    return { time: `${hour}:${minute}`, days, enabled: true };
};

// Helper to build a cron string from UI state
const buildCron = (time, days, enabled) => {
    if (!enabled || days.length === 0) {
        return null; // Send null to disable the schedule
    }
    const [hour, minute] = time.split(':');
    const dayOfWeek = days.sort().join(',');
    return `${parseInt(minute)} ${parseInt(hour)} * * ${dayOfWeek}`;
};

function ScheduleEditor({ diskName, initialSchedule, onSave }) {
    const [enabled, setEnabled] = useState(false);
    const [time, setTime] = useState('22:00');
    const [days, setDays] = useState([]);

    useEffect(() => {
        const { time: initialTime, days: initialDays, enabled: initialEnabled } = parseCron(initialSchedule);
        setTime(initialTime);
        setDays(initialDays);
        setEnabled(initialEnabled);
    }, [initialSchedule]);

    const handleDayChange = (event) => {
        const { value, checked } = event.target;
        if (checked) {
            setDays([...days, value]);
        } else {
            setDays(days.filter((day) => day !== value));
        }
    };

    const handleSave = () => {
        const newCron = buildCron(time, days, enabled);
        onSave(diskName, newCron);
    };

    const isDirty = buildCron(time, days, enabled) !== initialSchedule;

    return (
        <Box sx={{ width: '100%' }}>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                    <Typography variant="h6">{diskName}</Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                            />
                        }
                        label={enabled ? "Schedule Enabled" : "Schedule Disabled"}
                    />
                </Grid>
                <Grid item xs={12} md={8}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent={{ sm: 'flex-end' }}>
                        <TextField
                            label="Time to Run (24h)"
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            disabled={!enabled}
                            InputLabelProps={{
                                shrink: true,
                            }}
                            sx={{ minWidth: 150 }}
                        />
                        <FormGroup row sx={{ flexGrow: { sm: 1 } }}>
                            {daysOfWeek.map((day) => (
                                <FormControlLabel
                                    key={day.value}
                                    control={
                                        <Checkbox
                                            checked={days.includes(day.value)}
                                            onChange={handleDayChange}
                                            value={day.value}
                                            disabled={!enabled}
                                        />
                                    }
                                    label={day.label}
                                />
                            ))}
                        </FormGroup>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={!isDirty}
                        >
                            Save
                        </Button>
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    );
}

export default ScheduleEditor;