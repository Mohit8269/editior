// IndexedDB setup for video storage
let db;
const dbName = 'VideoEditorDB';
const storeName = 'videos';

// Open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

// Store video in IndexedDB
async function storeVideo(id, file) {
    try {
        if (!db) await openDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put({ id, file });
        console.log('Video stored:', id);
    } catch (error) {
        console.error('Error storing video:', error);
    }
}

// Retrieve video from IndexedDB
async function getVideo(id) {
    try {
        if (!db) await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result ? request.result.file : null);
            request.onerror = reject;
        });
    } catch (error) {
        console.error('Error retrieving video:', error);
        return null;
    }
}

// Delete video from IndexedDB
async function deleteVideoFromDB(id) {
    try {
        if (!db) await openDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.delete(id);
        console.log('Video deleted:', id);
    } catch (error) {
        console.error('Error deleting video:', error);
    }
}

// Load data from localStorage or initialize empty
let clients = JSON.parse(localStorage.getItem('clients')) || [];
let isOwner = localStorage.getItem('isOwner') === 'true';

// Function to save clients to localStorage
function saveClients() {
    localStorage.setItem('clients', JSON.stringify(clients));
}

// Function to load videos from IndexedDB and attach blob URLs
async function loadVideos() {
    console.log('Loading videos from IndexedDB...');
    for (const client of clients) {
        for (const folder of client.folders) {
            for (const video of folder.videos) {
                if (video.id) { // Only load if ID exists (skip old data)
                    const file = await getVideo(video.id);
                    if (file) {
                        video.blobUrl = URL.createObjectURL(file);
                    } else {
                        console.warn('Video file not found for ID:', video.id);
                    }
                } else {
                    console.warn('Old video without ID found, skipping:', video.name);
                }
            }
        }
    }
    console.log('Videos loaded.');
}

// Function to render clients (full access for owner)
function renderClients() {
    const clientList = document.getElementById('client-list');
    clientList.innerHTML = '';

    clients.forEach((client, clientIndex) => {
        const clientDiv = document.createElement('div');
        clientDiv.className = 'client';
        clientDiv.innerHTML = `
            <h3>${client.name} <button onclick="deleteClient(${clientIndex})" class="btn-delete">Delete Client</button></h3>
            <div class="folders">
                ${client.folders.map((folder, folderIndex) => `
                    <div class="folder">
                        <h4>${folder.name} <button onclick="deleteFolder(${clientIndex}, ${folderIndex})" class="btn-delete">Delete Folder</button></h4>
                        <div class="video-grid">
                            ${folder.videos.length > 0 ? folder.videos.map((video, videoIndex) => `
                                <div class="video-card ${video.isPortrait ? 'portrait' : ''}">
                                    <video class="video-player" controls>
                                        <source src="${video.blobUrl}" type="${video.type}">
                                        Your browser does not support the video tag.
                                    </video>
                                    <div class="video-meta">
                                        <strong>${video.name}</strong><br>
                                        Size: ${video.size} bytes<br>
                                        Date: ${video.date}
                                        <button onclick="deleteVideo(${clientIndex}, ${folderIndex}, ${videoIndex})" class="btn-delete">Delete Video</button>
                                    </div>
                                </div>
                            `).join('') : '<p>No videos yet—upload one below!</p>'}
                        </div>
                        <form class="upload-form" onsubmit="uploadVideo(event, ${clientIndex}, ${folderIndex})">
                            <input type="file" accept="video/*" required>
                            <input type="date" required>
                            <button type="submit" class="btn-primary">Upload Video</button>
                        </form>
                    </div>
                `).join('')}
            </div>
        `;
        clientList.appendChild(clientDiv);
    });
}

// Function to render videos for viewers (view-only)
function renderViewerVideos() {
    const viewerClientList = document.getElementById('viewer-client-list');
    viewerClientList.innerHTML = '';

    clients.forEach((client) => {
        const clientDiv = document.createElement('div');
        clientDiv.className = 'client';
        clientDiv.innerHTML = `
            <h3>${client.name}</h3>
            <div class="folders">
                ${client.folders.map((folder) => `
                    <div class="folder">
                        <h4>${folder.name}</h4>
                        <div class="video-grid">
                            ${folder.videos.length > 0 ? folder.videos.map((video) => `
                                <div class="video-card ${video.isPortrait ? 'portrait' : ''}">
                                    <video class="video-player" controls>
                                        <source src="${video.blobUrl}" type="${video.type}">
                                        Your browser does not support the video tag.
                                    </video>
                                    <div class="video-meta">
                                        <strong>${video.name}</strong><br>
                                        Size: ${video.size} bytes<br>
                                        Date: ${video.date}
                                    </div>
                                </div>
                            `).join('') : '<p>No videos available.</p>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        viewerClientList.appendChild(clientDiv);
    });
}

// Login function
function login() {
    console.log('Login attempted');
    const password = document.getElementById('password').value;
    const message = document.getElementById('login-message');
    if (password === 'admin') {
        isOwner = true;
        localStorage.setItem('isOwner', 'true');
        updateUI(); // This should now work
        message.textContent = '';
        console.log('Login successful');
    } else {
        message.textContent = 'Incorrect password.';
        console.log('Login failed: wrong password');
    }
}

// Logout function
function logout() {
    isOwner = false;
    localStorage.removeItem('isOwner');
    updateUI();
}

// Update UI based on login status
async function updateUI() {
    try {
        await loadVideos(); // Load videos from IndexedDB
        const loginForm = document.getElementById('login-form');
        const logoutBtn = document.getElementById('logout-btn');
        const heroButtons = document.getElementById('hero-buttons');
        const mainContent = document.getElementById('main-content');
        const viewerMessage = document.getElementById('viewer-message');
        const featuresSection = document.getElementById('features-section');

        if (isOwner) {
            loginForm.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
            heroButtons.style.display = 'flex';
            mainContent.style.display = 'block';
            viewerMessage.style.display = 'none';
            featuresSection.style.display = 'block';
            renderClients();
        } else {
            loginForm.style.display = 'block';
            logoutBtn.style.display = 'none';
            heroButtons.style.display = 'none';
            mainContent.style.display = 'none';
            viewerMessage.style.display = 'block';
            featuresSection.style.display = 'none';
            renderViewerVideos();
        }
        console.log('UI updated');
    } catch (error) {
        console.error('Error updating UI:', error);
        alert('An error occurred while loading the page. Please refresh and try again.');
    }
}

// Add a new client (only for owner)
document.getElementById('client-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!isOwner) return;
    const clientName = document.getElementById('client-name').value.trim();
    if (clientName) {
        const defaultFolder = { name: `${clientName} Videos`, videos: [] };
        clients.push({ name: clientName, folders: [defaultFolder] });
        saveClients();
        renderClients();
        document.getElementById('client-name').value = '';
    }
});

// Upload a video (only for owner, saves permanently in IndexedDB)
async function uploadVideo(e, clientIndex, folderIndex) {
    e.preventDefault();
    if (!isOwner) return;
    const fileInput = e.target.querySelector('input[type="file"]');
    const dateInput = e.target.querySelector('input[type="date"]');
    const file = fileInput.files[0];
    if (file && dateInput.value) {
        const videoId = `${clientIndex}-${folderIndex}-${Date.now()}`; // Unique ID
        await storeVideo(videoId, file); // Store in IndexedDB
        const blobUrl = URL.createObjectURL(file);
        const videoElement = document.createElement('video');
        videoElement.src = blobUrl;
        videoElement.addEventListener('loadedmetadata', function() {
            const isPortrait = this.videoHeight > this.videoWidth;
            const video = {
                id: videoId,
                name: file.name,
                size: file.size,
                date: dateInput.value,
                blobUrl: blobUrl,
                type: file.type,
                isPortrait: isPortrait
            };
            clients[clientIndex].folders[folderIndex].videos.push(video);
            clients[clientIndex].folders[folderIndex].videos.sort((a, b) => new Date(b.date) - new Date(a.date));
            saveClients();
            renderClients();
        });
    }
}

// Delete functions (only for owner, removes from IndexedDB)
async function deleteClient(clientIndex) {
    if (!isOwner) return;
    if (confirm('Are you sure you want to delete this client and all their folders/videos?')) {
        for (const folder of clients[clientIndex].folders) {
            for (const video of folder.videos) {
                if (video.id) await deleteVideoFromDB(video.id);
            }
        }
        clients.splice(clientIndex, 1);
        saveClients();
        renderClients();
    }
}

async function deleteFolder(clientIndex, folderIndex) {
    if (!isOwner) return;
    if (confirm('Are you sure you want to delete this folder and all its videos?')) {
        for (const video of clients[clientIndex].folders[folderIndex].videos) {
            if (video.id) await deleteVideoFromDB(video.id);
        }
        clients[clientIndex].folders.splice(folderIndex, 1);
        saveClients();
        renderClients();
    }
}

async function deleteVideo(clientIndex, folderIndex, videoIndex) {
    if (!isOwner) return;
    if (confirm('Are you sure you want to delete this video?')) {
        const video = clients[clientIndex].folders[folderIndex].videos[videoIndex];
        if (video.id) await deleteVideoFromDB(video.id);
        clients[clientIndex].folders[folderIndex].videos.splice(videoIndex, 1);
        saveClients();
        renderClients();
    }
}

// Initialize DB and UI
openDB().then(() => {
    updateUI();
}).catch((error) => {
    console.error('IndexedDB error:', error);
    alert('Video storage may not work properly. Please use a modern browser. The app will still work for basic features.');
    updateUI(); // Fallback
});
// ... (rest of the script remains the same)


// Hide Auth Section for Owner
function hideAuth() {
    document.getElementById('auth-section').style.display = 'none';
}

// ... (rest of the script remains the same)

// Toggle Auth Section Visibility on Logo Click
function toggleAuth() {
    const authSection = document.getElementById('auth-section');
    authSection.style.display = authSection.style.display === 'none' ? 'block' : 'none';
}

// Update UI based on login status
async function updateUI() {
    try {
        await loadVideos();
        const loginForm = document.getElementById('login-form');
        const ownerControls = document.getElementById('owner-controls');
        const heroButtons = document.getElementById('hero-buttons');
        const mainContent = document.getElementById('main-content');
        const viewerMessage = document.getElementById('viewer-message');
        const featuresSection = document.getElementById('features-section');

        if (isOwner) {
            loginForm.style.display = 'none';
            ownerControls.style.display = 'block';
            heroButtons.style.display = 'flex';
            mainContent.style.display = 'block';
            viewerMessage.style.display = 'none';
            featuresSection.style.display = 'block';
            renderClients();
        } else {
            loginForm.style.display = 'block';
            ownerControls.style.display = 'none';
            heroButtons.style.display = 'none';
            mainContent.style.display = 'none';
            viewerMessage.style.display = 'block';
            featuresSection.style.display = 'none';
            renderViewerVideos();
        }
        console.log('UI updated');
    } catch (error) {
        console.error('Error updating UI:', error);
        alert('An error occurred while loading the page. Please refresh and try again.');
    }
}

// ... (rest of the script remains the same)