/**
 * Centralized API client for the File Organizer app.
 */

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown network error occurred' }));
    throw new Error(errorData.error || 'Request failed');
  }
  return response.json();
}

export async function getDisks() {
  const response = await fetch('/api/disks');
  return handleResponse(response);
}

export async function getKeywords() {
  const response = await fetch('/api/keywords');
  return handleResponse(response);
}

export async function runOrganizerTask(payload) {
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

// Alias to handle potential typos in consuming components
export { runOrganizerTask as runOrganization };

export async function getDiskEmptyDirs(diskName) {
  const response = await fetch(`/api/disks/${encodeURIComponent(diskName)}/empty-dirs`);
  return handleResponse(response);
}

export async function login(username, password) {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(response);
}

export async function cleanupEmptyDirs(paths) {
  const response = await fetch('/api/cleanup-empty-dirs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paths }),
  });
  return handleResponse(response);
}

export async function renameFile(path, newName) {
  const response = await fetch('/api/files', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, newName }),
  });
  return handleResponse(response);
}

export async function deleteFile(path) {
  const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

export async function getFiles(path) {
  const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
  return handleResponse(response);
}

export async function getNfo(path) {
  const response = await fetch(`/api/nfo?path=${encodeURIComponent(path)}`);
  return handleResponse(response);
}

export async function saveNfo(path, content) {
  const response = await fetch('/api/nfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  return handleResponse(response);
}

export async function deleteNfo(path) {
  const response = await fetch(`/api/nfo?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}