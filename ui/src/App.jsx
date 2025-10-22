import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Container, IconButton,
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, CssBaseline,
  useTheme, useMediaQuery, ThemeProvider, createTheme
} from '@mui/material';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorageIcon from '@mui/icons-material/Storage';
import LabelIcon from '@mui/icons-material/Label';
import HistoryIcon from '@mui/icons-material/History';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import logo from './assets/logo.svg';

import '@fontsource/ubuntu/300.css';
import '@fontsource/ubuntu/400.css';
import '@fontsource/ubuntu/500.css';
import '@fontsource/ubuntu/700.css';

import { getDisks, getKeywords } from './api';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Disks from './pages/Disks';
import Keywords from './pages/Keywords';
import Logs from './pages/Logs';
import GettingStarted from './pages/GettingStarted';
import DiskView from './pages/DiskView';
import FileBrowserPage from './pages/FileBrowserPage';
import StatusBar from './components/StatusBar';

const drawerWidth = 240;

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(sessionStorage.getItem('isLoggedIn') === 'true');
  const [mode, setMode] = useState(localStorage.getItem('themeMode') || 'light');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [disks, setDisks] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );

  const getDesignTokens = (mode) => ({
    palette: {
      mode,
      ...(mode === 'light'
        ? {
            // Palette for light mode
            primary: { main: '#1976d2' },
            secondary: { main: '#dc004e' },
            background: {
              default: '#f4f6f8',
              paper: '#ffffff',
            },
          }
        : {
            // Palette for dark mode
            primary: { main: '#90caf9' },
            secondary: { main: '#f48fb1' },
            background: {
              default: '#121212',
              paper: '#1e1e1e',
            },
          }),
    },
    typography: {
      fontFamily: 'Ubuntu, sans-serif',
      h4: { fontWeight: 500 },
      h5: { fontWeight: 500 },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 8, textTransform: 'none' },
        },
      },
    },
  });

  const appTheme = React.useMemo(
    () => createTheme(getDesignTokens(mode)),
    [mode],
  );

  const loadData = useCallback(() => {
    getDisks().then(setDisks).catch(console.error);
    getKeywords().then(setKeywords).catch(console.error);
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn, loadData]);
  useEffect(() => localStorage.setItem('themeMode', mode), [mode]);

  const showGettingStarted = disks.length === 0 || keywords.length === 0;

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
  };

  const handleNavigation = (path) => {
    navigate(path);
  }

  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <Login onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Disks', icon: <StorageIcon />, path: '/disks' },
    { text: 'Keywords', icon: <LabelIcon />, path: '/keywords' },
    { text: 'Run History', icon: <HistoryIcon />, path: '/logs' },
  ];

  const drawerContent = (
    <Box sx={{ width: drawerWidth }} role="presentation">
      <Toolbar />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding component={Link} to={item.path} sx={{ color: 'text.primary' }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => isMobile && setDrawerOpen(false)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box
            component="img"
            src={logo}
            alt="File Organizer Logo"
            sx={{ height: 32, mr: 1.5, display: { xs: 'none', sm: 'block' } }}
          />
          <Typography variant="h6" sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}>
            File Organizer
          </Typography>
          <IconButton sx={{ ml: 1 }} onClick={colorMode.toggleColorMode} color="inherit">
            {appTheme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          <Button color="inherit" onClick={handleLogout}>Logout</Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? drawerOpen : true}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: (theme) => theme.palette.mode === 'dark' ? theme.palette.background.default : theme.palette.background.paper,
          },
        }}
      >
        {drawerContent}
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          pb: 10,
          marginLeft: isMobile ? 0 : `${drawerWidth}px`, // Explicitly set margin based on mobile state
          transition: (theme) => theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar />
        <Routes>
          <Route path="/" element={
            showGettingStarted
              ? <GettingStarted onNavigate={handleNavigation} hasDisks={disks.length > 0} hasKeywords={keywords.length > 0} />
              : <Dashboard disks={disks} onRun={loadData} onNavigate={handleNavigation} />
          } />
          <Route path="/disks" element={<Disks onUpdate={loadData} onNavigate={handleNavigation} />} />
          <Route path="/keywords" element={<Keywords onUpdate={loadData} />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/disk-view/:diskName" element={<DiskView onNavigate={handleNavigation} />} />
          <Route path="/files" element={<FileBrowserPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <StatusBar />
      </Box>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
