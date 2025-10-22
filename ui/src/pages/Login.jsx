import React, { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, Container, Alert, CircularProgress } from '@mui/material';
import Copyright from '../components/Copyright';
import { login } from '../api';
import logo from '../assets/logo.svg';

function Login({ onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(username, password);
            sessionStorage.setItem('isLoggedIn', 'true');
            onLoginSuccess();
        } catch (err) {
            setError(err.message || 'Invalid credentials. Please try again.');
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    minHeight: '100vh',
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                 <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box
                                component="img"
                                src={logo}
                                alt="File Organizer Logo"
                                sx={{ height: 32, mr: 1.5 }}
                            />
                    <Typography component="h1" variant="h5">
                        File Organizer
                    </Typography>
                </Box>
                <Typography component="h2" variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                    Sign In
                </Typography>
                <Card sx={{ mt: 3, width: '100%' }}>
                    <CardContent>
                        <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
                            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="username"
                                label="Username"
                                name="username"
                                autoComplete="username"
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                type="password"
                                id="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
                                {loading ? <CircularProgress size={24} /> : 'Sign In'}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
                <Box sx={{ flexGrow: 1 }} />
                <Copyright sx={{ mt: 8, mb: 4 }} />
            </Box>
        </Container>
    );
}

export default Login;