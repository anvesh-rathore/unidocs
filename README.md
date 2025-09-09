# 📁 Unidocs

Unidocs is a web-based real-time file sharing and chat application built using **Node.js**, **Express**, and **Socket.IO**. It allows users to join chat rooms and share files instantly through a server-managed interface.

## 🚀 Features

- Real-time chat using Socket.IO
- Room-based architecture: join or create unique rooms
- File sharing (documents, images, etc.)
- Easy-to-use interface via the browser
- Server-side file handling and user tracking
<img width="946" height="540" alt="image" src="https://github.com/user-attachments/assets/f2aceabb-7b5a-40e1-99b5-33392616d14d" />

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express, Socket.IO
- **File Handling**: Multer (if used), native Node.js streams
- **Data Store**: JSON-based (e.g., `users.json`)

## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/anvesh-rathore/unidocs.git
   cd unidocs

Install dependencies

npm install


Start the server

node server.js


Open your browser and visit:
http://localhost:3000 (or the port specified in your server file)

🧠 How It Works

Users join by entering a username and room name.

Each room is isolated and users in that room can exchange messages and files.

Files are uploaded to the server and shared via download links in the chat.

The server maintains user and room data temporarily (stored in users.json or memory).

📁 Project Structure
unidocs/
├── public/            # Frontend files (HTML, CSS, JS)
├── uploads/           # Directory where uploaded files are stored
├── users.json         # Stores user and room data (temporary)
├── server.js          # Main server code (Express + Socket.IO)
├── package.json
└── README.md

📄 Future Improvements

Authentication and user profiles

File preview (e.g., image or PDF inline preview)

Room management and admin tools

Database integration (e.g., MongoDB or PostgreSQL)

🧑‍💻 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you’d like to change.


