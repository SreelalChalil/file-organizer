#!/usr/bin/env python3
"""Backend REST API for file-organizer.
Provides JSON REST endpoints only (no HTML/templates).
"""
from flask import Flask, request, jsonify, Response
import hmac, uuid
from flask_cors import CORS
import threading
import logging
import os
from pathlib import Path
import shutil, json
from app.organiser import move_files
from app.db import get_disks, upsert_disk, list_categories, upsert_category, delete_category, delete_disk, update_disk, update_category
import sqlite3
from app.db import init_db, import_from_json
import datetime
import platform
APP_VERSION = "1.1.0"

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
DB_PATH = Path(os.environ.get("CONFIG_DB", "/var/lib/data_organizer/config.db"))
LOG_DIR = Path(os.environ.get("LOG_DIR", "/var/log/data_organizer/"))

# --- Logging Setup ---
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'organize_files.log'),
        logging.StreamHandler() # Also log to stderr
    ]
)
logging.Formatter.formatTime = (lambda self, record, datefmt=None: datetime.datetime.fromtimestamp(record.created, datetime.timezone.utc).astimezone().isoformat())
# --- End Logging Setup ---

# --- App State ---
# Simple in-memory state for tracking background task status.
# For a multi-worker setup, this should be moved to a shared store like Redis.
TASK_LOCK = threading.Lock()
TASK_STATUS = {'status': 'idle', 'disk': None, 'last_run_ts': None, 'last_run_status': None}
# --- End App State ---

app = Flask(__name__)
logger = logging.getLogger() # Use root logger
# Allow CORS for all origins on the API endpoints (can be restricted later)
CORS(app, resources={r"/api/*": {"origins": "*"}, r"/stream_logs": {"origins": "*"}})

# Ensure DB exists on startup
try:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    init_db(DB_PATH, clear_existing=False)
except Exception:
    logger.exception('Unable to ensure DB schema on startup')

def _execute_run(disk_name: str, source_dir: Path, db_path: Path, db_run_id: int, sorted_root: str = None, dry_run: bool = False):
    """
    A shared helper to execute a file organization run, log it, and update status.
    This is used by both manual and scheduled triggers.
    """
    from app.db import update_run_status, get_run

    # Retrieve the log file path from the DB entry
    run_info = get_run(db_path, db_run_id)
    log_file_path = Path(run_info['log_file']) if run_info and run_info.get('log_file') else LOG_DIR / f"run-unknown-{db_run_id}.log"

    # Set up a run-specific logger
    run_logger = logging.getLogger(f"run-{db_run_id}")
    run_logger.setLevel(logging.INFO)
    run_logger.propagate = False
    handler = logging.FileHandler(log_file_path)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    run_logger.addHandler(handler)

    try:
        run_logger.info(f"Starting run for {source_dir} (dry_run={dry_run})")
        moved = move_files(source_dir, db_path, dry_run=dry_run, sorted_root=sorted_root, logger=run_logger)
        run_logger.info(f"Completed run for {source_dir}: moved={moved}")
        update_run_status(db_path, db_run_id, 'success', moved)
        with TASK_LOCK:
            TASK_STATUS['last_run_status'] = 'success'
    except Exception as e:
        run_logger.error(f"Error during run for {source_dir}: {e}", exc_info=True)
        update_run_status(db_path, db_run_id, 'error', 0)
        with TASK_LOCK:
            TASK_STATUS['last_run_status'] = 'error'
    finally:
        with TASK_LOCK:
            TASK_STATUS['status'] = 'idle'
            TASK_STATUS['last_run_ts'] = datetime.datetime.utcnow().isoformat() + 'Z'
        run_logger.removeHandler(handler)
        handler.close()

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json(force=True)
    username = data.get('username', '').strip()
    password = data.get('password', '') # Passwords should not be stripped

    # Use hmac.compare_digest to prevent timing attacks
    is_user_ok = hmac.compare_digest(username, 'admin')
    is_pass_ok = hmac.compare_digest(password, ADMIN_PASSWORD)

    if is_user_ok and is_pass_ok and ADMIN_PASSWORD:
        return jsonify({'status': 'ok'})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/version', methods=['GET'])
def api_version():
    return jsonify({'version': APP_VERSION})

@app.route('/api/host-info', methods=['GET'])
def api_host_info():
    """Returns information about the host OS."""
    info = platform.uname()
    return jsonify({
        'system': info.system,
        'release': info.release,
        'version': info.version,
        'machine': info.machine,
        'hostname': info.node,
    })

@app.route('/api/files', methods=['GET'])
def api_list_files():
    """Lists files in a given directory."""
    path_param = request.args.get('path', '').strip()
    if not path_param:
        return jsonify({'error': 'path parameter is required'}), 400

    # Security: ensure path is within /mnt
    base_path = Path('/mnt').resolve()
    target_path = Path(path_param).resolve()

    if base_path not in target_path.parents and target_path != base_path:
        return jsonify({'error': 'Access denied: path is outside the allowed directory'}), 403

    try:
        files = []
        for entry in os.scandir(target_path):
            if entry.name.startswith('.'):
                continue
            
            item_count = None
            if entry.is_dir():
                try:
                    # Count non-hidden items in the directory. Can be slow on large directories.
                    item_count = len([item for item in os.scandir(entry.path) if not item.name.startswith('.')])
                except (PermissionError, FileNotFoundError):
                    item_count = None # Set to None if we can't access the directory

            files.append({
                'name': entry.name,
                'path': entry.path,
                'is_dir': entry.is_dir(),
                'size': entry.stat().st_size if not entry.is_dir() else None,
                'modified': entry.stat().st_mtime,
                'item_count': item_count,
            })
        return jsonify(files)
    except FileNotFoundError:
        return jsonify({'error': 'Directory not found'}), 404
    except Exception as e:
        logger.error("Failed to list files for %s: %s", target_path, e)
        return jsonify({'error': 'Failed to list files'}), 500

@app.route('/api/files', methods=['PUT'])
def api_rename_file():
    """Renames a file or directory."""
    data = request.get_json(force=True)
    path_param = data.get('path', '').strip()
    new_name = data.get('newName', '').strip()

    if not path_param or not new_name:
        return jsonify({'error': 'path and newName are required'}), 400

    # Security checks
    base_path = Path('/mnt').resolve()
    old_path = Path(path_param).resolve()

    if base_path not in old_path.parents and old_path != base_path:
        return jsonify({'error': 'Access denied: path is outside the allowed directory'}), 403

    if not old_path.exists():
        return jsonify({'error': 'Source path not found'}), 404

    new_path = old_path.parent / new_name
    if base_path not in new_path.parents and new_path != base_path:
        return jsonify({'error': 'Access denied: new path is outside the allowed directory'}), 403

    if new_path.exists():
        return jsonify({'error': 'Destination path already exists'}), 409

    try:
        os.rename(old_path, new_path)
        logger.info("Renamed %s to %s", old_path, new_path)
        return jsonify({'status': 'ok'})
    except Exception as e:
        logger.error("Failed to rename %s: %s", old_path, e, exc_info=True)
        return jsonify({'error': 'Failed to rename'}), 500

@app.route('/api/files', methods=['DELETE'])
def api_delete_file():
    """Deletes a file or an empty directory."""
    path_param = request.args.get('path', '').strip()
    if not path_param:
        return jsonify({'error': 'path parameter is required'}), 400

    # Security: ensure path is within /mnt
    base_path = Path('/mnt').resolve()
    target_path = Path(path_param).resolve()

    if base_path not in target_path.parents and target_path != base_path:
        return jsonify({'error': 'Access denied: path is outside the allowed directory'}), 403

    if not target_path.exists():
        return jsonify({'error': 'File or directory not found'}), 404

    try:
        if target_path.is_dir():
            # Ensure directory is empty before deleting
            if any(target_path.iterdir()):
                return jsonify({'error': 'Directory is not empty'}), 400
            os.rmdir(target_path)
            logger.info("Deleted empty directory: %s", target_path)
        else:
            os.remove(target_path)
            logger.info("Deleted file: %s", target_path)
        return jsonify({'status': 'ok'})
    except PermissionError:
        logger.error("Permission denied trying to delete %s", target_path)
        return jsonify({'error': f'Permission denied: {target_path}'}), 403
    except OSError as e:
        logger.error("OSError trying to delete %s: %s", target_path, e)
        return jsonify({'error': f'OS Error: {e.strerror}'}), 500
    except Exception as e:
        logger.error("Failed to delete %s: %s", target_path, e)
        return jsonify({'error': 'Failed to delete file or directory'}), 500

@app.route('/api/nfo', methods=['GET', 'POST', 'DELETE'])
def api_nfo_handler():
    """Handles GET, POST, and DELETE for .nfo files associated with a media file."""
    base_path = Path('/mnt').resolve()

    if request.method == 'GET':
        path_param = request.args.get('path', '').strip()
        if not path_param:
            return jsonify({'error': 'path parameter is required'}), 400

        media_path = Path(path_param).resolve()
        if base_path not in media_path.parents:
            return jsonify({'error': 'Access denied'}), 403

        nfo_path = media_path.with_suffix('.nfo')
        content = ''
        if nfo_path.exists() and nfo_path.is_file():
            try:
                content = nfo_path.read_text()
            except Exception as e:
                return jsonify({'error': f'Failed to read NFO file: {e}'}), 500
        return jsonify({'content': content})

    elif request.method == 'POST':
        data = request.get_json(force=True)
        path_param = data.get('path', '').strip()
        content = data.get('content', '')

        media_path = Path(path_param).resolve()
        if base_path not in media_path.parents:
            return jsonify({'error': 'Access denied'}), 403

        nfo_path = media_path.with_suffix('.nfo')
        try:
            nfo_path.write_text(content)
            logger.info("Wrote NFO file for %s", media_path)
            return jsonify({'status': 'ok'})
        except Exception as e:
            return jsonify({'error': f'Failed to write NFO file: {e}'}), 500

    elif request.method == 'DELETE':
        path_param = request.args.get('path', '').strip()
        media_path = Path(path_param).resolve()
        if base_path not in media_path.parents:
            return jsonify({'error': 'Access denied'}), 403

        nfo_path = media_path.with_suffix('.nfo')
        if nfo_path.exists() and nfo_path.is_file():
            try:
                nfo_path.unlink()
                logger.info("Deleted NFO file for %s", media_path)
            except Exception as e:
                return jsonify({'error': f'Failed to delete NFO file: {e}'}), 500
        return jsonify({'status': 'ok'})

@app.route('/api/disks', methods=['GET'])
def api_list_disks():
    try:
        disks_data = get_disks(DB_PATH)
        for disk in disks_data:
            disk['usage'] = {}
            for key, path in [('source', disk['source_dir']), ('sorted', disk['sorted_dir'])]:
                try:
                    if not path:
                        disk['usage'][key] = {'error': 'Path not configured'}
                        continue
                    usage = shutil.disk_usage(path)
                    disk['usage'][key] = {
                        'total': usage.total,
                        'used': usage.used,
                        'free': usage.free,
                    }
                except FileNotFoundError:
                    disk['usage'][key] = {'error': 'Path not found'}
                except Exception as e:
                    disk['usage'][key] = {'error': str(e)}
    except sqlite3.OperationalError:
        return jsonify([])
    return jsonify(disks_data)

@app.route('/api/validate-path', methods=['GET'])
def api_validate_path():
    """Validates a given path and returns its status."""
    path_param = request.args.get('path', '').strip()
    if not path_param:
        return jsonify({'error': 'path parameter is required'}), 400

    p = Path(path_param)

    if not p.exists():
        return jsonify({'status': 'error', 'message': 'Path does not exist.'})

    if not p.is_dir():
        return jsonify({'status': 'error', 'message': 'Path is not a directory.'})

    is_readable = os.access(p, os.R_OK)
    is_writable = os.access(p, os.W_OK)

    if not is_readable or not is_writable:
        reason = []
        if not is_readable: reason.append("readable")
        if not is_writable: reason.append("writable")
        return jsonify({'status': 'error', 'message': f"Path is not {' and '.join(reason)}."})

    # All checks passed
    return jsonify({'status': 'ok', 'message': 'Path is valid and accessible.'})


def _validate_disk_paths(paths: list[str]) -> tuple[Response, int] | None:
    """Helper to validate a list of directory paths for disk configuration."""
    for p_str in paths:
        if not p_str:
            continue
        p = Path(p_str)
        if not p.exists():
            logger.error(f"Path validation failed for '{p_str}': Path does not exist.")
            return jsonify({'error': f'Path does not exist: {p_str}'}), 400
        if not p.is_dir():
            logger.error(f"Path validation failed for '{p_str}': Path is not a directory.")
            return jsonify({'error': f'Path is not a directory: {p_str}'}), 400

        is_readable = os.access(p, os.R_OK)
        is_writable = os.access(p, os.W_OK)
        if not is_readable or not is_writable:
            reason = [part for cond, part in [(not is_readable, "readable"), (not is_writable, "writable")] if cond]
            logger.error(f"Path validation failed for '{p_str}': Path is not {' and '.join(reason)}.")
            return jsonify({'error': f'Path is not readable/writable: {p_str}'}), 403
    return None

@app.route('/api/disks', methods=['POST'])
def api_add_disk():
    data = request.get_json(force=True)
    name = data.get('name', '').strip()
    source = data.get('source', '').strip()
    sorted_dir = data.get('sorted', '').strip()

    validation_error = _validate_disk_paths([source, sorted_dir])
    if validation_error:
        return validation_error

    try:
        upsert_disk(DB_PATH, name, source, sorted_dir, None)
    except ValueError as e:
        return jsonify({'error': f'Invalid schedule format: {e}'}), 400
    except sqlite3.OperationalError:
        return jsonify({'error': 'DB not initialized'}), 503
    return jsonify({'status': 'ok'})

@app.route('/api/disks/<name>', methods=['PUT'])
def api_update_disk(name):
    data = request.get_json(force=True)
    source = data.get('source', '').strip()
    sorted_dir = data.get('sorted', '').strip()

    validation_error = _validate_disk_paths([source, sorted_dir])
    if validation_error:
        return validation_error

    try:
        update_disk(DB_PATH, name, source, sorted_dir, None)
    except ValueError as e:
        return jsonify({'error': f'Invalid schedule format: {e}'}), 400
    except sqlite3.OperationalError:
        return jsonify({'error': 'DB not initialized'}), 503
    return jsonify({'status': 'ok'})

@app.route('/api/disks/<name>', methods=['DELETE'])
def api_delete_disk(name):
    try:
        delete_disk(DB_PATH, name)
    except sqlite3.OperationalError:
        return jsonify({'error': 'DB not initialized'}), 503
    return jsonify({'status': 'ok'})

@app.route('/api/keywords', methods=['GET'])
def api_get_keywords():
    try:
        cats = list_categories(DB_PATH)
    except sqlite3.OperationalError:
        cats = []
    return jsonify(cats)

@app.route('/api/keywords', methods=['POST'])
def api_upsert_keyword():
    data = request.get_json(force=True)
    name = data.get('name', '').strip()
    priority = int(data.get('priority', 0))
    target = data.get('target', '').strip()
    keywords = [kw.strip() for kw in data.get('keywords', []) if kw.strip()]
    try:
        upsert_category(DB_PATH, name, priority, target, keywords)
    except sqlite3.OperationalError:
        return jsonify({'error': 'DB not initialized'}), 503
    return jsonify({'status': 'ok'})

@app.route('/api/keywords/<name>', methods=['DELETE'])
def api_delete_keyword(name):
    try:
        ok = delete_category(DB_PATH, name)
    except sqlite3.OperationalError:
        return jsonify({'error': 'DB not initialized'}), 503
    if ok:
        return jsonify({'status': 'ok'})
    return jsonify({'error': 'not found'}), 404

@app.route('/api/keywords/export', methods=['GET'])
def api_export_keywords():
    """Exports all keyword categories as a JSON file."""
    try:
        cats = list_categories(DB_PATH)
        # Create a filename with a timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"file-organizer-keywords-{timestamp}.json"
        return Response(
            json.dumps(cats, indent=2),
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment;filename={filename}'}
        )
    except Exception as e:
        logger.error("Failed to export keywords: %s", e, exc_info=True)
        return jsonify({'error': 'Failed to export keywords'}), 500

@app.route('/api/keywords/import', methods=['POST'])
def api_import_keywords():
    """Imports keyword categories from an uploaded JSON file.
    Mode 'replace' (default) overwrites all existing rules.
    Mode 'merge' adds new rules and updates existing ones by name.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    mode = request.args.get('mode', 'merge') # Default to safe merge
    data = json.load(file)

    if mode == 'merge':
        from app.db import merge_categories_from_data
        merge_categories_from_data(DB_PATH, data)
    else: # Allow explicit 'replace'
        from app.db import replace_all_categories
        replace_all_categories(DB_PATH, data)
    return jsonify({'status': 'ok'})

@app.route('/api/cleanup-empty-dirs', methods=['POST'])
def api_cleanup_empty_dirs():
    """Deletes a list of directories if they are empty."""
    data = request.get_json(force=True)
    dir_paths = data.get('paths', [])
    if not dir_paths:
        return jsonify({'error': 'No paths provided'}), 400

    # Security: ensure all paths are within /mnt
    base_path = Path('/mnt').resolve()
    for path_str in dir_paths:
        target_path = Path(path_str).resolve()
        if base_path not in target_path.parents and target_path != base_path:
            return jsonify({'error': f'Access denied: {path_str}'}), 403

    from app.organiser import delete_empty_dirs
    result = delete_empty_dirs(dir_paths)
    return jsonify(result)

@app.route('/api/disks/<name>/empty-dirs', methods=['GET'])
def api_get_empty_dirs(name):
    """Finds all empty subdirectories for a given disk."""
    disks = get_disks(DB_PATH)
    match = [d for d in disks if d['name'] == name]
    if not match:
        return jsonify({'error': 'disk not found'}), 404

    disk = match[0]
    source_dir = disk.get('source_dir')
    sorted_dir = disk.get('sorted_dir')

    empty_dirs = []
    from app.organiser import find_empty_dirs

    if source_dir and Path(source_dir).exists():
        empty_dirs.extend(find_empty_dirs(Path(source_dir)))
    if sorted_dir and Path(sorted_dir).exists():
        empty_dirs.extend(find_empty_dirs(Path(sorted_dir)))

    return jsonify(sorted(list(set(empty_dirs))))


@app.route('/api/run', methods=['POST'])
def api_run():
    data = request.get_json(force=True)

    if not isinstance(data, dict):
        logger.error(f"Received non-dict data for /api/run: {data}")
        return jsonify({'error': 'Invalid JSON payload. Expected an object.'}), 400

    disk = data.get('disk', '').strip()
    source = data.get('source', '').strip()
    dry_run = bool(data.get('dry_run', False)) # No trim needed for boolean

    if disk:
        sorted_root = None
        disks = get_disks(DB_PATH)
        match = [d for d in disks if d['name'] == disk]
        if not match:
            return jsonify({'error': 'disk not found'}), 404
        source = match[0]['source_dir']
        sorted_root = match[0]['sorted_dir']

    if not source:
        return jsonify({'error': 'source required'}), 400

    with TASK_LOCK:
        if TASK_STATUS['status'] == 'running':
            return jsonify({'error': 'A run is already in progress'}), 409 # Conflict
        TASK_STATUS['status'] = 'running'
        TASK_STATUS['disk'] = disk or 'Custom Run'

    # Create run entry first to get db_run_id
    from app.db import create_run, update_run_status
    run_id_str = str(uuid.uuid4())
    log_file_path = LOG_DIR / f"run-{TASK_STATUS['disk'].replace(' ', '_')}-{run_id_str[:8]}.log"
    db_run_id = create_run(DB_PATH, TASK_STATUS['disk'], source, str(log_file_path))

    # Use the shared execution function in a background thread
    thread = threading.Thread(target=_execute_run, 
                              args=(TASK_STATUS['disk'], Path(source), DB_PATH, db_run_id, sorted_root, dry_run), 
                              daemon=True)
    thread.start()

    return jsonify({'status': 'started', 'run_id': db_run_id})

@app.route('/api/status', methods=['GET'])
def api_status():
    with TASK_LOCK:
        return jsonify(TASK_STATUS)

@app.route('/api/runs', methods=['GET'])
def api_get_runs():
    from app.db import list_runs
    runs = list_runs(DB_PATH)
    return jsonify(runs)

@app.route('/api/runs/<int:run_id>', methods=['GET'])
def api_get_run_log(run_id):
    from app.db import get_run
    run_info = get_run(DB_PATH, run_id)
    if not run_info or not run_info.get('log_file'):
        return jsonify({'error': 'not found'}), 404
    log_path = Path(run_info['log_file'])
    if not log_path.exists():
        return jsonify({'error': 'log file not found'}), 404

    def generate_log_chunks():
        """Streams the log file chunk by chunk to avoid high memory usage."""
        try:
            with open(log_path, 'rb') as f:
                while chunk := f.read(4096):
                    yield chunk
        except Exception as e:
            logger.error("Failed to stream log file %s: %s", log_path, e)
    return Response(generate_log_chunks(), mimetype='text/plain')

@app.route('/stream_run_logs/<int:run_id>')
def stream_run_logs(run_id):
    from app.db import get_run
    run_info = get_run(DB_PATH, run_id)
    if not run_info or not run_info.get('log_file'):
        return Response("data: Run not found or log file not specified.\n\n", mimetype='text/event-stream')

    log_path = Path(run_info['log_file'])

    def event_stream():
        import time
        # Wait for log file to be created
        for _ in range(10): # Wait up to 2 seconds
            if log_path.exists(): break
            time.sleep(0.2)

        if not log_path.exists():
            yield "data: ERROR: Log file was not created in time.\n\n"
            yield "data: [STREAM_END]\n\n"
            return

        with open(log_path, 'r') as f:
            while True:
                line = f.readline()
                if not line:
                    # Check if run is still active before sleeping
                    current_run_status = get_run(DB_PATH, run_id) # This re-queries the DB
                    if current_run_status and current_run_status['status'] != 'running':
                        yield "data: [STREAM_END]\n\n"
                        break
                    time.sleep(0.5)
                    continue
                yield f"data: {line.strip()}\n\n"
    return Response(event_stream(), mimetype='text/event-stream')

@app.route('/stream_logs')
def stream_logs():
    def event_stream():
        import time
        # Continuously tail the log file
        try:
            with open(LOG_DIR / 'organize_files.log', 'r') as f:
                f.seek(0, 2)
                while True:
                    line = f.readline()
                    if not line:
                        time.sleep(0.2)
                        continue
                    yield f"data: {line.strip()}\n\n"
        except Exception as e:
            logger.error("Log streaming failed: %s", e)
    return Response(event_stream(), mimetype='text/event-stream')

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    app.run(host='0.0.0.0', port=8080)
