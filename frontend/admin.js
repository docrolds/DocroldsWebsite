// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

console.log('Admin Dashboard - API URL:', API_URL);
let currentEditUserId = null;
let currentEditBeatId = null;


function getToken() {
    return localStorage.getItem('adminToken');
}

function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = 'login.html';
}

async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401 || response.status === 403) {
        logout();
        return;
    }

    return response;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    const user = JSON.parse(localStorage.getItem('adminUser'));
    if (user) {
        document.querySelector('.user-name').textContent = user.username;
        document.querySelector('.user-role').textContent = user.role;
        document.querySelector('.user-avatar').textContent = user.username.charAt(0).toUpperCase();
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });

    loadUsers();
    loadBeats();
    loadTeamMembers();
    loadCustomers();
    loadOrders();
});

function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');

    // Load metrics when switching to metrics section
    if (section === 'metrics') {
        loadMetrics();
    }
}

async function loadUsers() {
    try {
        const response = await fetchWithAuth(`${API_URL}/users`);
        const users = await response.json();
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td><span class="badge-role badge-${user.role}">${user.role}</span></td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" onclick="editUser(${user.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="deleteUser(${user.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function openAddUserModal() {
    currentEditUserId = null;
    document.getElementById('userModalTitle').textContent = 'Add User';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('password').required = true;
    document.getElementById('userModal').classList.add('show');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('show');
}

async function editUser(userId) {
    try {
        const response = await fetchWithAuth(`${API_URL}/users`);
        if (!response) return;

        const users = await response.json();
        const user = users.find(u => String(u.id) === String(userId));

        if (user) {
            currentEditUserId = userId;
            document.getElementById('userModalTitle').textContent = 'Edit User';
            document.getElementById('userId').value = user.id;
            document.getElementById('username').value = user.username;
            document.getElementById('email').value = user.email;
            document.getElementById('role').value = user.role;
            document.getElementById('password').required = false;
            document.getElementById('password').value = '';
            document.getElementById('userModal').classList.add('show');
        } else {
            alert('User not found');
        }
    } catch (error) {
        console.error('Error loading user:', error);
        alert('Error loading user: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const response = await fetchWithAuth(`${API_URL}/users/${userId}`, {
            method: 'DELETE'
        });

        if (!response) return; // Auth error handled by fetchWithAuth

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        alert('User deleted successfully');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user: ' + error.message);
    }
}

document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('userId').value;
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    const userData = { username, email, role };
    if (password) userData.password = password;

    try {
        let response;
        if (userId) {
            response = await fetchWithAuth(`${API_URL}/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(userData)
            });
        } else {
            response = await fetchWithAuth(`${API_URL}/users`, {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        }

        if (!response) return; // Auth error handled by fetchWithAuth

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        alert(userId ? 'User updated successfully' : 'User created successfully');
        closeUserModal();
        loadUsers();
    } catch (error) {
        console.error('Error saving user:', error);
        alert('Error saving user: ' + error.message);
    }
});

// Track currently playing audio for admin preview
let currentAdminAudio = null;
let currentPlayingBeatId = null;

async function loadBeats() {
    try {
        const response = await fetch(`${API_URL}/beats`);
        const beats = await response.json();

        // Filter out any beats without valid IDs
        const validBeats = beats.filter(beat => beat && beat.id);

        const tbody = document.getElementById('beatsTableBody');
        tbody.innerHTML = validBeats.map(beat => {
            const hasAudio = beat.audioFile ? true : false;
            const audioUrl = beat.audioFile ? `${API_URL.replace('/api', '')}${beat.audioFile}` : '';
            const soldBadge = beat.soldExclusively ? '<span class="badge-sold" style="margin-left: 8px;">SOLD</span>' : '';

            return `
            <tr${beat.soldExclusively ? ' style="opacity: 0.7; background: rgba(232, 54, 40, 0.05);"' : ''}>
                <td style="min-width: 280px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="action-btn beat-play-btn"
                            onclick="toggleBeatPreview('${beat.id}', '${audioUrl}')"
                            ${!hasAudio ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}
                            title="${hasAudio ? 'Play preview' : 'No audio file'}"
                            id="play-btn-${beat.id}">
                            <i class="fas fa-play" id="play-icon-${beat.id}"></i>
                        </button>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 500; margin-bottom: 4px;">${beat.title || '-'}${soldBadge}</div>
                            <div class="beat-progress-container" id="progress-container-${beat.id}" style="display: none;">
                                <div class="beat-progress-bar" onclick="seekBeat(event, '${beat.id}')">
                                    <div class="beat-progress-fill" id="progress-fill-${beat.id}"></div>
                                </div>
                                <span class="beat-time" id="beat-time-${beat.id}">0:00 / 0:00</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td>${beat.producedBy || '-'}</td>
                <td>${beat.genre || '-'}</td>
                <td>${beat.bpm || '-'}</td>
                <td>${beat.key || '-'}</td>
                <td>$${beat.price ? beat.price.toFixed(2) : '0.00'}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" onclick="editBeat('${beat.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="deleteBeat('${beat.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');
    } catch (error) {
        console.error('Error loading beats:', error);
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function toggleBeatPreview(beatId, audioUrl) {
    const playIcon = document.getElementById(`play-icon-${beatId}`);
    const progressContainer = document.getElementById(`progress-container-${beatId}`);

    // If clicking the same beat that's playing, pause it
    if (currentPlayingBeatId === beatId && currentAdminAudio && !currentAdminAudio.paused) {
        currentAdminAudio.pause();
        playIcon.classList.remove('fa-pause');
        playIcon.classList.add('fa-play');
        return;
    }

    // If clicking same beat that's paused, resume it
    if (currentPlayingBeatId === beatId && currentAdminAudio && currentAdminAudio.paused) {
        currentAdminAudio.play();
        playIcon.classList.remove('fa-play');
        playIcon.classList.add('fa-pause');
        return;
    }

    // Stop any currently playing audio and hide its progress bar
    if (currentAdminAudio) {
        currentAdminAudio.pause();
        if (currentPlayingBeatId) {
            const prevIcon = document.getElementById(`play-icon-${currentPlayingBeatId}`);
            const prevProgress = document.getElementById(`progress-container-${currentPlayingBeatId}`);
            if (prevIcon) {
                prevIcon.classList.remove('fa-pause');
                prevIcon.classList.add('fa-play');
            }
            if (prevProgress) {
                prevProgress.style.display = 'none';
            }
        }
    }

    // Create new audio and play
    currentAdminAudio = new Audio(audioUrl);
    currentPlayingBeatId = beatId;

    // Show progress bar
    if (progressContainer) {
        progressContainer.style.display = 'flex';
    }

    currentAdminAudio.addEventListener('timeupdate', () => {
        const progressFill = document.getElementById(`progress-fill-${beatId}`);
        const timeDisplay = document.getElementById(`beat-time-${beatId}`);
        if (progressFill && currentAdminAudio.duration) {
            const percent = (currentAdminAudio.currentTime / currentAdminAudio.duration) * 100;
            progressFill.style.width = `${percent}%`;
        }
        if (timeDisplay) {
            timeDisplay.textContent = `${formatTime(currentAdminAudio.currentTime)} / ${formatTime(currentAdminAudio.duration || 0)}`;
        }
    });

    currentAdminAudio.addEventListener('ended', () => {
        playIcon.classList.remove('fa-pause');
        playIcon.classList.add('fa-play');
        const progressFill = document.getElementById(`progress-fill-${beatId}`);
        if (progressFill) progressFill.style.width = '0%';
        currentPlayingBeatId = null;
    });

    currentAdminAudio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        alert('Error playing audio file');
        playIcon.classList.remove('fa-pause');
        playIcon.classList.add('fa-play');
        if (progressContainer) progressContainer.style.display = 'none';
    });

    currentAdminAudio.play().then(() => {
        playIcon.classList.remove('fa-play');
        playIcon.classList.add('fa-pause');
    }).catch(err => {
        console.error('Play error:', err);
        alert('Error playing audio');
    });
}

function seekBeat(event, beatId) {
    if (!currentAdminAudio || currentPlayingBeatId !== beatId) return;

    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percent = clickX / rect.width;
    const newTime = percent * currentAdminAudio.duration;

    if (!isNaN(newTime)) {
        currentAdminAudio.currentTime = newTime;
    }
}

window.toggleBeatPreview = toggleBeatPreview;
window.seekBeat = seekBeat;

function openAddBeatModal() {
    currentEditBeatId = null;
    document.getElementById('beatModalTitle').textContent = 'Add Beat';
    document.getElementById('beatForm').reset();
    document.getElementById('beatId').value = '';
    document.getElementById('beatSoldExclusively').checked = false;
    document.getElementById('beatSoldExclusivelyTo').value = '';
    document.getElementById('soldExclusivelyToGroup').style.display = 'none';
    document.getElementById('beatModal').classList.add('show');
}

// Toggle visibility of "Sold To" field when checkbox changes
document.getElementById('beatSoldExclusively')?.addEventListener('change', function() {
    document.getElementById('soldExclusivelyToGroup').style.display = this.checked ? 'block' : 'none';
});

function closeBeatModal() {
    document.getElementById('beatModal').classList.remove('show');
}

async function editBeat(beatId) {
    try {
        const response = await fetch(`${API_URL}/beats`);
        const beats = await response.json();
        const beat = beats.find(b => String(b.id) === String(beatId));

        if (beat) {
            currentEditBeatId = beatId;
            document.getElementById('beatModalTitle').textContent = 'Edit Beat';
            document.getElementById('beatId').value = beat.id;
            document.getElementById('beatTitle').value = beat.title;
            document.getElementById('beatGenre').value = beat.genre;
            document.getElementById('beatCategory').value = beat.category;
            document.getElementById('beatBpm').value = beat.bpm;
            document.getElementById('beatKey').value = beat.key;
            document.getElementById('beatDuration').value = beat.duration;
            document.getElementById('beatPrice').value = beat.price;
            document.getElementById('beatProducedBy').value = beat.producedBy || '';
            document.getElementById('beatSoldExclusively').checked = beat.soldExclusively || false;
            document.getElementById('beatSoldExclusivelyTo').value = beat.soldExclusivelyTo || '';
            document.getElementById('soldExclusivelyToGroup').style.display = beat.soldExclusively ? 'block' : 'none';
            document.getElementById('beatModal').classList.add('show');
        }
    } catch (error) {
        console.error('Error loading beat:', error);
    }
}

async function deleteBeat(beatId) {
    // Validate beatId before proceeding
    if (!beatId || beatId === 'undefined' || beatId === 'null') {
        alert('Error: Invalid beat ID');
        console.error('deleteBeat called with invalid ID:', beatId);
        return;
    }

    if (!confirm('Are you sure you want to delete this beat?')) return;

    try {
        const response = await fetchWithAuth(`${API_URL}/beats/${beatId}`, {
            method: 'DELETE'
        });

        if (!response) return; // Auth error handled by fetchWithAuth

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        alert('Beat deleted successfully');
        loadBeats();
    } catch (error) {
        console.error('Error deleting beat:', error);
        alert('Error deleting beat: ' + error.message);
    }
}

document.getElementById('beatForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const beatId = document.getElementById('beatId').value;
    const formData = new FormData();

    const producedByValue = document.getElementById('beatProducedBy').value;
    console.log('[BEAT FORM] Produced By value:', producedByValue);

    formData.append('title', document.getElementById('beatTitle').value);
    formData.append('genre', document.getElementById('beatGenre').value);
    formData.append('category', document.getElementById('beatCategory').value);
    formData.append('bpm', document.getElementById('beatBpm').value);
    formData.append('key', document.getElementById('beatKey').value);
    formData.append('duration', document.getElementById('beatDuration').value);
    formData.append('price', document.getElementById('beatPrice').value);
    formData.append('producedBy', producedByValue);
    formData.append('soldExclusively', document.getElementById('beatSoldExclusively').checked ? 'true' : 'false');
    formData.append('soldExclusivelyTo', document.getElementById('beatSoldExclusivelyTo').value || '');

    // Debug: Log all form data
    console.log('[BEAT FORM] FormData entries:');
    for (let [key, value] of formData.entries()) {
        console.log(`  ${key}: ${value}`);
    }

    const audioFile = document.getElementById('beatAudioFile').files[0];
    if (audioFile) {
        formData.append('audioFile', audioFile);
    }

    const wavFile = document.getElementById('beatWavFile').files[0];
    if (wavFile) {
        formData.append('wavFile', wavFile);
    }

    const coverArt = document.getElementById('beatCoverArt').files[0];
    if (coverArt) {
        formData.append('coverArt', coverArt);
    }

    try {
        if (beatId) {
            await fetchWithAuth(`${API_URL}/beats/${beatId}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            await fetchWithAuth(`${API_URL}/beats`, {
                method: 'POST',
                body: formData
            });
        }
        
        closeBeatModal();
        loadBeats();
    } catch (error) {
        console.error('Error saving beat:', error);
        alert('Error saving beat');
    }
});

let teamMembers = [];
let currentEditTeamMemberId = null;
let currentTeamCredits = [];
let currentTeamPlacements = [];

async function loadTeamMembers() {
    try {
        const response = await fetch(`${API_URL}/photos`);
        const photos = await response.json();
        teamMembers = photos.filter(photo => photo.category === 'team');
        
        const teamGrid = document.getElementById('teamGrid');
        teamGrid.innerHTML = '';
        
        const addCard = document.createElement('div');
        addCard.className = 'team-card';
        addCard.onclick = () => openAddTeamMemberModal();
        addCard.innerHTML = `
            <div class="team-card-add">+</div>
            <div class="team-card-add-text">Add Team Member</div>
        `;
        teamGrid.appendChild(addCard);
        
        teamMembers.forEach(member => {
            const card = document.createElement('div');
            card.className = 'team-card-member';
            
            const creditsArray = typeof member.credits === 'string' ? JSON.parse(member.credits) : (Array.isArray(member.credits) ? member.credits : []);
            const creditsHTML = creditsArray.map(c => `<span class="team-member-credit-tag">${c}</span>`).join('');
            
            let rolesArray = [];
            if (typeof member.role === 'string') {
                try {
                    rolesArray = JSON.parse(member.role);
                } catch {
                    rolesArray = [member.role];
                }
            } else if (Array.isArray(member.role)) {
                rolesArray = member.role;
            } else {
                rolesArray = [member.role];
            }
            const rolesHTML = rolesArray.map(r => {
                return `<div style="font-size: 0.85rem; color: #ccc;">${r}</div>`;
            }).join('');
            
            card.innerHTML = `
                <div class="team-member-photo" style="position: relative;">
                    <img src="${member.photoData || `${API_URL.replace('/api', '')}/${member.photoFile}`}" alt="${member.name}" onerror="this.parentElement.style.background='linear-gradient(135deg, #E83628, #c41e1e)'">
                    <div onclick="toggleTeamMemberVisibility('${member.id}')" style="position: absolute; top: 8px; right: 8px; background: ${member.displayOnHome ? '#E83628' : 'rgba(0,0,0,0.5)'}; color: ${member.displayOnHome ? 'white' : '#999'}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer;" title="${member.displayOnHome ? 'Visible on Home Page' : 'Hidden from Home Page'}"><i class="fas fa-${member.displayOnHome ? 'eye' : 'eye-slash'}"></i></div>
                </div>
                <div class="team-member-info">
                    <div class="team-member-name">${member.name}</div>
                    <div class="team-member-role">${rolesHTML}</div>
                    <div class="team-member-credits">${creditsHTML}</div>
                </div>
                <div class="team-card-actions">
                    <button class="team-card-action-btn" onclick="editTeamMember('${member.id}')">Edit</button>
                    <button class="team-card-action-btn" onclick="deleteTeamMember('${member.id}')">Delete</button>
                </div>
            `;
            teamGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading team members:', error);
    }
}

function openAddTeamMemberModal() {
    currentEditTeamMemberId = null;
    currentTeamCredits = [];
    currentTeamPlacements = [];
    document.getElementById('teamMemberModalTitle').textContent = 'Add Team Member';
    document.getElementById('teamMemberForm').reset();
    document.getElementById('teamMemberId').value = '';
    document.getElementById('teamMemberPhotoPath').value = '';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('dragZoneContent').style.display = 'block';
    document.getElementById('creditsList').innerHTML = '';
    document.getElementById('placementsList').innerHTML = '';
    document.getElementById('displayOnHome').checked = false;

    document.getElementById('roleProducer').checked = false;
    document.getElementById('roleArtist').checked = false;
    document.getElementById('roleManager').checked = false;
    document.getElementById('roleEngineer').checked = false;
    document.getElementById('roleOther').checked = false;
    document.getElementById('customRoleInput').value = '';
    document.getElementById('customRoleInput').style.display = 'none';

    document.getElementById('teamMemberModal').classList.add('show');
    setupDragAndDrop();
}

function closeTeamMemberModal() {
    document.getElementById('teamMemberModal').classList.remove('show');
}

function toggleCustomRole() {
    const customInput = document.getElementById('customRoleInput');
    const roleOtherCheckbox = document.getElementById('roleOther');
    if (roleOtherCheckbox.checked) {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
    }
}

async function toggleTeamMemberVisibility(memberId) {
    const member = teamMembers.find(m => String(m.id) === String(memberId));
    if (!member) return;
    
    const newVisibility = !member.displayOnHome;
    const formData = new FormData();
    formData.append('displayOnHome', newVisibility ? 'true' : 'false');
    
    try {
        await fetchWithAuth(`${API_URL}/photos/${memberId}`, {
            method: 'PUT',
            body: formData
        });
        loadTeamMembers();
    } catch (error) {
        console.error('Error toggling visibility:', error);
        alert('Error toggling visibility');
    }
}

async function editTeamMember(memberId) {
    const member = teamMembers.find(m => String(m.id) === String(memberId));
    if (!member) {
        alert('Team member not found');
        return;
    }
    
    currentEditTeamMemberId = memberId;
    currentTeamCredits = typeof member.credits === 'string' ? JSON.parse(member.credits) : (Array.isArray(member.credits) ? member.credits : []);
    currentTeamPlacements = typeof member.placements === 'string' ? JSON.parse(member.placements) : (Array.isArray(member.placements) ? member.placements : []);
    
    document.getElementById('teamMemberModalTitle').textContent = 'Edit Team Member';
    document.getElementById('teamMemberId').value = member.id;
    document.getElementById('teamMemberPhotoPath').value = member.photoFile;
    document.getElementById('teamMemberName').value = member.name;

    document.getElementById('roleProducer').checked = false;
    document.getElementById('roleArtist').checked = false;
    document.getElementById('roleManager').checked = false;
    document.getElementById('roleEngineer').checked = false;
    document.getElementById('roleOther').checked = false;
    document.getElementById('customRoleInput').value = '';
    document.getElementById('customRoleInput').style.display = 'none';

    let roles = [];
    if (typeof member.role === 'string') {
        try {
            roles = JSON.parse(member.role);
        } catch {
            roles = [member.role];
        }
    } else if (Array.isArray(member.role)) {
        roles = member.role;
    } else {
        roles = [member.role];
    }

    roles.forEach(role => {
        if (role === 'producer') document.getElementById('roleProducer').checked = true;
        else if (role === 'artist') document.getElementById('roleArtist').checked = true;
        else if (role === 'manager') document.getElementById('roleManager').checked = true;
        else if (role === 'engineer') document.getElementById('roleEngineer').checked = true;
        else {
            document.getElementById('roleOther').checked = true;
            document.getElementById('customRoleInput').value = role;
            document.getElementById('customRoleInput').style.display = 'block';
        }
    });
    
    document.getElementById('teamMemberBio').value = member.description || '';
    document.getElementById('displayOnHome').checked = member.displayOnHome || false;

    // Reset file input so new photo can be selected
    document.getElementById('teamMemberPhoto').value = '';

    const photoPreview = document.getElementById('photoPreview');
    photoPreview.src = member.photoData || `${API_URL.replace('/api', '')}/${member.photoFile}`;
    photoPreview.style.display = 'block';
    document.getElementById('dragZoneContent').style.display = 'none';

    document.getElementById('creditsList').innerHTML = '';
    currentTeamCredits.forEach(credit => addCreditTag(credit));

    document.getElementById('placementsList').innerHTML = '';
    currentTeamPlacements.forEach(placement => addPlacementTag(placement));

    document.getElementById('teamMemberModal').classList.add('show');
    setupDragAndDrop();
}

async function deleteTeamMember(memberId) {
    if (!confirm('Are you sure you want to delete this team member?')) return;

    try {
        const response = await fetchWithAuth(`${API_URL}/photos/${memberId}`, {
            method: 'DELETE'
        });

        if (!response) return; // Auth error handled by fetchWithAuth

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        alert('Team member deleted successfully');
        loadTeamMembers();
    } catch (error) {
        console.error('Error deleting team member:', error);
        alert('Error deleting team member: ' + error.message);
    }
}

let dragDropInitialized = false;

function setupDragAndDrop() {
    const dragZone = document.getElementById('dragZone');
    const photoInput = document.getElementById('teamMemberPhoto');

    // Reset the file input to allow re-selecting the same file
    photoInput.value = '';

    // Only add event listeners once
    if (dragDropInitialized) return;
    dragDropInitialized = true;

    dragZone.addEventListener('click', () => photoInput.click());

    dragZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragZone.classList.add('drag-over');
    });

    dragZone.addEventListener('dragleave', () => {
        dragZone.classList.remove('drag-over');
    });

    dragZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dragZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            photoInput.files = files;
            handlePhotoSelect(files[0]);
        }
    });

    photoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlePhotoSelect(e.target.files[0]);
        }
    });
}

function handlePhotoSelect(file) {
    console.log('Photo selected:', file.name, file.size, 'bytes', file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
        const photoPreview = document.getElementById('photoPreview');
        photoPreview.src = e.target.result;
        photoPreview.style.display = 'block';
        document.getElementById('dragZoneContent').style.display = 'none';
        console.log('Photo preview updated');
    };
    reader.readAsDataURL(file);
}

document.getElementById('creditInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const creditInput = document.getElementById('creditInput');
        const credit = creditInput.value.trim();
        if (credit) {
            addCreditTag(credit);
            creditInput.value = '';
        }
    }
});

function addCreditTag(credit) {
    if (!currentTeamCredits.includes(credit)) {
        currentTeamCredits.push(credit);
    }
    
    const creditsList = document.getElementById('creditsList');
    creditsList.innerHTML = currentTeamCredits.map(c => `
        <div class="credits-tag">
            ${c}
            <button type="button" class="credits-tag-remove" onclick="removeCredit('${c}')">×</button>
        </div>
    `).join('');
}

function removeCredit(credit) {
    currentTeamCredits = currentTeamCredits.filter(c => c !== credit);
    const creditsList = document.getElementById('creditsList');
    creditsList.innerHTML = currentTeamCredits.map(c => `
        <div class="credits-tag">
            ${c}
            <button type="button" class="credits-tag-remove" onclick="removeCredit('${c}')">×</button>
        </div>
    `).join('');
}

// Placements input handler
document.getElementById('placementInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const placementInput = document.getElementById('placementInput');
        const placement = placementInput.value.trim();
        if (placement) {
            addPlacementTag(placement);
            placementInput.value = '';
        }
    }
});

function addPlacementTag(placement) {
    if (!currentTeamPlacements.includes(placement)) {
        currentTeamPlacements.push(placement);
    }

    const placementsList = document.getElementById('placementsList');
    placementsList.innerHTML = currentTeamPlacements.map(p => `
        <div class="credits-tag" style="background: rgba(76, 175, 80, 0.2); border-color: rgba(76, 175, 80, 0.4);">
            ${p}
            <button type="button" class="credits-tag-remove" onclick="removePlacement('${p.replace(/'/g, "\\'")}')" style="color: #4CAF50;">×</button>
        </div>
    `).join('');
}

function removePlacement(placement) {
    currentTeamPlacements = currentTeamPlacements.filter(p => p !== placement);
    const placementsList = document.getElementById('placementsList');
    placementsList.innerHTML = currentTeamPlacements.map(p => `
        <div class="credits-tag" style="background: rgba(76, 175, 80, 0.2); border-color: rgba(76, 175, 80, 0.4);">
            ${p}
            <button type="button" class="credits-tag-remove" onclick="removePlacement('${p.replace(/'/g, "\\'")}')" style="color: #4CAF50;">×</button>
        </div>
    `).join('');
}

document.getElementById('teamMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const memberId = document.getElementById('teamMemberId').value;
    const formData = new FormData();

    formData.append('name', document.getElementById('teamMemberName').value);

    const selectedRoles = [];
    if (document.getElementById('roleProducer').checked) selectedRoles.push('producer');
    if (document.getElementById('roleArtist').checked) selectedRoles.push('artist');
    if (document.getElementById('roleManager').checked) selectedRoles.push('manager');
    if (document.getElementById('roleEngineer').checked) selectedRoles.push('engineer');
    if (document.getElementById('roleOther').checked) {
        const customRole = document.getElementById('customRoleInput').value;
        if (customRole) selectedRoles.push(customRole);
    }

    formData.append('role', JSON.stringify(selectedRoles));
    formData.append('category', 'team');
    formData.append('credits', JSON.stringify(currentTeamCredits));
    formData.append('placements', JSON.stringify(currentTeamPlacements));
    formData.append('description', document.getElementById('teamMemberBio').value);
    formData.append('displayOnHome', document.getElementById('displayOnHome').checked ? 'true' : 'false');

    const photoFile = document.getElementById('teamMemberPhoto').files[0];
    if (photoFile) {
        formData.append('photoFile', photoFile);
        console.log('Uploading new photo:', photoFile.name, photoFile.size, 'bytes');
    } else {
        console.log('No new photo selected');
    }

    try {
        let response;
        if (memberId) {
            console.log('Updating team member:', memberId);
            response = await fetchWithAuth(`${API_URL}/photos/${memberId}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            console.log('Creating new team member');
            response = await fetchWithAuth(`${API_URL}/photos`, {
                method: 'POST',
                body: formData
            });
        }

        if (!response) return; // Auth error handled by fetchWithAuth

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Server response:', result.photoData ? 'Photo data received' : 'No photo data in response');

        alert(memberId ? 'Team member updated successfully' : 'Team member added successfully');
        closeTeamMemberModal();
        loadTeamMembers();
    } catch (error) {
        console.error('Error saving team member:', error);
        alert('Error saving team member: ' + error.message);
    }
});

// ============================================
// CUSTOMERS TAB FUNCTIONALITY
// ============================================

let customers = [];

async function loadCustomers() {
    try {
        const response = await fetchWithAuth(`${API_URL}/admin/customers`);
        if (!response) return;

        customers = await response.json();

        const tbody = document.getElementById('customersTableBody');
        if (!tbody) return;

        tbody.innerHTML = customers.map(customer => `
            <tr>
                <td>${customer.email}</td>
                <td>${customer.firstName || ''} ${customer.lastName || ''}</td>
                <td>${customer.stageName || '-'}</td>
                <td>${customer._count?.orders || 0}</td>
                <td>${new Date(customer.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="viewAsCustomer('${customer.id}')">
                            <i class="fas fa-eye"></i>
                            View As
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading customers:', error);
        alert('Error loading customers');
    }
}

async function viewAsCustomer(customerId) {
    try {
        const response = await fetchWithAuth(`${API_URL}/admin/customers/${customerId}/impersonate`, {
            method: 'POST'
        });

        if (!response) return;

        const data = await response.json();

        if (data.token) {
            // Open new tab with the main site, passing the customer token
            const baseUrl = window.location.origin;
            const customerUrl = `${baseUrl}/index.html?impersonate=${encodeURIComponent(data.token)}`;
            window.open(customerUrl, '_blank');
        } else {
            alert('Failed to get customer session');
        }
    } catch (error) {
        console.error('Error impersonating customer:', error);
        alert('Error viewing as customer');
    }
}

// ============================================
// ORDERS TAB FUNCTIONALITY
// ============================================

let orders = [];
let filteredOrders = [];

async function loadOrders() {
    try {
        const response = await fetchWithAuth(`${API_URL}/admin/orders`);
        if (!response) return;

        orders = await response.json();
        filteredOrders = orders;
        renderOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        alert('Error loading orders');
    }
}

function filterOrders() {
    const statusFilter = document.getElementById('orderStatusFilter')?.value || '';
    const paymentFilter = document.getElementById('orderPaymentFilter')?.value || '';

    filteredOrders = orders.filter(order => {
        const statusMatch = !statusFilter || order.status === statusFilter;
        const paymentMatch = !paymentFilter || order.paymentStatus === paymentFilter;
        return statusMatch && paymentMatch;
    });

    renderOrders();
}

function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (filteredOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #888;">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = filteredOrders.map(order => {
        const customerName = order.customer?.isGuest
            ? `${order.customer.firstName || ''} ${order.customer.lastName || ''} <span style="color: #888; font-size: 0.75rem;">(Guest)</span>`
            : `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`;
        const customerEmail = order.customer?.email || 'Unknown';
        const itemCount = order.items?.length || 0;
        const itemsPreview = order.items?.map(i => i.beat?.title).slice(0, 2).join(', ') || '-';
        const moreItems = itemCount > 2 ? ` +${itemCount - 2} more` : '';

        const paymentBadgeClass = {
            'PAID': 'badge-paid',
            'PENDING': 'badge-pending',
            'FAILED': 'badge-failed',
            'REFUNDED': 'badge-refunded'
        }[order.paymentStatus] || 'badge-pending';

        const statusBadgeClass = {
            'COMPLETED': 'badge-completed',
            'PENDING': 'badge-pending',
            'CANCELLED': 'badge-cancelled'
        }[order.status] || 'badge-pending';

        return `
            <tr>
                <td><strong>${order.orderNumber}</strong></td>
                <td>
                    <div>${customerName}</div>
                    <div style="font-size: 0.75rem; color: #888;">${customerEmail}</div>
                </td>
                <td>
                    <div style="font-size: 0.85rem;">${itemsPreview}${moreItems}</div>
                    <div style="font-size: 0.75rem; color: #888;">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
                </td>
                <td><strong>$${order.total?.toFixed(2) || '0.00'}</strong></td>
                <td><span class="badge-status ${paymentBadgeClass}">${order.paymentStatus}</span></td>
                <td><span class="badge-status ${statusBadgeClass}">${order.status}</span></td>
                <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" onclick="viewOrder('${order.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn" onclick="resendOrderEmail('${order.id}')" title="Resend Download Email">
                            <i class="fas fa-envelope"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function viewOrder(orderId) {
    try {
        const response = await fetchWithAuth(`${API_URL}/admin/orders/${orderId}`);
        if (!response) return;

        const order = await response.json();

        const customerInfo = order.customer?.isGuest
            ? `${order.customer.firstName || ''} ${order.customer.lastName || ''} (Guest)`
            : `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`;

        const itemsHTML = order.items?.map(item => `
            <tr>
                <td>${item.beat?.title || 'Unknown Beat'}</td>
                <td>${item.licenseName || '-'}</td>
                <td>$${item.price?.toFixed(2) || '0.00'}</td>
            </tr>
        `).join('') || '<tr><td colspan="3">No items</td></tr>';

        const downloadExpiry = order.downloadExpiresAt
            ? new Date(order.downloadExpiresAt).toLocaleDateString()
            : 'N/A';
        const isExpired = order.downloadExpiresAt && new Date(order.downloadExpiresAt) < new Date();

        document.getElementById('orderDetails').innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <h3 style="color: #E83628; margin-bottom: 10px;">Order Info</h3>
                    <p><strong>Order #:</strong> ${order.orderNumber}</p>
                    <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                    <p><strong>Status:</strong> <span class="badge-status badge-${order.status?.toLowerCase()}">${order.status}</span></p>
                    <p><strong>Payment:</strong> <span class="badge-status badge-${order.paymentStatus?.toLowerCase()}">${order.paymentStatus}</span></p>
                </div>
                <div>
                    <h3 style="color: #E83628; margin-bottom: 10px;">Customer</h3>
                    <p><strong>Name:</strong> ${customerInfo}</p>
                    <p><strong>Email:</strong> ${order.customer?.email || 'Unknown'}</p>
                    <p><strong>Download Expires:</strong> ${downloadExpiry} ${isExpired ? '<span style="color: #E83628;">(Expired)</span>' : ''}</p>
                </div>
            </div>

            <h3 style="color: #E83628; margin-bottom: 10px;">Items</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #222;">
                        <th style="padding: 10px; text-align: left;">Beat</th>
                        <th style="padding: 10px; text-align: left;">License</th>
                        <th style="padding: 10px; text-align: left;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                    <tr style="border-top: 2px solid #E83628;">
                        <td colspan="2" style="padding: 10px; text-align: right;"><strong>Total:</strong></td>
                        <td style="padding: 10px;"><strong>$${order.total?.toFixed(2) || '0.00'}</strong></td>
                    </tr>
                </tbody>
            </table>

            ${order.stripePaymentId ? `<p style="font-size: 0.8rem; color: #888;"><strong>Stripe Payment ID:</strong> ${order.stripePaymentId}</p>` : ''}
            ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}

            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn btn-primary" onclick="resendOrderEmail('${order.id}')">
                    <i class="fas fa-envelope"></i> Resend Download Email
                </button>
                ${isExpired || order.paymentStatus === 'PAID' ? `
                    <button class="btn" onclick="extendDownload('${order.id}')">
                        <i class="fas fa-clock"></i> Extend Download (7 days)
                    </button>
                ` : ''}
                <a href="https://dashboard.stripe.com/payments/${order.stripePaymentId}" target="_blank" class="btn" style="text-decoration: none;">
                    <i class="fas fa-external-link-alt"></i> View in Stripe
                </a>
            </div>
        `;

        document.getElementById('orderModalTitle').textContent = `Order #${order.orderNumber}`;
        document.getElementById('orderModal').classList.add('show');
    } catch (error) {
        console.error('Error loading order:', error);
        alert('Error loading order details: ' + error.message);
    }
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('show');
}

async function resendOrderEmail(orderId) {
    if (!confirm('Resend the download email to the customer?')) return;

    try {
        const response = await fetchWithAuth(`${API_URL}/admin/orders/${orderId}/resend-email`, {
            method: 'POST'
        });

        if (!response) return;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        alert('Download email sent successfully!');
    } catch (error) {
        console.error('Error resending email:', error);
        alert('Error sending email: ' + error.message);
    }
}

async function extendDownload(orderId) {
    if (!confirm('Extend the download link by 7 days?')) return;

    try {
        const response = await fetchWithAuth(`${API_URL}/admin/orders/${orderId}`, {
            method: 'PUT',
            body: JSON.stringify({ extendDownload: true })
        });

        if (!response) return;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        alert('Download link extended by 7 days!');
        viewOrder(orderId); // Refresh the modal
        loadOrders(); // Refresh the list
    } catch (error) {
        console.error('Error extending download:', error);
        alert('Error extending download: ' + error.message);
    }
}

// ============================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// (Required for onclick handlers in HTML)
// ============================================

window.logout = logout;
window.openAddUserModal = openAddUserModal;
window.closeUserModal = closeUserModal;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.openAddBeatModal = openAddBeatModal;
window.closeBeatModal = closeBeatModal;
window.editBeat = editBeat;
window.deleteBeat = deleteBeat;
window.openAddTeamMemberModal = openAddTeamMemberModal;
window.closeTeamMemberModal = closeTeamMemberModal;
window.editTeamMember = editTeamMember;
window.deleteTeamMember = deleteTeamMember;
window.toggleTeamMemberVisibility = toggleTeamMemberVisibility;
window.toggleCustomRole = toggleCustomRole;
window.removeCredit = removeCredit;
window.removePlacement = removePlacement;
window.loadCustomers = loadCustomers;
window.viewAsCustomer = viewAsCustomer;
window.loadOrders = loadOrders;
window.filterOrders = filterOrders;
window.viewOrder = viewOrder;
window.closeOrderModal = closeOrderModal;
window.resendOrderEmail = resendOrderEmail;
window.extendDownload = extendDownload;
window.loadMetrics = loadMetrics;

// ===== METRICS SECTION =====
let ordersChart = null;
let statusChart = null;

async function loadMetrics() {
    const period = document.getElementById('metricsPeriodFilter')?.value || '30d';

    try {
        const response = await fetchWithAuth(`${API_URL}/admin/metrics/orders?period=${period}`);
        if (!response) return;

        const data = await response.json();

        // Update summary cards
        document.getElementById('metricsTotalOrders').textContent = data.totalOrders || 0;
        document.getElementById('metricsTotalRevenue').textContent = `$${(data.totalRevenue || 0).toFixed(2)}`;
        document.getElementById('metricsCompletedOrders').textContent = data.completedOrders || 0;
        document.getElementById('metricsAvgOrderValue').textContent = `$${(data.avgOrderValue || 0).toFixed(2)}`;

        // Update charts
        renderOrdersChart(data.ordersOverTime || []);
        renderStatusChart(data.ordersByStatus || {});

    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

function renderOrdersChart(ordersOverTime) {
    const ctx = document.getElementById('ordersChart');
    if (!ctx) return;

    // Destroy existing chart
    if (ordersChart) {
        ordersChart.destroy();
    }

    // Prepare data
    const labels = ordersOverTime.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const counts = ordersOverTime.map(d => d.count);
    const revenue = ordersOverTime.map(d => d.revenue);

    ordersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Orders',
                    data: counts,
                    borderColor: '#E83628',
                    backgroundColor: 'rgba(232, 54, 40, 0.1)',
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Revenue ($)',
                    data: revenue,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: false,
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#9ca3af'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#6b7280' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: { color: '#6b7280' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: {
                        display: true,
                        text: 'Orders',
                        color: '#9ca3af'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    ticks: {
                        color: '#6b7280',
                        callback: (value) => '$' + value
                    },
                    grid: { drawOnChartArea: false },
                    title: {
                        display: true,
                        text: 'Revenue',
                        color: '#9ca3af'
                    }
                }
            }
        }
    });
}

function renderStatusChart(ordersByStatus) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    // Destroy existing chart
    if (statusChart) {
        statusChart.destroy();
    }

    const labels = Object.keys(ordersByStatus);
    const counts = Object.values(ordersByStatus);

    // Status colors
    const colors = {
        'PAID': '#22c55e',
        'PENDING': '#eab308',
        'FAILED': '#ef4444',
        'REFUNDED': '#a855f7',
        'COMPLETED': '#22c55e',
        'CANCELLED': '#ef4444'
    };

    const backgroundColors = labels.map(label => colors[label] || '#6b7280');

    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: counts,
                backgroundColor: backgroundColors,
                borderColor: '#1a1f26',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        padding: 15,
                        usePointStyle: true
                    }
                }
            },
            cutout: '60%'
        }
    });
}

