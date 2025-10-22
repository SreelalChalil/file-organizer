import React, { useState, useEffect } from 'react';
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, CircularProgress, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { Folder, InsertDriveFile, ArrowUpward, ArrowBack } from '@mui/icons-material';

const formatBytes = (bytes) => {
  if (!bytes) return 'N/A';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

function RenameModal({ open, onClose, onRename, currentName }) {
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (open) {
      setNewName(currentName);
    }
  }, [open, currentName]);

  const handleRename = () => {
    onRename(newName);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Rename</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="New Name"
          fullWidth
          variant="standard"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleRename()}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleRename}>Rename</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function FileBrowser({ title, initialPath }) {
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [renamingFile, setRenamingFile] = useState(null);

  const loadFiles = React.useCallback(() => {
    setLoading(true);
    setError('');
    fetch(`/api/files?path=${encodeURIComponent(currentPath)}`)
      .then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.error) });
        return res.json();
      })
      .then(data => setFiles(data.sort((a, b) => (b.is_dir - a.is_dir) || a.name.localeCompare(b.name))))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentPath]);

  useEffect(() => {
    if (currentPath) {
      loadFiles();
    }
  }, [currentPath, loadFiles]);

  const handleDelete = (filePath) => {
    if (!window.confirm(`Are you sure you want to delete "${filePath}"? This cannot be undone.`)) return;

    fetch(`/api/files?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.error) });
        loadFiles();
      })
      .catch(err => alert(`Error: ${err.message}`));
  };

  const handleRename = (newName) => {
    if (!renamingFile || !newName || newName === renamingFile.name) {
      setRenamingFile(null);
      return;
    }

    fetch('/api/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: renamingFile.path, newName }),
    })
    .then(res => {
      if (!res.ok) return res.json().then(err => { throw new Error(err.error) });
      loadFiles();
    })
    .catch(err => alert(`Error: ${err.message}`))
    .finally(() => setRenamingFile(null));
  };

  const handleNavigateUp = () => {
    if (currentPath !== initialPath) {
      setCurrentPath(prev => prev.substring(0, prev.lastIndexOf('/')) || initialPath);
    }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Paper sx={{ p: 2, mt: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => window.history.back()}>
          Back
        </Button>
      </Box>
      <Typography variant="h6">File Browser</Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Disk <code>{currentPath}</code></Typography>
        <TextField
          label="Filter"
          variant="outlined"
          size="small"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </Box>

      {loading && <CircularProgress />}
      {error && <Typography color="error">{error}</Typography>}

      {!loading && !error && (
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '50%' }}>
                  <IconButton onClick={handleNavigateUp} disabled={currentPath === initialPath} size="small">
                    <ArrowUpward />
                  </IconButton>
                  Name
                </TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Modified</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFiles.map(f => (
                <TableRow key={f.path}>
                  <TableCell>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', cursor: f.is_dir ? 'pointer' : 'default' }}
                      onClick={() => f.is_dir && setCurrentPath(f.path)}
                    >
                      {f.is_dir ? <Folder sx={{ mr: 1 }} /> : <InsertDriveFile sx={{ mr: 1 }} />}
                      {f.name}
                    </Box>
                  </TableCell>
                  <TableCell>{formatBytes(f.size)}</TableCell>
                  <TableCell>{new Date(f.modified * 1000).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => setRenamingFile(f)}>Rename</Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDelete(f.path)}
                      disabled={f.is_dir && files.some(sub => sub.path.startsWith(f.path + '/'))}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <RenameModal
        open={Boolean(renamingFile)}
        onClose={() => setRenamingFile(null)}
        onRename={handleRename}
        currentName={renamingFile?.name || ''}
      />
    </Paper>
  );
}