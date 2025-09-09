const BACKEND_URL = 'http://localhost:3000';
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingSession();
    }

    setupEventListeners() {
        // Form switching
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // Form submissions
        document.getElementById('loginFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Continue button
        document.getElementById('continueBtn').addEventListener('click', () => {
            this.continueToFileTransfer();
        });
    }

    showRegisterForm() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('userInfo').classList.add('hidden');
    }

    showLoginForm() {
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('userInfo').classList.add('hidden');
    }

    showUserInfo(user) {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('userInfo').classList.remove('hidden');
        
        document.getElementById('displayUsername').textContent = user.username;
        document.getElementById('displayUserId').textContent = user.id;
    }

async handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    
    if (!username) {
        this.showNotification('Please enter a username', 'error');
        return;
    }

    this.showLoading('Signing in...');

    try {
        const response = await fetch(`${BACKEND_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username })
        });

        const data = await response.json();
        this.hideLoading();

        if (data.success) {
            this.currentUser = data.user;
            this.saveUserSession(data.user);
            this.showUserInfo(data.user);
            this.showNotification(data.message, 'success');
        } else {
            this.showNotification(data.error, 'error');
        }
    } catch (error) {
        this.hideLoading();
        this.showNotification('Connection error. Please try again.', 'error');
        console.error('Login error:', error);
    }
}

async handleRegister() {
    const username = document.getElementById('registerUsername').value.trim();
    
    if (!username) {
        this.showNotification('Please enter a username', 'error');
        return;
    }

    if (username.length < 3) {
        this.showNotification('Username must be at least 3 characters long', 'error');
        return;
    }

    this.showLoading('Creating account...');

    try {
        const response = await fetch(`${BACKEND_URL}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username })
        });

        const data = await response.json();
        this.hideLoading();

        if (data.success) {
            this.currentUser = data.user;
            this.saveUserSession(data.user);
            this.showUserInfo(data.user);
            this.showNotification(data.message, 'success');
        } else {
            this.showNotification(data.error, 'error');
        }
    } catch (error) {
        this.hideLoading();
        this.showNotification('Connection error. Please try again.', 'error');
        console.error('Register error:', error);
    }
}

    saveUserSession(user) {
        localStorage.setItem('fileShareUser', JSON.stringify(user));
    }

    checkExistingSession() {
        const savedUser = localStorage.getItem('fileShareUser');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                this.showUserInfo(this.currentUser);
            } catch (error) {
                localStorage.removeItem('fileShareUser');
            }
        }
    }

    continueToFileTransfer() {
        if (this.currentUser) {
            // Pass user data to the main application
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            window.location.href = 'index1.html';
        }
    }

    showLoading(text = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = overlay.querySelector('.loading-text');
        loadingText.textContent = text;
        overlay.classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
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
}

// Initialize the authentication manager
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});