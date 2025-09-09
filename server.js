const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// JSON file storage
const USERS_FILE = 'users.json';

// Initialize users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [], rooms: {} }, null, 2));
}

// Helper functions for JSON storage
function readUsersData() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { users: [], rooms: {} };
  }
}

function writeUsersData(data) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing users data:', error);
  }
}

// Generate unique user ID
function generateUserId() {
  return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Store active connections
const activeUsers = new Map();

// Serve landing page as default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.post('/api/register', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const usersData = readUsersData();
  
  // Check if username already exists
  const existingUser = usersData.users.find(user => user.username === username);
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  // Create new user
  const newUser = {
    id: generateUserId(),
    username: username,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };

  usersData.users.push(newUser);
  writeUsersData(usersData);

  res.json({ 
    success: true, 
    user: newUser,
    message: 'User registered successfully' 
  });
});

app.post('/api/login', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const usersData = readUsersData();
  const user = usersData.users.find(user => user.username === username);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  writeUsersData(usersData);

  res.json({ 
    success: true, 
    user: user,
    message: 'Login successful' 
  });
});

app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const usersData = readUsersData();
  const user = usersData.users.find(user => user.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user-online', (userData) => {
    activeUsers.set(socket.id, userData);
    console.log(`User ${userData.username} (${userData.id}) is now online`);
    socket.broadcast.emit('user-status', { userId: userData.id, status: 'online' });
  });

  // WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    // Find the target user's socket
    const targetSocket = Array.from(activeUsers.entries())
      .find(([socketId, user]) => user.id === data.targetUserId);
    
    if (targetSocket) {
      console.log(`Forwarding WebRTC offer from ${data.senderUserId} to ${data.targetUserId}`);
      io.to(targetSocket[0]).emit('webrtc-offer', {
        offer: data.offer,
        senderUserId: data.senderUserId,
        senderUsername: data.senderUsername
      });
    } else {
      console.log(`Target user ${data.targetUserId} not found online`);
    }
  });

  socket.on('webrtc-answer', (data) => {
    const targetSocket = Array.from(activeUsers.entries())
      .find(([socketId, user]) => user.id === data.targetUserId);
    
    if (targetSocket) {
      console.log(`Forwarding WebRTC answer from ${data.senderUserId} to ${data.targetUserId}`);
      io.to(targetSocket[0]).emit('webrtc-answer', {
        answer: data.answer,
        senderUserId: data.senderUserId
      });
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    const targetSocket = Array.from(activeUsers.entries())
      .find(([socketId, user]) => user.id === data.targetUserId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('webrtc-ice-candidate', {
        candidate: data.candidate,
        senderUserId: data.senderUserId
      });
    }
  });

  socket.on('disconnect', () => {
    const userData = activeUsers.get(socket.id);
    if (userData) {
      console.log(`User ${userData.username} (${userData.id}) disconnected`);
      socket.broadcast.emit('user-status', { userId: userData.id, status: 'offline' });
      activeUsers.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to access the application`);
});