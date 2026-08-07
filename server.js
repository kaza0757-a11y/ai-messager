require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const { db, runAsync, getAsync, allAsync } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const sessions = new Map();
const onlineUsers = new Map();
const socketByUser = new Map();

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
    cb(null, fileName);
  },
});
const upload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    const allowedMimeTypes = [
      'image/',
      'audio/',
      'video/',
      'application/pdf',
      'text/',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const isAllowed = allowedMimeTypes.some((type) =>
      type.endsWith('/') ? file.mimetype.startsWith(type) : file.mimetype === type
    );

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Only image, audio, video, text, or PDF uploads are allowed.'));
    }
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .map((cookie) => cookie.split('='))
    .reduce((acc, [name, value]) => {
      acc[name] = decodeURIComponent(value);
      return acc;
    }, {});
}

function createSession(userId) {
  const sessionId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessions.set(sessionId, { userId, createdAt: Date.now() });
  return sessionId;
}

function getSessionUserId(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.userId : null;
}

function getUserIdFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return getSessionUserId(cookies.sid);
}

function setSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', `sid=${sessionId}; HttpOnly; Path=/; SameSite=Lax`);
}

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'bale@bale-messager.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'BALE123';
  const adminUsername = process.env.ADMIN_USERNAME || 'BALE';

  const normalizedEmail = adminEmail.toLowerCase();
  const existing = await getAsync('SELECT id, password_hash, is_admin FROM users WHERE email = ?', [normalizedEmail]);
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  if (existing) {
    if (!existing.is_admin) {
      await runAsync('UPDATE users SET is_admin = 1 WHERE id = ?', [existing.id]);
    }
    await runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, existing.id]);
    await runAsync('UPDATE users SET username = ? WHERE id = ?', [adminUsername, existing.id]);
    return existing.id;
  }

  const result = await runAsync(
    'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
    [adminUsername, normalizedEmail, passwordHash, 1]
  );
  return result.lastID;
}

async function ensureWelcomeBot() {
  const botEmail = 'welcome@bale-messager.local';
  const existingBot = await getAsync('SELECT id FROM users WHERE email = ?', [botEmail]);
  if (existingBot) {
    return existingBot.id;
  }

  const passwordHash = await bcrypt.hash('welcome123', 10);
  const result = await runAsync(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    ['BALE BOT', botEmail, passwordHash]
  );
  return result.lastID;
}

async function ensureDefaultUsers() {
  const defaultUsers = [
    {
      username: 'user1',
      email: 'user1@bale-messager.local',
      password: process.env.USER1_PASSWORD || 'User1Pass',
    },
    {
      username: 'user2',
      email: 'user2@bale-messager.local',
      password: process.env.USER2_PASSWORD || 'User2Pass',
    },
  ];

  for (const user of defaultUsers) {
    const normalizedEmail = user.email.toLowerCase();
    const existing = await getAsync('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    const passwordHash = await bcrypt.hash(user.password, 10);

    if (existing) {
      await runAsync('UPDATE users SET username = ?, password_hash = ? WHERE id = ?', [user.username, passwordHash, existing.id]);
    } else {
      await runAsync('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [user.username, normalizedEmail, passwordHash]);
    }
  }
}

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const existing = await getAsync('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'This email is already registered. Please log in.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertResult = await runAsync(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email.toLowerCase(), passwordHash]
    );

    const userId = insertResult.lastID;
    const botId = await ensureWelcomeBot();
    const welcomeMessage = 'Welcome to BALE MESSAGER! Begin chatting with your contacts or reply to this message to start a conversation.';
    const timestamp = new Date().toISOString();

    await runAsync(
      'INSERT INTO messages (sender_id, receiver_id, content, timestamp) VALUES (?, ?, ?, ?)',
      [botId, userId, welcomeMessage, timestamp]
    );

    const sessionId = createSession(userId);
    setSessionCookie(res, sessionId);

    res.json({ success: true, user: { id: userId, username, email: email.toLowerCase() } });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'Unable to complete registration. Please try again later.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await getAsync('SELECT id, username, password_hash, is_admin FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const sessionId = createSession(user.id);
    setSessionCookie(res, sessionId);
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: email.toLowerCase(),
        isAdmin: user.is_admin === 1,
      },
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Unable to log in. Please try again.' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await getAsync('SELECT id, username, email, password_hash, is_admin FROM users WHERE username = ? AND is_admin = 1', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const sessionId = createSession(user.id);
    setSessionCookie(res, sessionId);
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1,
      },
    });
  } catch (error) {
    console.error('Admin login failed:', error);
    res.status(500).json({ error: 'Unable to log in. Please try again.' });
  }
});

app.post('/api/change-password', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  const { currentPassword, newPassword } = req.body;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Current password and new password (min 6 chars) are required.' });
  }

  try {
    const user = await getAsync('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password failed:', error);
    res.status(500).json({ error: 'Unable to change password.' });
  }
});

app.post('/api/upload', upload.single('media'), async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No media uploaded.' });
  }

  const mediaUrl = `/uploads/${encodeURIComponent(req.file.filename)}`;
  res.json({ success: true, mediaUrl });
});

app.post('/api/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.sid) {
    sessions.delete(cookies.sid);
  }
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  res.json({ success: true });
});

app.get('/api/profile', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await getAsync('SELECT id, username, email, is_admin FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.is_admin === 1,
  });
});

function requireAdmin(userId) {
  return getAsync('SELECT is_admin FROM users WHERE id = ?', [userId]).then((user) => user && user.is_admin === 1);
}

app.get('/api/admin/stats', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId || !(await requireAdmin(userId))) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    const userCountRow = await getAsync('SELECT COUNT(*) AS count FROM users');
    const messageCountRow = await getAsync('SELECT COUNT(*) AS count FROM messages');
    const users = await allAsync('SELECT id, username, email, is_admin FROM users ORDER BY id DESC');

    res.json({
      userCount: userCountRow.count,
      messageCount: messageCountRow.count,
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.is_admin === 1 ? 'Admin' : 'User',
      })),
    });
  } catch (error) {
    console.error('Admin stats failed:', error);
    res.status(500).json({ error: 'Unable to load admin data.' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId || !(await requireAdmin(userId))) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    const users = await allAsync('SELECT id, username, email, is_admin FROM users ORDER BY id DESC');
    res.json(users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.is_admin === 1 ? 'Admin' : 'User',
    })));
  } catch (error) {
    console.error('Admin users failed:', error);
    res.status(500).json({ error: 'Unable to load user list.' });
  }
});

app.get('/api/contacts', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const contacts = await allAsync(
      `SELECT
         u.id,
         u.username,
         u.email,
         COALESCE((SELECT content FROM messages
             WHERE (sender_id = ? AND receiver_id = u.id)
                OR (sender_id = u.id AND receiver_id = ?)
             ORDER BY timestamp DESC LIMIT 1), '') AS last_message,
         COALESCE((SELECT timestamp FROM messages
             WHERE (sender_id = ? AND receiver_id = u.id)
                OR (sender_id = u.id AND receiver_id = ?)
             ORDER BY timestamp DESC LIMIT 1), '') AS last_timestamp,
         COALESCE((SELECT sender_id FROM messages
             WHERE (sender_id = ? AND receiver_id = u.id)
                OR (sender_id = u.id AND receiver_id = ?)
             ORDER BY timestamp DESC LIMIT 1), 0) AS last_sender_id
       FROM users u
       WHERE u.id <> ?
       ORDER BY last_timestamp DESC, u.username ASC`,
      [userId, userId, userId, userId, userId, userId, userId]
    );

    const onlineSet = new Set(onlineUsers.keys());
    res.json(
      contacts.map((contact) => ({
        ...contact,
        online: onlineSet.has(contact.id),
      }))
    );
  } catch (error) {
    console.error('Fetching contacts failed:', error);
    res.status(500).json({ error: 'Unable to load contacts.' });
  }
});

app.get('/api/messages/:contactId', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  const contactId = Number(req.params.contactId);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!contactId) {
    return res.status(400).json({ error: 'Invalid contact ID.' });
  }

  try {
    const contact = await getAsync('SELECT id, username FROM users WHERE id = ?', [contactId]);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found.' });
    }

    const messages = await allAsync(
      `SELECT id, sender_id, receiver_id, content, type, media_url, timestamp
       FROM messages
       WHERE (sender_id = ? AND receiver_id = ?)
          OR (sender_id = ? AND receiver_id = ?)
       ORDER BY timestamp ASC`,
      [userId, contactId, contactId, userId]
    );

    res.json({ contact, messages });
  } catch (error) {
    console.error('Fetching messages failed:', error);
    res.status(500).json({ error: 'Unable to load messages.' });
  }
});

app.get('/api/groups', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const groups = await allAsync(
      `SELECT g.id, g.name, g.creator_id,
        COALESCE((SELECT content FROM group_messages WHERE group_id = g.id ORDER BY timestamp DESC LIMIT 1), '') AS last_message,
        COALESCE((SELECT timestamp FROM group_messages WHERE group_id = g.id ORDER BY timestamp DESC LIMIT 1), '') AS last_timestamp,
        COUNT(m.user_id) AS member_count
       FROM groups g
       JOIN group_members m ON m.group_id = g.id
       WHERE g.id IN (SELECT group_id FROM group_members WHERE user_id = ?)
       GROUP BY g.id
       ORDER BY last_timestamp DESC, g.name ASC`,
      [userId]
    );

    res.json(groups);
  } catch (error) {
    console.error('Fetching groups failed:', error);
    res.status(500).json({ error: 'Unable to load groups.' });
  }
});

app.post('/api/groups', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  const { name, memberIds } = req.body;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!name || !Array.isArray(memberIds)) {
    return res.status(400).json({ error: 'Group name and member IDs are required.' });
  }

  try {
    const cleanedIds = Array.from(new Set(memberIds.map((id) => Number(id)).filter((id) => id && id !== userId)));
    const timestamp = new Date().toISOString();
    const createResult = await runAsync(
      'INSERT INTO groups (name, creator_id, created_at) VALUES (?, ?, ?)',
      [name, userId, timestamp]
    );
    const groupId = createResult.lastID;

    const members = [userId, ...cleanedIds];
    for (const memberId of members) {
      await runAsync('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, memberId]);
    }

    res.json({ success: true, groupId });
  } catch (error) {
    console.error('Creating group failed:', error);
    res.status(500).json({ error: 'Unable to create group.' });
  }
});

app.get('/api/groups/:groupId/messages', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  const groupId = Number(req.params.groupId);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!groupId) {
    return res.status(400).json({ error: 'Invalid group ID.' });
  }

  try {
    const membership = await getAsync('SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
    if (!membership) {
      return res.status(403).json({ error: 'Access denied to this group.' });
    }

    const group = await getAsync('SELECT id, name FROM groups WHERE id = ?', [groupId]);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const messages = await allAsync(
      `SELECT id, group_id, sender_id, content, type, media_url, timestamp
       FROM group_messages
       WHERE group_id = ?
       ORDER BY timestamp ASC`,
      [groupId]
    );

    res.json({ group, messages });
  } catch (error) {
    console.error('Fetching group messages failed:', error);
    res.status(500).json({ error: 'Unable to load group messages.' });
  }
});

app.get('/api/groups/:groupId/members', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  const groupId = Number(req.params.groupId);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const membership = await getAsync('SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
    if (!membership) {
      return res.status(403).json({ error: 'Access denied to this group.' });
    }

    const members = await allAsync(
      `SELECT u.id, u.username, u.email
       FROM users u
       JOIN group_members gm ON gm.user_id = u.id
       WHERE gm.group_id = ?`,
      [groupId]
    );

    res.json({ members });
  } catch (error) {
    console.error('Fetching group members failed:', error);
    res.status(500).json({ error: 'Unable to load group members.' });
  }
});

// Simple AI assistant endpoint - returns canned guidance or integration hints.
app.post('/api/assistant', express.json(), async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const message = (req.body && req.body.message) ? String(req.body.message).toLowerCase() : '';

  // Basic keyword-based responses. Replace with real AI provider integration if desired.
  if (!message) return res.json({ reply: 'Ask me anything about the app or features.' });

  if (message.includes('add all') || message.includes('addall') || message.includes('all users')) {
    return res.json({ reply: 'The "Add All" button creates a group containing all registered users except yourself. You can name the group when prompted.' });
  }
  if (message.includes('pwa') || message.includes('install') || message.includes('manifest')) {
    return res.json({ reply: 'PWA support is partially implemented: see /public/manifest.json and the service worker at /public/service-worker.js. Add icons in /public/icons and ensure HTTPS for install prompts.' });
  }
  if (message.includes('media') || message.includes('upload')) {
    return res.json({ reply: 'Media uploads are handled by POST /api/upload. Supported types include images, audio, video and documents. Uploaded files are returned as mediaUrl in the response.' });
  }
  if (message.includes('admin') || message.includes('admin panel')) {
    return res.json({ reply: 'Admin users see the Admin Dashboard. Server routes enforce admin checks for admin-specific APIs. To make a user an admin, update their is_admin flag in the database.' });
  }

  // Default fallback with integration hint.
  const fallback = `I can answer basic questions about the app. To enable richer AI responses, set up an AI provider and proxy its API from this server (for example, using OpenAI or another LLM): store the API key in an environment variable and forward requests from /api/assistant.`;
  res.json({ reply: fallback });
});

app.get('/api/admin/conversation', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId || !(await requireAdmin(userId))) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const userA = Number(req.query.userA);
  const userB = Number(req.query.userB);
  if (!userA || !userB || userA === userB) {
    return res.status(400).json({ error: 'Two different user IDs are required.' });
  }

  try {
    const messages = await allAsync(
      `SELECT id, sender_id, receiver_id, content, type, media_url, timestamp
       FROM messages
       WHERE (sender_id = ? AND receiver_id = ?)
          OR (sender_id = ? AND receiver_id = ?)
       ORDER BY timestamp ASC`,
      [userA, userB, userB, userA]
    );

    res.json({ messages });
  } catch (error) {
    console.error('Fetching admin conversation failed:', error);
    res.status(500).json({ error: 'Unable to load conversation.' });
  }
});

io.use((socket, next) => {
  const cookies = parseCookies(socket.handshake.headers.cookie || '');
  const userId = getSessionUserId(cookies.sid);
  if (!userId) {
    return next(new Error('Authentication required'));
  }

  socket.userId = userId;
  next();
});

io.on('connection', async (socket) => {
  const userId = socket.userId;
  onlineUsers.set(userId, true);
  socketByUser.set(userId, socket.id);

  try {
    const groupRows = await allAsync('SELECT group_id FROM group_members WHERE user_id = ?', [userId]);
    groupRows.forEach((row) => socket.join(`group:${row.group_id}`));
  } catch (error) {
    console.error('Joining group rooms failed:', error);
  }

  io.emit('user_status', { userId, online: true });

  socket.on('private_message', async (payload) => {
      const { receiverId, content, type, mediaUrl } = payload;
      if (!receiverId || (!content && !mediaUrl)) {
        return;
      }

      try {
        const timestamp = new Date().toISOString();
        const result = await runAsync(
          'INSERT INTO messages (sender_id, receiver_id, content, type, media_url, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, receiverId, content ? content.trim() : '', type || 'text', mediaUrl || null, timestamp]
        );

        const message = {
          id: result.lastID,
          sender_id: userId,
          receiver_id: receiverId,
          content: content ? content.trim() : '',
          type: type || 'text',
          media_url: mediaUrl || null,
          timestamp,
      };

      socket.emit('new_message', message);
      const otherSocketId = socketByUser.get(receiverId);
      if (otherSocketId) {
        io.to(otherSocketId).emit('new_message', message);
      }
    } catch (error) {
      console.error('Message send failed:', error);
    }
  });

  socket.on('group_message', async (payload) => {
    const { groupId, content, type, mediaUrl } = payload;
    if (!groupId || (!content && !mediaUrl)) {
      return;
    }

    try {
      const membership = await getAsync('SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
      if (!membership) {
        return;
      }

      const timestamp = new Date().toISOString();
      const result = await runAsync(
        'INSERT INTO group_messages (group_id, sender_id, content, type, media_url, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        [groupId, userId, content ? content.trim() : '', type || 'text', mediaUrl || null, timestamp]
      );

      const message = {
        id: result.lastID,
        group_id: groupId,
        sender_id: userId,
        content: content ? content.trim() : '',
        type: type || 'text',
        media_url: mediaUrl || null,
        timestamp,
      };

      io.to(`group:${groupId}`).emit('group_message', message);
    } catch (error) {
      console.error('Group message send failed:', error);
    }
  });

  socket.on('typing', async (payload) => {
    const { receiverId, groupId } = payload;
    if (receiverId) {
      const otherSocketId = socketByUser.get(receiverId);
      if (otherSocketId) {
        io.to(otherSocketId).emit('typing', { senderId: userId });
      }
      return;
    }

    if (groupId) {
      const membership = await getAsync('SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
      if (!membership) {
        return;
      }
      socket.to(`group:${groupId}`).emit('typing', { groupId, senderId: userId });
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    socketByUser.delete(userId);
    io.emit('user_status', { userId, online: false });
  });
});

Promise.all([ensureAdminUser(), ensureDefaultUsers()])
  .then(() => {
    server.listen(PORT, () => {
      console.log(`BALE MESSAGER server running on http://localhost:${PORT}`);
      if (process.env.ADMIN_EMAIL) {
        console.log(`Admin login enabled for ${process.env.ADMIN_EMAIL}`);
      }
      console.log('Default users user1 and user2 are initialized.');
    });
  })
  .catch((error) => {
    console.error('Failed to initialize default users or admin user:', error);
    process.exit(1);
  });
