import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Button,
  Container,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Grid,
  TextField,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { runOrganizerTask, renameFile, deleteFile, getFiles, getNfo, saveNfo, deleteNfo } from '../api';

function NfoEditorModal({ file, open, onClose, onSave, onDelete }) {
  const [movieData, setMovieData] = useState({
    title: '', year: '', studio: '', tagline: '', plot: '', actors: [],
  });
  const [loading, setLoading] = useState(true);

  const parseNfo = useCallback((xmlString) => {
    const initialData = {
      title: file?.name.split('.').slice(0, -1).join('.') || '',
      year: '', studio: '', tagline: '', plot: '', actors: [],
    };
    if (!xmlString) return initialData;

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");
      const movieNode = xmlDoc.querySelector('movie');
      if (!movieNode) return initialData;

      const getText = (selector) => movieNode.querySelector(selector)?.textContent || '';
      const actors = Array.from(movieNode.querySelectorAll('actor')).map(actorNode => ({
        name: actorNode.querySelector('name')?.textContent || '',
        role: actorNode.querySelector('role')?.textContent || '',
      }));

      return {
        title: getText('title'), year: getText('year'), studio: getText('studio'),
        tagline: getText('tagline'), plot: getText('plot'), actors,
      };
    } catch (e) {
      console.error("Error parsing NFO XML:", e);
      return initialData; // Return default on parse error
    }
  }, [file]);

  const serializeNfo = (data) => {
    const doc = document.implementation.createDocument(null, "movie", null);
    const movieEl = doc.documentElement;

    const createTextElement = (name, text) => {
      if (text) {
        const el = doc.createElement(name);
        el.textContent = text;
        movieEl.appendChild(el);
      }
    };

    createTextElement('title', data.title);
    createTextElement('year', data.year);
    createTextElement('studio', data.studio);
    createTextElement('tagline', data.tagline);
    createTextElement('plot', data.plot);

    data.actors.forEach(actor => {
      const actorEl = doc.createElement('actor');
      createTextElement('name', actor.name);
      createTextElement('role', actor.role);
      // Manually append inside actor element
      actorEl.innerHTML = (actor.name ? `<name>${actor.name}</name>` : '') + (actor.role ? `<role>${actor.role}</role>` : '');
      movieEl.appendChild(actorEl);
    });

    const serializer = new XMLSerializer();
    const xmlString = serializer.serializeToString(doc);
    // Basic pretty printing
    return xmlString.replace(/></g, '>\n  <').replace(/<\/[^>]+>/g, '$&\n');
  };

  useEffect(() => {
    if (open && file) {
      setLoading(true);
      getNfo(file.path)
        .then(data => setMovieData(parseNfo(data.content)))
        .catch(err => console.error("Failed to load NFO", err))
        .finally(() => setLoading(false));
    }
  }, [open, file, parseNfo]);

  const handleFieldChange = (field, value) => setMovieData(prev => ({ ...prev, [field]: value }));

  const handleActorChange = (index, field, value) => {
    const newActors = [...movieData.actors];
    newActors[index][field] = value;
    setMovieData(prev => ({ ...prev, actors: newActors }));
  };

  const addActor = () => setMovieData(prev => ({ ...prev, actors: [...prev.actors, { name: '', role: '' }] }));
  const removeActor = (index) => setMovieData(prev => ({ ...prev, actors: prev.actors.filter((_, i) => i !== index) }));

  const handleSave = () => {
    const xmlContent = serializeNfo(movieData);
    onSave(file.path, xmlContent);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>NFO Editor for {file?.name}</DialogTitle>
      <DialogContent>
        {loading ? <CircularProgress /> : (
          <Box component="form" noValidate autoComplete="off">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}><TextField label="Title" value={movieData.title} onChange={(e) => handleFieldChange('title', e.target.value)} fullWidth /></Grid>
              <Grid item xs={12} sm={4}><TextField label="Year" value={movieData.year} onChange={(e) => handleFieldChange('year', e.target.value)} fullWidth /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Studio" value={movieData.studio} onChange={(e) => handleFieldChange('studio', e.target.value)} fullWidth /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Tagline" value={movieData.tagline} onChange={(e) => handleFieldChange('tagline', e.target.value)} fullWidth /></Grid>
              <Grid item xs={12}><TextField label="Plot" value={movieData.plot} onChange={(e) => handleFieldChange('plot', e.target.value)} fullWidth multiline rows={4} /></Grid>
            </Grid>
            <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Actors</Typography>
            {movieData.actors.map((actor, index) => (
              <Grid container spacing={1} key={index} sx={{ mb: 1, alignItems: 'center' }}>
                <Grid item xs={5}><TextField size="small" label="Actor Name" value={actor.name} onChange={(e) => handleActorChange(index, 'name', e.target.value)} fullWidth /></Grid>
                <Grid item xs={5}><TextField size="small" label="Role" value={actor.role} onChange={(e) => handleActorChange(index, 'role', e.target.value)} fullWidth /></Grid>
                <Grid item xs={2}><IconButton onClick={() => removeActor(index)}><DeleteIcon /></IconButton></Grid>
              </Grid>
            ))}
            <Button startIcon={<AddIcon />} onClick={addActor} sx={{ mt: 1 }}>Add Actor</Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onDelete(file.path)} color="error">Delete NFO</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function FileBrowserPage() {
  const query = useQuery();
  const initialPath = query.get('path') || '/mnt';

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [runStatus, setRunStatus] = useState({ loading: false, error: '' });
  const [contextMenu, setContextMenu] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [nfoTarget, setNfoTarget] = useState(null);

  const fetchFiles = useCallback(() => {
    setLoading(true);
    setError('');
    getFiles(currentPath)
      .then(data => {
        // Sort folders first, then files, all alphabetically
        data.sort((a, b) => {
          if (a.is_dir && !b.is_dir) return -1;
          if (!a.is_dir && b.is_dir) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentPath]);

  useEffect(fetchFiles, [fetchFiles]);

  const handleItemClick = (item) => {
    if (item.is_dir) {
      setCurrentPath(item.path);
    }
  };

  const handleContextMenu = (event, file) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? { mouseX: event.clientX + 2, mouseY: event.clientY - 6, file }
        : null,
    );
  };

  const handleCloseContextMenu = () => setContextMenu(null);

  const handleRename = (newName) => {
    if (!renameTarget || !newName || newName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    renameFile(renameTarget.path, newName)
      .then(() => {
        setSnackbar({ open: true, message: 'Renamed successfully!', severity: 'success' });
        fetchFiles();
      })
      .catch(err => setSnackbar({ open: true, message: `Rename failed: ${err.message}`, severity: 'error' }))
      .finally(() => setRenameTarget(null));
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteFile(deleteTarget.path)
      .then(() => {
        setSnackbar({ open: true, message: 'Deleted successfully!', severity: 'success' });
        fetchFiles();
      })
      .catch(err => setSnackbar({ open: true, message: `Delete failed: ${err.message}`, severity: 'error' }))
      .finally(() => setDeleteTarget(null));
  };

  const handleOpenRename = () => {
    setRenameTarget(contextMenu.file);
    handleCloseContextMenu();
  };

  const handleOpenDelete = () => {
    setDeleteTarget(contextMenu.file);
    handleCloseContextMenu();
  };

  const handleOpenNfoEditor = () => {
    setNfoTarget(contextMenu.file);
    handleCloseContextMenu();
  };

  const handleSaveNfo = (path, content) => {
    saveNfo(path, content)
      .then(() => setSnackbar({ open: true, message: 'NFO file saved.', severity: 'success' }))
      .catch(err => setSnackbar({ open: true, message: `Failed to save NFO: ${err.message}`, severity: 'error' }))
      .finally(() => setNfoTarget(null));
  };

  const handleDeleteNfo = (path) => {
    if (window.confirm('Are you sure you want to delete the NFO file for this item?')) {
      deleteNfo(path)
        .then(() => setSnackbar({ open: true, message: 'NFO file deleted.', severity: 'success' }))
        .catch(err => setSnackbar({ open: true, message: `Failed to delete NFO: ${err.message}`, severity: 'error' }))
        .finally(() => setNfoTarget(null));
    }
  };

  const handleRunOrganizer = () => {
    setRunStatus({ loading: true, error: '' });
    runOrganizerTask({ source: currentPath, dry_run: false })
      .then(response => {
        setSnackbar({
          open: true,
          message: `Organizer task started for ${currentPath}. Run ID: ${response.run_id}`,
          severity: 'info'
        });
      })
      .catch(err => setRunStatus({ loading: false, error: err.message }))
      .finally(() => setRunStatus({ loading: false }));
  };

  const renderBreadcrumbs = () => {
    const pathParts = currentPath.split('/').filter(p => p);
    let cumulativePath = '';

    return (
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          href="#"
          onClick={(e) => { e.preventDefault(); setCurrentPath('/mnt'); }}
        >
          /mnt
        </Link>
        {pathParts.slice(1).map((part, index) => {
          cumulativePath += `/${part}`;
          const isLast = index === pathParts.length - 2;
          const path = `/mnt${cumulativePath}`;
          return isLast ? (
            <Typography key={path} color="text.primary">{part}</Typography>
          ) : (
            <Link
              underline="hover"
              color="inherit"
              href="#"
              key={path}
              onClick={(e) => { e.preventDefault(); setCurrentPath(path); }}
            >
              {part}
            </Link>
          );
        })}
      </Breadcrumbs>
    );
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">File Browser</Typography>
        <Button
          variant="outlined"
          startIcon={runStatus.loading ? <CircularProgress size={20} /> : <PlayCircleOutlineIcon />}
          onClick={handleRunOrganizer}
          disabled={runStatus.loading || loading}
        >
          Run Organizer Here
        </Button>
      </Box>

      {renderBreadcrumbs()}

      <Paper sx={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : (
          <List disablePadding>
            {currentPath !== '/mnt' && (
              <>
                <ListItemButton onClick={() => setCurrentPath(currentPath.substring(0, currentPath.lastIndexOf('/')) || '/mnt')}>
                  <ListItemIcon><FolderIcon /></ListItemIcon>
                  <ListItemText primary="..." />
                </ListItemButton>
                <Divider />
              </>
            )}
            {files.map(file => (
              <ListItem key={file.name} disablePadding>
                <ListItemButton onClick={() => handleItemClick(file)} onContextMenu={(e) => handleContextMenu(e, file)} dense>
                  <ListItemIcon>
                    {file.is_dir ? <FolderIcon /> : <InsertDriveFileIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={
                      file.is_dir
                        ? `${file.item_count === null ? '?' : file.item_count} items`
                        : `${(file.size / 1024).toFixed(2)} KB`
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {files.length === 0 && currentPath === '/mnt' && (
               <ListItem><ListItemText primary="No files or folders found in /mnt." sx={{textAlign: 'center', color: 'text.secondary'}} /></ListItem>
            )}
          </List>
        )}
      </Paper>
      {runStatus.error && <Alert severity="error" sx={{ mt: 2 }}>{`Run failed: ${runStatus.error}`}</Alert>}

      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={handleOpenRename}>Rename</MenuItem>
        <MenuItem onClick={handleOpenDelete} sx={{ color: 'error.main' }}>Delete</MenuItem>
        {!contextMenu?.file?.is_dir && <MenuItem onClick={handleOpenNfoEditor}>Manage NFO</MenuItem>}
      </Menu>

      <Dialog open={!!renameTarget} onClose={() => setRenameTarget(null)} >
        <DialogTitle>Rename</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Enter a new name for "{renameTarget?.name}".
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            defaultValue={renameTarget?.name}
            fullWidth
            variant="standard"
            onKeyDown={(e) => e.key === 'Enter' && handleRename(e.target.value)}
            id="rename-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)}>Cancel</Button>
          <Button onClick={() => handleRename(document.getElementById('rename-input').value)}>Rename</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <NfoEditorModal
        file={nfoTarget}
        open={!!nfoTarget}
        onClose={() => setNfoTarget(null)}
        onSave={handleSaveNfo}
        onDelete={handleDeleteNfo}
      />
    </Container>
  );
}

export default FileBrowserPage;