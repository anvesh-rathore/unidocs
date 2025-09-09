class P2PFileTransfer {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.currentUser = null;
        this.connectedPeer = null;
        this.fileQueue = new Map();
        this.receivingFiles = new Map();
        
        this.init();
    }

    init() {
        this.loadUserSession();
        this.setupSocket();
        this.setupEventListeners();
        this.updateUI();
    }

    loadUserSession() {
        const userData = localStorage.getItem('currentUser');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }
        
        try {
            this.currentUser = JSON.parse(userData);
        } catch (error) {
            console.error('Error loading user session:', error);
            window.location.href = 'login.html';
        }
    }

    updateUI() {
        if (this.currentUser) {
            document.getElementById('currentUsername').textContent = this.currentUser.username;
            document.getElementById('currentUserId').textContent = `ID: ${this.currentUser.id}`;
        }
    }

    setupSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('user-online', this.currentUser);
            this.addLogEntry('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.addLogEntry('Disconnected from server');
            this.updateConnectionStatus('disconnected', 'Connection lost');
        });

        // WebRTC signaling events
        this.socket.on('webrtc-offer', (data) => {
            this.handleWebRTCOffer(data);
        });

        this.socket.on('webrtc-answer', (data) => {
            this.handleWebRTCAnswer(data);
        });

        this.socket.on('webrtc-ice-candidate', (data) => {
            this.handleWebRTCIceCandidate(data);
        });

        this.socket.on('user-status', (data) => {
            this.addLogEntry(`User ${data.userId} is now ${data.status}`);
        });
    }

    setupEventListeners() {
        // Connect button
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connectToPeer();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // File selection
        document.getElementById('selectFileBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFiles(Array.from(e.target.files));
        });

        // Drag and drop
        const dropZone = document.getElementById('dropZone');
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFiles(Array.from(e.dataTransfer.files));
        });

        // Clear log
        document.getElementById('clearLogBtn').addEventListener('click', () => {
            this.clearLog();
        });

        // Enter key for peer ID input
        document.getElementById('peerIdInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.connectToPeer();
            }
        });
    }

    async connectToPeer() {
        const peerIdInput = document.getElementById('peerIdInput');
        const peerId = peerIdInput.value.trim();
        
        if (!peerId) {
            this.showNotification('Please enter a peer ID', 'error');
            return;
        }

        if (peerId === this.currentUser.id) {
            this.showNotification('Cannot connect to yourself', 'error');
            return;
        }

        this.connectedPeer = peerId;
        this.updateConnectionStatus('connecting', 'Connecting to peer...');
        this.addLogEntry(`Attempting to connect to peer: ${peerId}`);

        try {
            await this.createPeerConnection();
            await this.createOffer();
        } catch (error) {
            console.error('Error connecting to peer:', error);
            this.showNotification('Failed to connect to peer', 'error');
            this.updateConnectionStatus('disconnected', 'Connection failed');
        }
    }

    async createPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        // Create data channel for file transfer
        this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
            ordered: true
        });

        this.setupDataChannel(this.dataChannel);

        // Handle incoming data channels
        this.peerConnection.ondatachannel = (event) => {
            this.setupDataChannel(event.channel);
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc-ice-candidate', {
                    targetUserId: this.connectedPeer,
                    senderUserId: this.currentUser.id,
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Connection state:', state);
            
            switch (state) {
                case 'connected':
                    this.updateConnectionStatus('connected', 'Connected to peer');
                    this.addLogEntry('P2P connection established');
                    this.showNotification('Connected to peer successfully!', 'success');
                    break;
                case 'disconnected':
                case 'failed':
                case 'closed':
                    this.updateConnectionStatus('disconnected', 'Connection lost');
                    this.addLogEntry('P2P connection lost');
                    break;
            }
        };
    }

    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.socket.emit('webrtc-offer', {
                targetUserId: this.connectedPeer,
                senderUserId: this.currentUser.id,
                senderUsername: this.currentUser.username,
                offer: offer
            });
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    async handleWebRTCOffer(data) {
        try {
            this.connectedPeer = data.senderUserId;
            this.addLogEntry(`Incoming connection from: ${data.senderUsername}`);
            this.updateConnectionStatus('connecting', 'Incoming connection...');

            await this.createPeerConnection();
            await this.peerConnection.setRemoteDescription(data.offer);

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('webrtc-answer', {
                targetUserId: data.senderUserId,
                senderUserId: this.currentUser.id,
                answer: answer
            });
        } catch (error) {
            console.error('Error handling WebRTC offer:', error);
            this.updateConnectionStatus('disconnected', 'Connection failed');
        }
    }

    async handleWebRTCAnswer(data) {
        try {
            await this.peerConnection.setRemoteDescription(data.answer);
        } catch (error) {
            console.error('Error handling WebRTC answer:', error);
        }
    }

    async handleWebRTCIceCandidate(data) {
        try {
            await this.peerConnection.addIceCandidate(data.candidate);
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    setupDataChannel(dataChannel) {
        dataChannel.onopen = () => {
            console.log('Data channel opened');
            this.dataChannel = dataChannel;
        };

        dataChannel.onmessage = (event) => {
            this.handleDataChannelMessage(event.data);
        };

        dataChannel.onclose = () => {
            console.log('Data channel closed');
            this.addLogEntry('File transfer channel closed');
        };

        dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.addLogEntry('File transfer error occurred');
        };
    }

    handleFiles(files) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            this.showNotification('Please connect to a peer first', 'error');
            return;
        }

        files.forEach(file => this.sendFile(file));
    }

    async sendFile(file) {
        const fileId = this.generateId();
        const chunkSize = 16384; // 16KB chunks
        const totalChunks = Math.ceil(file.size / chunkSize);

        // Add file to UI
        this.addFileToUI(file, fileId, 'sending');
        this.addLogEntry(`Sending: ${file.name} (${this.formatFileSize(file.size)})`);

        // Send file metadata
        const metadata = {
            type: 'file-start',
            fileId: fileId,
            fileName: file.name,
            fileSize: file.size,
            totalChunks: totalChunks
        };

        this.dataChannel.send(JSON.stringify(metadata));

        // Send file in chunks
        let offset = 0;
        let chunkIndex = 0;

        const sendNextChunk = async () => {
            if (offset >= file.size) {
                // File transfer complete
                const endMessage = {
                    type: 'file-end',
                    fileId: fileId
                };
                this.dataChannel.send(JSON.stringify(endMessage));
                this.updateFileProgress(fileId, 100);
                this.addLogEntry(`Transfer complete: ${file.name}`);
                return;
            }

            const chunk = file.slice(offset, offset + chunkSize);
            const arrayBuffer = await chunk.arrayBuffer();

            const chunkData = {
                type: 'file-chunk',
                fileId: fileId,
                chunkIndex: chunkIndex,
                data: Array.from(new Uint8Array(arrayBuffer))
            };

            try {
                this.dataChannel.send(JSON.stringify(chunkData));
                
                offset += chunkSize;
                chunkIndex++;
                
                const progress = Math.min((offset / file.size) * 100, 100);
                this.updateFileProgress(fileId, progress);
                
                // Small delay to prevent overwhelming
                setTimeout(sendNextChunk, 10);
            } catch (error) {
                console.error('Error sending chunk:', error);
                this.addLogEntry(`Error sending ${file.name}: ${error.message}`);
            }
        };

        sendNextChunk();
    }

    handleDataChannelMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'file-start':
                    this.handleFileStart(message);
                    break;
                case 'file-chunk':
                    this.handleFileChunk(message);
                    break;
                case 'file-end':
                    this.handleFileEnd(message);
                    break;
            }
        } catch (error) {
            console.error('Error parsing data channel message:', error);
        }
    }

    handleFileStart(metadata) {
        const fileInfo = {
            fileId: metadata.fileId,
            fileName: metadata.fileName,
            fileSize: metadata.fileSize,
            totalChunks: metadata.totalChunks,
            receivedChunks: new Array(metadata.totalChunks),
            receivedSize: 0
        };

        this.receivingFiles.set(metadata.fileId, fileInfo);
        this.addFileToUI({ name: metadata.fileName, size: metadata.fileSize }, metadata.fileId, 'receiving');
        this.addLogEntry(`Receiving: ${metadata.fileName} (${this.formatFileSize(metadata.fileSize)})`);
    }

    handleFileChunk(chunkData) {
        const fileInfo = this.receivingFiles.get(chunkData.fileId);
        if (!fileInfo) return;

        const chunkBytes = new Uint8Array(chunkData.data);
        fileInfo.receivedChunks[chunkData.chunkIndex] = chunkBytes;
        fileInfo.receivedSize += chunkBytes.length;

        const progress = (fileInfo.receivedSize / fileInfo.fileSize) * 100;
        this.updateFileProgress(chunkData.fileId, progress);
    }

    handleFileEnd(endData) {
        const fileInfo = this.receivingFiles.get(endData.fileId);
        if (!fileInfo) return;

        // Combine all chunks
        const chunks = fileInfo.receivedChunks.filter(chunk => chunk);
        const blob = new Blob(chunks);
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.updateFileProgress(endData.fileId, 100);
        this.addLogEntry(`Download complete: ${fileInfo.fileName}`);
        this.showNotification(`File received: ${fileInfo.fileName}`, 'success');
        
        this.receivingFiles.delete(endData.fileId);
    }

    addFileToUI(file, fileId, type) {
        const fileList = document.getElementById('fileList');
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.id = `file-${fileId}`;

        const typeIcon = type === 'sending' ? '📤' : '📥';
        const typeText = type === 'sending' ? 'Sending' : 'Receiving';
        
        fileItem.innerHTML = `
            <div class="file-icon">${typeIcon}</div>
            <div class="file-details">
                <h4>${file.name}</h4>
                <p>${this.formatFileSize(file.size)} • ${typeText}</p>
            </div>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <div class="progress-text">0%</div>
            </div>
        `;

        fileList.appendChild(fileItem);
    }

    updateFileProgress(fileId, progress) {
        const fileItem = document.getElementById(`file-${fileId}`);
        if (fileItem) {
            const progressFill = fileItem.querySelector('.progress-fill');
            const progressText = fileItem.querySelector('.progress-text');
            
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
        }
    }

    updateConnectionStatus(status, message) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = message;
    }

    addLogEntry(message) {
        const logContent = document.getElementById('logContent');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        const time = new Date().toLocaleTimeString();
        entry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-message">${message}</span>
        `;

        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    clearLog() {
        const logContent = document.getElementById('logContent');
        logContent.innerHTML = `
            <div class="log-entry">
                <span class="log-time">Ready</span>
                <span class="log-message">Log cleared</span>
            </div>
        `;
    }

    logout() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('fileShareUser');
        window.location.href = 'index.html';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.getElementById('notifications').appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new P2PFileTransfer();
});