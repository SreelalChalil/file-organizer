import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, Container,
  TableRow, TextField, Typography, Chip, IconButton, Menu, MenuItem, Snackbar, Alert,
  TableSortLabel
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

function KeywordFormModal({ open, onClose, onSave, category }) {
  const [form, setForm] = useState({ name: '', priority: 0, target: '', keywords: '' });

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        priority: category.priority,
        target: category.target_dir,
        keywords: category.keywords.join(', ')
      });
    } else {
      setForm({ name: '', priority: 0, target: '', keywords: '' });
    }
  }, [category, open]);

  const handleSave = () => {
    const kws = form.keywords.split(',').map(s => s.trim()).filter(Boolean);
    onSave({ ...form, keywords: kws });
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{category ? 'Edit Category' : 'Add New Category'}</DialogTitle>
      <DialogContent>
        <TextField autoFocus margin="dense" label="Category Name" fullWidth variant="standard" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField margin="dense" label="Priority" type="number" fullWidth variant="standard" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value || '0', 10) })} />
        <TextField margin="dense" label="Target Directory" fullWidth variant="standard" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
        <TextField margin="dense" label="Keywords (comma-separated)" fullWidth variant="standard" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Keywords({ onUpdate }) {
  const [cats, setCats] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [filter, setFilter] = useState('');
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('priority');
  const [menuTargetCategory, setMenuTargetCategory] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const fileInputRef = useRef(null);

  const loadKeywords = () => {
    fetch('/api/keywords')
      .then(res => res.json())
      .then(data => setCats(data))
      .catch(console.error);
  };

  useEffect(loadKeywords, []);

  const handleSave = (formData) => {
    fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    }).then(() => {
      setModalOpen(false);
      setEditingCategory(null);
      loadKeywords();
      onUpdate(); // Notify App.jsx
    });
  };

  const handleDelete = (name) => {
    if (!window.confirm(`Are you sure you want to delete the category "${name}"?`)) return;
    fetch(`/api/keywords/${encodeURIComponent(name)}`, { method: 'DELETE' })
      .then(() => {
        loadKeywords();
        onUpdate();
      });
  };

  const handleMenuOpen = (event, category) => {
    setAnchorEl(event.currentTarget);
    setMenuTargetCategory(category);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuTargetCategory(null);
  };

  const handleEditClick = () => {
    setEditingCategory(menuTargetCategory);
    setModalOpen(true);
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    handleDelete(menuTargetCategory.name);
    handleMenuClose();
  };

  const handleExport = () => {
    fetch('/api/keywords/export')
      .then(res => {
        const header = res.headers.get('Content-Disposition');
        const parts = header.split(';');
        const filename = parts[1].split('=')[1];
        return res.blob().then(blob => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => setSnackbar({ open: true, message: `Export failed: ${err.message}`, severity: 'error' }));
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!window.confirm('Are you sure you want to import this file? This will add new rules and update existing ones by name.')) return;

    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/keywords/import?mode=merge', { method: 'POST', body: formData })
      .then(() => {
        loadKeywords();
        onUpdate();
      });
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const headCells = [
    { id: 'name', label: 'Rule Name' },
    { id: 'priority', label: 'Priority' },
    { id: 'target_dir', label: 'Target Directory' },
    { id: 'keywords', label: 'Keywords', disableSorting: true },
    { id: 'actions', label: 'Actions', disableSorting: true },
  ];

  function descendingComparator(a, b, orderBy) {
    if (b[orderBy] < a[orderBy]) return -1;
    if (b[orderBy] > a[orderBy]) return 1;
    return 0;
  }

  function getComparator(order, orderBy) {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  }

  const sortedAndFilteredCats = React.useMemo(() => {
    const filtered = cats.filter(c =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.target_dir.toLowerCase().includes(filter.toLowerCase()) ||
      c.keywords.some(kw => kw.toLowerCase().includes(filter.toLowerCase()))
    );
    return filtered.sort(getComparator(order, orderBy));
  }, [cats, filter, order, orderBy]);

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
        <Typography variant="h4">Manage File Categories</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Filter rules..."
            variant="outlined"
            size="small"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button variant="contained" onClick={() => { setEditingCategory(null); setModalOpen(true); }}>
            Add Category
          </Button>
          <Button variant="outlined" onClick={handleExport}>Export to JSON</Button>
          <Button variant="outlined" component="label">
            Import from JSON
            <input type="file" hidden accept=".json" onChange={handleImport} ref={fileInputRef} onClick={(e) => e.target.value = null} />
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 250px)' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {headCells.map((headCell) => (
                <TableCell
                  key={headCell.id}
                  sortDirection={orderBy === headCell.id ? order : false}
                >
                  {headCell.disableSorting ? headCell.label : (
                    <TableSortLabel
                      active={orderBy === headCell.id}
                      direction={orderBy === headCell.id ? order : 'asc'}
                      onClick={() => handleRequestSort(headCell.id)}
                    >
                      {headCell.label}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedAndFilteredCats.map(c => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.priority}</TableCell>
                <TableCell>{c.target_dir}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {c.keywords.map(kw => <Chip key={kw} label={kw} size="small" />)}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    aria-label="more"
                    aria-controls="long-menu"
                    aria-haspopup="true"
                    onClick={(e) => handleMenuOpen(e, c)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditClick}>Edit</MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          Delete
        </MenuItem>
      </Menu>

      <KeywordFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        category={editingCategory}
      />
    </Container>
  );
}