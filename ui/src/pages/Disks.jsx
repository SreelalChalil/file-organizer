import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, Container, Snackbar, Alert, DialogContentText,
  TableRow, TextField, Typography, CircularProgress, IconButton, Menu, MenuItem
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useDebounce } from './hooks/useDebounce';

function PathValidator({ path }) {
  const [validation, setValidation] = useState({ status: 'idle', message: '' });
  const debouncedPath = useDebounce(path, 500); // Debounce input for 500ms

  useEffect(() => {
    if (!debouncedPath) {
      setValidation({ status: 'idle', message: '' });
      return;
    }
    setValidation({ status: 'loading', message: '' });
    fetch(`/api/validate-path?path=${encodeURIComponent(debouncedPath)}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setValidation({ status: 'ok', message: data.message });
        } else {
          setValidation({ status: 'error', message: data.message || 'Validation failed' });
        }
      })
      .catch(() => setValidation({ status: 'error', message: 'Error connecting to server.' }));
  }, [debouncedPath]);

  if (validation.status === 'idle') return null;

  const color = validation.status === 'ok' ? 'success.main' : 'error.main';
  const Icon = validation.status === 'ok' ? CheckCircleOutlineIcon : validation.status === 'error' ? ErrorOutlineIcon : CircularProgress;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color }}>
      <Icon sx={{ fontSize: 16, mr: 0.5 }} color="inherit" size={16} />
      <Typography variant="caption" color="inherit">{validation.message}</Typography>
    </Box>
  );
}

function DiskFormModal({ open, onClose, onSave, disk }) {
  const [form, setForm] = useState({ name: '', source: '', sorted: '', schedule: '' });

  useEffect(() => {
    if (disk) {
      setForm({ name: disk.name, source: disk.source_dir, sorted: disk.sorted_dir, schedule: disk.schedule || '' });
    } else {
      setForm({ name: '', source: '', sorted: '', schedule: '' });
    }
  }, [disk, open]);

  const handleSave = () => {
    onSave(form);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{disk ? 'Edit Disk' : 'Add New Disk'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Disk Name"
          fullWidth
          variant="standard"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          disabled={!!disk}
        />
        <TextField
          margin="dense"
          label="Source Path"
          fullWidth
          variant="standard"
          value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value })}
        />
        <PathValidator path={form.source} />
        <TextField
          margin="dense"
          label="Sorted Path (Destination Root)"
          fullWidth
          variant="standard"
          value={form.sorted}
          onChange={(e) => setForm({ ...form, sorted: e.target.value })}
        />
        <PathValidator path={form.sorted} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function ActionMenu({ disk, onEdit, onDelete }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <IconButton onClick={handleClick}><MoreVertIcon /></IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={() => { onEdit(disk); handleClose(); }}>Edit</MenuItem>
        <MenuItem onClick={() => { onDelete(disk); handleClose(); }} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>
    </>
  );
}

export default function Disks({ onUpdate, onNavigate, context }) {
  const [disks, setDisks] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDisk, setEditingDisk] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const loadDisks = () => {
    fetch('/api/disks')
      .then(res => res.json())
      .then(data => setDisks(data))
      .catch(console.error);
  };

  useEffect(loadDisks, []);

  useEffect(() => {
    if (context?.editDisk && disks.length > 0) {
      const diskToEdit = disks.find(d => d.name === context.editDisk);
      if (diskToEdit) {
        setEditingDisk(diskToEdit);
        setModalOpen(true);
      }
    }
  }, [context, disks]);

  const handleSave = (formData) => {
    const url = editingDisk ? `/api/disks/${encodeURIComponent(editingDisk.name)}` : '/api/disks';
    const method = editingDisk ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    }).then(res => {
      if (!res.ok) return res.json().then(err => { throw new Error(err.error) });
      setModalOpen(false);
      setEditingDisk(null);
      loadDisks();
      setSnackbar({ open: true, message: 'Disk saved successfully!', severity: 'success' });
      onUpdate(); // Notify App.jsx to reload global state
    }).catch(err => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const handleDelete = (name) => {
    fetch(`/api/disks/${encodeURIComponent(name)}`, { method: 'DELETE' }) // NOSONAR
      .then(() => {
        loadDisks();
        setSnackbar({ open: true, message: 'Disk deleted.', severity: 'success' });
        onUpdate();
      }).catch(err => setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' }))
      .finally(() => setConfirmDelete(null));
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Manage Disks</Typography>
        <Button variant="contained" onClick={() => { setEditingDisk(null); setModalOpen(true); }}>Add Disk</Button>
      </Box>

      <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 220px)' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Source Path</TableCell>
              <TableCell>Sorted Path</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {disks.map(d => (
              <TableRow key={d.name}>
                <TableCell>
                  <Link component="button" variant="body2" onClick={() => onNavigate(`/disk-view/${d.name}`)}>
                    {d.name}
                  </Link>
                </TableCell>
                <TableCell>{d.source_dir}</TableCell>
                <TableCell>{d.sorted_dir}</TableCell>
                <TableCell>
                  <ActionMenu disk={d} onEdit={() => { setEditingDisk(d); setModalOpen(true); }} onDelete={setConfirmDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <DiskFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} disk={editingDisk} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the disk "<strong>{confirmDelete?.name}</strong>"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button onClick={() => handleDelete(confirmDelete.name)} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}