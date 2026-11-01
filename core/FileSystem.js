/**
 * core/FileSystem.js
 * In-memory Virtual File System (VFS) simulating classic OS concepts:
 * - Inodes with metadata (size, timestamps, permissions, owner)
 * - Open File Table & File Descriptors (fd)
 * - Hierarchical Directory Tree
 * - System call operations: create, delete, open, close, read, write, append, rename, move, copy, chmod
 * - Audit log of system calls for educational inspection
 */

class Inode {
  constructor(id, name, type, parentId = null, permissions = 0o755, owner = 'user') {
    this.id = id;
    this.name = name;
    this.type = type; // 'file' | 'directory'
    this.parentId = parentId;
    this.size = 0; // in bytes
    this.content = type === 'file' ? '' : null;
    this.createdAt = new Date().toISOString();
    this.modifiedAt = new Date().toISOString();
    this.permissions = permissions; // octal e.g. 0o755 or 0o644
    this.owner = owner;
    this.children = type === 'directory' ? [] : undefined; // array of child inode IDs
    this.allocatedBlocks = []; // References to simulated disk blocks
  }

  getPermissionString() {
    const perm = this.permissions;
    const rwx = (p) => {
      let str = '';
      str += (p & 4) ? 'r' : '-';
      str += (p & 2) ? 'w' : '-';
      str += (p & 1) ? 'x' : '-';
      return str;
    };
    const user = rwx((perm >> 6) & 7);
    const group = rwx((perm >> 3) & 7);
    const others = rwx(perm & 7);
    const prefix = this.type === 'directory' ? 'd' : '-';
    return `${prefix}${user}${group}${others}`;
  }
}

class FileSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.inodes = new Map();
    this.nextInodeId = 1;
    this.openFileTable = new Map(); // fd -> { fd, inodeId, mode, cursor, openedAt }
    this.nextFd = 100;
    this.operationLogs = [];

    // Create Root Directory "/"
    const root = new Inode(0, '/', 'directory', null, 0o755, 'root');
    this.inodes.set(0, root);

    // Initialize with a few realistic starter directories & files
    this.initDefaultStructure();

    this.log('FS_INIT', '/', 'SUCCESS', 'Virtual File System initialized with root directory /');
  }

  initDefaultStructure() {
    this.mkdir('/home');
    this.mkdir('/home/user');
    this.mkdir('/home/user/documents');
    this.mkdir('/etc');
    this.createFile('/home/user/welcome.txt', 'Welcome to the Mini File System & Disk Scheduling Simulator!\nThis platform demonstrates core OS concepts interactively.', 0o644);
    this.createFile('/home/user/documents/notes.txt', 'Operating Systems PBL - File System and Disk Scheduling project.\nFeatures:\n- Contiguous, Linked, and Indexed block allocation.\n- FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK schedulers.', 0o644);
    this.createFile('/etc/config.json', '{\n  "version": "1.0.0",\n  "blockSize": 512,\n  "diskSize": 65536\n}', 0o600);
  }

  log(operation, path, status, message, details = {}) {
    const entry = {
      id: this.operationLogs.length + 1,
      timestamp: new Date().toLocaleTimeString(),
      operation,
      path,
      status, // 'SUCCESS' | 'ERROR' | 'WARNING'
      message,
      details
    };
    this.operationLogs.unshift(entry);
    if (this.operationLogs.length > 200) {
      this.operationLogs.pop();
    }
    return entry;
  }

  // Normalize path string: '/home/user/../user/welcome.txt' -> '/home/user/welcome.txt'
  normalizePath(pathStr) {
    if (!pathStr || pathStr.trim() === '') return '/';
    const parts = pathStr.split('/').filter(p => p.length > 0);
    const resolved = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (resolved.length > 0) resolved.pop();
      } else {
        resolved.push(part);
      }
    }
    return '/' + resolved.join('/');
  }

  // Resolve path to Inode
  resolvePath(pathStr) {
    const norm = this.normalizePath(pathStr);
    if (norm === '/') return this.inodes.get(0);

    const parts = norm.slice(1).split('/');
    let current = this.inodes.get(0);

    for (const part of parts) {
      if (current.type !== 'directory') return null;
      let foundChildId = current.children.find(cid => {
        const child = this.inodes.get(cid);
        return child && child.name === part;
      });

      if (foundChildId === undefined) return null;
      current = this.inodes.get(foundChildId);
      if (!current) return null;
    }

    return current;
  }

  // Get full path for an inode
  getPath(inodeId) {
    if (inodeId === 0) return '/';
    const inode = this.inodes.get(inodeId);
    if (!inode) return null;

    const segments = [];
    let curr = inode;
    while (curr && curr.id !== 0) {
      segments.unshift(curr.name);
      curr = this.inodes.get(curr.parentId);
    }
    return '/' + segments.join('/');
  }

  // System call: mkdir
  mkdir(pathStr, permissions = 0o755) {
    const norm = this.normalizePath(pathStr);
    if (norm === '/') {
      this.log('SYS_MKDIR', norm, 'ERROR', 'Root directory already exists');
      throw new Error('Cannot recreate root directory');
    }

    if (this.resolvePath(norm)) {
      this.log('SYS_MKDIR', norm, 'ERROR', `Directory '${norm}' already exists`);
      throw new Error(`Directory '${norm}' already exists`);
    }

    const lastSlash = norm.lastIndexOf('/');
    const parentPath = lastSlash === 0 ? '/' : norm.slice(0, lastSlash);
    const dirName = norm.slice(lastSlash + 1);

    const parent = this.resolvePath(parentPath);
    if (!parent) {
      this.log('SYS_MKDIR', norm, 'ERROR', `Parent directory '${parentPath}' not found`);
      throw new Error(`Parent directory '${parentPath}' does not exist`);
    }

    if (parent.type !== 'directory') {
      this.log('SYS_MKDIR', norm, 'ERROR', `Parent '${parentPath}' is not a directory`);
      throw new Error(`Parent '${parentPath}' is not a directory`);
    }

    const newInode = new Inode(this.nextInodeId++, dirName, 'directory', parent.id, permissions);
    this.inodes.set(newInode.id, newInode);
    parent.children.push(newInode.id);
    parent.modifiedAt = new Date().toISOString();

    this.log('SYS_MKDIR', norm, 'SUCCESS', `Created directory '${norm}' (Inode: ${newInode.id})`, { inodeId: newInode.id, permissions: newInode.getPermissionString() });
    return newInode;
  }

  // System call: creat (create file)
  createFile(pathStr, content = '', permissions = 0o644) {
    const norm = this.normalizePath(pathStr);
    if (this.resolvePath(norm)) {
      this.log('SYS_CREAT', norm, 'ERROR', `File or directory '${norm}' already exists`);
      throw new Error(`File '${norm}' already exists`);
    }

    const lastSlash = norm.lastIndexOf('/');
    const parentPath = lastSlash === 0 ? '/' : norm.slice(0, lastSlash);
    const fileName = norm.slice(lastSlash + 1);

    if (!fileName) {
      throw new Error('Invalid file name');
    }

    const parent = this.resolvePath(parentPath);
    if (!parent) {
      this.log('SYS_CREAT', norm, 'ERROR', `Parent directory '${parentPath}' not found`);
      throw new Error(`Parent directory '${parentPath}' does not exist`);
    }

    if (parent.type !== 'directory') {
      this.log('SYS_CREAT', norm, 'ERROR', `Parent '${parentPath}' is not a directory`);
      throw new Error(`Parent '${parentPath}' is not a directory`);
    }

    const newInode = new Inode(this.nextInodeId++, fileName, 'file', parent.id, permissions);
    newInode.content = content;
    newInode.size = Buffer.byteLength(content, 'utf8');
    this.inodes.set(newInode.id, newInode);
    parent.children.push(newInode.id);
    parent.modifiedAt = new Date().toISOString();

    this.log('SYS_CREAT', norm, 'SUCCESS', `Created file '${norm}' (Size: ${newInode.size} bytes, Inode: ${newInode.id})`, {
      inodeId: newInode.id,
      size: newInode.size,
      permissions: newInode.getPermissionString()
    });
    return newInode;
  }

  // System call: open
  open(pathStr, mode = 'r') {
    const inode = this.resolvePath(pathStr);
    if (!inode) {
      this.log('SYS_OPEN', pathStr, 'ERROR', `File '${pathStr}' not found`);
      throw new Error(`File '${pathStr}' not found`);
    }

    if (inode.type !== 'file') {
      this.log('SYS_OPEN', pathStr, 'ERROR', `Cannot open directory '${pathStr}' with file descriptor`);
      throw new Error(`Cannot open directory as a file`);
    }

    // Check permissions
    if (mode === 'r' && !(inode.permissions & 0o444)) {
      this.log('SYS_OPEN', pathStr, 'ERROR', `Permission denied (no read permission)`);
      throw new Error('Permission denied: No read permission');
    }
    if ((mode === 'w' || mode === 'a') && !(inode.permissions & 0o222)) {
      this.log('SYS_OPEN', pathStr, 'ERROR', `Permission denied (no write permission)`);
      throw new Error('Permission denied: No write permission');
    }

    const fd = this.nextFd++;
    const desc = {
      fd,
      inodeId: inode.id,
      path: pathStr,
      mode,
      cursor: mode === 'a' ? inode.size : 0,
      openedAt: new Date().toLocaleTimeString()
    };
    this.openFileTable.set(fd, desc);

    this.log('SYS_OPEN', pathStr, 'SUCCESS', `Opened '${pathStr}' with mode '${mode}' (Allocated FD: ${fd})`, { fd, mode });
    return desc;
  }

  // System call: close
  close(fd) {
    const parsedFd = parseInt(fd, 10);
    const desc = this.openFileTable.get(parsedFd);
    if (!desc) {
      this.log('SYS_CLOSE', `FD:${fd}`, 'ERROR', `Bad file descriptor ${fd}`);
      throw new Error(`Bad file descriptor ${fd}`);
    }

    this.openFileTable.delete(parsedFd);
    this.log('SYS_CLOSE', desc.path, 'SUCCESS', `Closed file descriptor ${parsedFd}`, { fd: parsedFd });
    return true;
  }

  // System call: read
  read(fd, length = null) {
    const parsedFd = parseInt(fd, 10);
    const desc = this.openFileTable.get(parsedFd);
    if (!desc) {
      this.log('SYS_READ', `FD:${fd}`, 'ERROR', `Bad file descriptor ${fd}`);
      throw new Error(`Bad file descriptor ${fd}`);
    }

    const inode = this.inodes.get(desc.inodeId);
    if (!inode) {
      throw new Error('Inode no longer exists');
    }

    const content = inode.content;
    const start = desc.cursor;
    const end = length !== null ? Math.min(content.length, start + length) : content.length;
    const slice = content.slice(start, end);
    desc.cursor = end;

    this.log('SYS_READ', desc.path, 'SUCCESS', `Read ${slice.length} bytes from FD ${parsedFd} (Cursor: ${desc.cursor})`, {
      fd: parsedFd,
      bytesRead: slice.length,
      cursor: desc.cursor
    });
    return { data: slice, bytesRead: slice.length, cursor: desc.cursor, eof: desc.cursor >= content.length };
  }

  // System call: write
  write(fd, data) {
    const parsedFd = parseInt(fd, 10);
    const desc = this.openFileTable.get(parsedFd);
    if (!desc) {
      this.log('SYS_WRITE', `FD:${fd}`, 'ERROR', `Bad file descriptor ${fd}`);
      throw new Error(`Bad file descriptor ${fd}`);
    }

    if (desc.mode === 'r') {
      this.log('SYS_WRITE', desc.path, 'ERROR', `FD ${parsedFd} opened in read-only mode`);
      throw new Error('Cannot write to file opened in read-only mode');
    }

    const inode = this.inodes.get(desc.inodeId);
    if (!inode) throw new Error('Inode missing');

    const strData = String(data);
    if (desc.mode === 'w') {
      // Overwrite from cursor or overwrite completely if cursor is 0
      inode.content = inode.content.slice(0, desc.cursor) + strData;
      desc.cursor += strData.length;
    } else if (desc.mode === 'a') {
      inode.content += strData;
      desc.cursor = inode.content.length;
    }

    inode.size = Buffer.byteLength(inode.content, 'utf8');
    inode.modifiedAt = new Date().toISOString();

    this.log('SYS_WRITE', desc.path, 'SUCCESS', `Wrote ${strData.length} bytes to FD ${parsedFd} (Total Size: ${inode.size}B)`, {
      fd: parsedFd,
      bytesWritten: strData.length,
      newSize: inode.size
    });

    return { bytesWritten: strData.length, newSize: inode.size };
  }

  // Direct Write / Update content without explicit open
  writeFileContent(pathStr, newContent) {
    const inode = this.resolvePath(pathStr);
    if (!inode) throw new Error(`File '${pathStr}' not found`);
    if (inode.type !== 'file') throw new Error(`'${pathStr}' is a directory`);

    inode.content = newContent;
    inode.size = Buffer.byteLength(newContent, 'utf8');
    inode.modifiedAt = new Date().toISOString();

    this.log('SYS_WRITE', pathStr, 'SUCCESS', `Updated content of '${pathStr}' (${inode.size} bytes)`, { size: inode.size });
    return inode;
  }

  // Direct Append content
  appendFileContent(pathStr, appendData) {
    const inode = this.resolvePath(pathStr);
    if (!inode) throw new Error(`File '${pathStr}' not found`);
    if (inode.type !== 'file') throw new Error(`'${pathStr}' is a directory`);

    inode.content += appendData;
    inode.size = Buffer.byteLength(inode.content, 'utf8');
    inode.modifiedAt = new Date().toISOString();

    this.log('SYS_APPEND', pathStr, 'SUCCESS', `Appended ${Buffer.byteLength(appendData, 'utf8')} bytes to '${pathStr}'`, { size: inode.size });
    return inode;
  }

  // System call: unlink / rmdir (delete)
  delete(pathStr, recursive = false) {
    const norm = this.normalizePath(pathStr);
    if (norm === '/') {
      this.log('SYS_UNLINK', norm, 'ERROR', 'Cannot delete root directory');
      throw new Error('Cannot delete root directory');
    }

    const inode = this.resolvePath(norm);
    if (!inode) {
      this.log('SYS_UNLINK', norm, 'ERROR', `Target '${norm}' does not exist`);
      throw new Error(`Target '${norm}' does not exist`);
    }

    if (inode.type === 'directory') {
      if (inode.children.length > 0 && !recursive) {
        this.log('SYS_RMDIR', norm, 'ERROR', `Directory '${norm}' is not empty`);
        throw new Error(`Directory '${norm}' is not empty. Use recursive flag to delete.`);
      }
      this.deleteInodeRecursive(inode.id);
      this.log('SYS_RMDIR', norm, 'SUCCESS', `Removed directory '${norm}'`);
    } else {
      // Close any open file descriptors pointing to this inode
      for (const [fd, desc] of this.openFileTable.entries()) {
        if (desc.inodeId === inode.id) {
          this.openFileTable.delete(fd);
        }
      }
      this.removeInodeFromParent(inode);
      this.inodes.delete(inode.id);
      this.log('SYS_UNLINK', norm, 'SUCCESS', `Removed file '${norm}' (Inode ${inode.id})`);
    }

    return true;
  }

  deleteInodeRecursive(inodeId) {
    const inode = this.inodes.get(inodeId);
    if (!inode) return;

    if (inode.type === 'directory') {
      for (const childId of [...inode.children]) {
        this.deleteInodeRecursive(childId);
      }
    }

    // Close any open descriptors
    for (const [fd, desc] of this.openFileTable.entries()) {
      if (desc.inodeId === inode.id) {
        this.openFileTable.delete(fd);
      }
    }

    this.removeInodeFromParent(inode);
    this.inodes.delete(inode.id);
  }

  removeInodeFromParent(inode) {
    if (inode.parentId !== null) {
      const parent = this.inodes.get(inode.parentId);
      if (parent && parent.children) {
        parent.children = parent.children.filter(cid => cid !== inode.id);
        parent.modifiedAt = new Date().toISOString();
      }
    }
  }

  // System call: rename
  rename(pathStr, newName) {
    const norm = this.normalizePath(pathStr);
    if (norm === '/') throw new Error('Cannot rename root directory');

    const inode = this.resolvePath(norm);
    if (!inode) throw new Error(`Target '${norm}' not found`);

    if (!newName || newName.includes('/')) {
      throw new Error('New name must be a valid non-empty name without slashes');
    }

    const parent = this.inodes.get(inode.parentId);
    if (parent) {
      const siblingExists = parent.children.some(cid => {
        const c = this.inodes.get(cid);
        return c && c.id !== inode.id && c.name === newName;
      });
      if (siblingExists) throw new Error(`An item named '${newName}' already exists in the same directory`);
    }

    const oldName = inode.name;
    inode.name = newName;
    inode.modifiedAt = new Date().toISOString();

    this.log('SYS_RENAME', norm, 'SUCCESS', `Renamed '${oldName}' to '${newName}'`, { oldName, newName });
    return inode;
  }

  // System call: move (mv)
  move(srcPath, destDirPath) {
    const normSrc = this.normalizePath(srcPath);
    const normDest = this.normalizePath(destDirPath);

    if (normSrc === '/') throw new Error('Cannot move root directory');

    const srcInode = this.resolvePath(normSrc);
    if (!srcInode) throw new Error(`Source '${normSrc}' not found`);

    let destDirInode = this.resolvePath(normDest);
    if (!destDirInode) throw new Error(`Destination directory '${normDest}' not found`);

    if (destDirInode.type !== 'directory') {
      throw new Error(`Destination '${normDest}' is not a directory`);
    }

    // Check if moving directory into itself or child
    if (srcInode.type === 'directory') {
      let check = destDirInode;
      while (check && check.id !== 0) {
        if (check.id === srcInode.id) {
          throw new Error('Cannot move a directory into its own subdirectory');
        }
        check = this.inodes.get(check.parentId);
      }
    }

    // Check collision in destination
    const collision = destDirInode.children.some(cid => {
      const c = this.inodes.get(cid);
      return c && c.name === srcInode.name;
    });
    if (collision) {
      throw new Error(`An item named '${srcInode.name}' already exists in destination directory`);
    }

    // Detach from old parent
    this.removeInodeFromParent(srcInode);

    // Attach to new parent
    srcInode.parentId = destDirInode.id;
    destDirInode.children.push(srcInode.id);
    destDirInode.modifiedAt = new Date().toISOString();
    srcInode.modifiedAt = new Date().toISOString();

    this.log('SYS_MOVE', normSrc, 'SUCCESS', `Moved '${normSrc}' to '${normDest}/${srcInode.name}'`, {
      from: normSrc,
      to: `${normDest}/${srcInode.name}`
    });

    return srcInode;
  }

  // System call: copy (cp)
  copy(srcPath, destDirPath) {
    const normSrc = this.normalizePath(srcPath);
    const normDest = this.normalizePath(destDirPath);

    const srcInode = this.resolvePath(normSrc);
    if (!srcInode) throw new Error(`Source '${normSrc}' not found`);

    const destDir = this.resolvePath(normDest);
    if (!destDir || destDir.type !== 'directory') {
      throw new Error(`Destination '${normDest}' is not a valid directory`);
    }

    const copiedInode = this.cloneInodeRecursive(srcInode, destDir.id);
    this.log('SYS_COPY', normSrc, 'SUCCESS', `Copied '${normSrc}' to '${normDest}/${copiedInode.name}'`, {
      originalId: srcInode.id,
      newId: copiedInode.id
    });

    return copiedInode;
  }

  cloneInodeRecursive(sourceInode, targetParentId, overrideName = null) {
    let targetName = overrideName || sourceInode.name;
    const parent = this.inodes.get(targetParentId);

    // Avoid collision by appending "_copy" if needed
    if (parent) {
      let counter = 1;
      let testName = targetName;
      while (parent.children.some(cid => this.inodes.get(cid)?.name === testName)) {
        testName = `${targetName}_copy${counter > 1 ? counter : ''}`;
        counter++;
      }
      targetName = testName;
    }

    const cloned = new Inode(
      this.nextInodeId++,
      targetName,
      sourceInode.type,
      targetParentId,
      sourceInode.permissions,
      sourceInode.owner
    );
    cloned.size = sourceInode.size;
    cloned.content = sourceInode.content;

    this.inodes.set(cloned.id, cloned);
    if (parent) {
      parent.children.push(cloned.id);
      parent.modifiedAt = new Date().toISOString();
    }

    if (sourceInode.type === 'directory') {
      for (const childId of sourceInode.children) {
        const childInode = this.inodes.get(childId);
        if (childInode) {
          this.cloneInodeRecursive(childInode, cloned.id);
        }
      }
    }

    return cloned;
  }

  // System call: chmod
  chmod(pathStr, mode) {
    const inode = this.resolvePath(pathStr);
    if (!inode) throw new Error(`Target '${pathStr}' not found`);

    let octalMode;
    if (typeof mode === 'string') {
      if (mode.startsWith('0o')) octalMode = parseInt(mode, 8);
      else if (mode.length === 3 && /^[0-7]+$/.test(mode)) octalMode = parseInt(mode, 8);
      else octalMode = parseInt(mode, 10);
    } else {
      octalMode = mode;
    }

    if (isNaN(octalMode) || octalMode < 0 || octalMode > 0o777) {
      throw new Error('Invalid permission mode. Expected 3 octal digits (e.g. 755, 644)');
    }

    const oldPerm = inode.getPermissionString();
    inode.permissions = octalMode;
    inode.modifiedAt = new Date().toISOString();
    const newPerm = inode.getPermissionString();

    this.log('SYS_CHMOD', pathStr, 'SUCCESS', `Changed permissions of '${pathStr}' from ${oldPerm} to ${newPerm} (0o${octalMode.toString(8)})`, {
      old: oldPerm,
      new: newPerm,
      octal: `0o${octalMode.toString(8)}`
    });

    return { inode, oldPerm, newPerm };
  }

  // System call: opendir / readdir
  list(pathStr = '/') {
    const inode = this.resolvePath(pathStr);
    if (!inode) throw new Error(`Directory '${pathStr}' not found`);
    if (inode.type !== 'directory') throw new Error(`'${pathStr}' is a file, not a directory`);

    const items = inode.children.map(cid => {
      const child = this.inodes.get(cid);
      if (!child) return null;
      return {
        id: child.id,
        name: child.name,
        type: child.type,
        size: child.size,
        permissions: child.getPermissionString(),
        octalPerm: '0' + child.permissions.toString(8),
        owner: child.owner,
        createdAt: child.createdAt,
        modifiedAt: child.modifiedAt,
        path: this.getPath(child.id),
        allocatedBlocks: child.allocatedBlocks
      };
    }).filter(Boolean);

    return items;
  }

  // Get full hierarchical tree structure for visualization
  getTree(startInodeId = 0) {
    const node = this.inodes.get(startInodeId);
    if (!node) return null;

    const result = {
      id: node.id,
      name: node.name,
      type: node.type,
      size: node.size,
      path: this.getPath(node.id),
      permissions: node.getPermissionString(),
      octalPerm: '0' + node.permissions.toString(8),
      owner: node.owner,
      createdAt: node.createdAt,
      modifiedAt: node.modifiedAt,
      children: []
    };

    if (node.type === 'directory' && Array.isArray(node.children)) {
      result.children = node.children
        .map(cid => this.getTree(cid))
        .filter(Boolean);
    }

    return result;
  }

  // Get file details
  getFileMetadata(pathStr) {
    const inode = this.resolvePath(pathStr);
    if (!inode) throw new Error(`Target '${pathStr}' not found`);

    return {
      id: inode.id,
      name: inode.name,
      path: this.getPath(inode.id),
      type: inode.type,
      size: inode.size,
      content: inode.type === 'file' ? inode.content : null,
      permissions: inode.getPermissionString(),
      octalPerm: '0' + inode.permissions.toString(8),
      owner: inode.owner,
      createdAt: inode.createdAt,
      modifiedAt: inode.modifiedAt,
      allocatedBlocks: inode.allocatedBlocks,
      openDescriptors: Array.from(this.openFileTable.values()).filter(d => d.inodeId === inode.id)
    };
  }

  // Get Active Open File Table
  getOpenFileTable() {
    return Array.from(this.openFileTable.values()).map(desc => {
      const inode = this.inodes.get(desc.inodeId);
      return {
        fd: desc.fd,
        inodeId: desc.inodeId,
        path: desc.path,
        name: inode ? inode.name : 'unknown',
        mode: desc.mode,
        cursor: desc.cursor,
        fileSize: inode ? inode.size : 0,
        openedAt: desc.openedAt
      };
    });
  }

  // Export File System state to JSON
  exportState() {
    const serializedInodes = Array.from(this.inodes.entries()).map(([id, inode]) => ({
      id,
      name: inode.name,
      type: inode.type,
      parentId: inode.parentId,
      size: inode.size,
      content: inode.content,
      createdAt: inode.createdAt,
      modifiedAt: inode.modifiedAt,
      permissions: inode.permissions,
      owner: inode.owner,
      children: inode.children,
      allocatedBlocks: inode.allocatedBlocks
    }));

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      nextInodeId: this.nextInodeId,
      inodes: serializedInodes,
      operationLogs: this.operationLogs.slice(0, 50)
    };
  }

  // Import File System state from JSON
  importState(stateData) {
    if (!stateData || !Array.isArray(stateData.inodes)) {
      throw new Error('Invalid file system state data');
    }

    this.inodes.clear();
    this.openFileTable.clear();
    this.nextFd = 100;

    for (const item of stateData.inodes) {
      const inode = new Inode(
        item.id,
        item.name,
        item.type,
        item.parentId,
        item.permissions,
        item.owner || 'user'
      );
      inode.size = item.size || 0;
      inode.content = item.content !== undefined ? item.content : (item.type === 'file' ? '' : null);
      inode.createdAt = item.createdAt || new Date().toISOString();
      inode.modifiedAt = item.modifiedAt || new Date().toISOString();
      inode.children = item.children || (item.type === 'directory' ? [] : undefined);
      inode.allocatedBlocks = item.allocatedBlocks || [];
      this.inodes.set(item.id, inode);
    }

    this.nextInodeId = stateData.nextInodeId || (Math.max(...this.inodes.keys(), 0) + 1);
    this.operationLogs = stateData.operationLogs || [];

    this.log('FS_IMPORT', '/', 'SUCCESS', `Imported file system state with ${this.inodes.size} nodes`);
    return { count: this.inodes.size };
  }
}

module.exports = FileSystem;
