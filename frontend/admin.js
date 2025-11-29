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
        const users = await response.json();
        const user = users.find(u => u.id === userId);
        
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
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        await fetchWithAuth(`${API_URL}/users/${userId}`, {
            method: 'DELETE'
        });
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
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
        if (userId) {
            await fetchWithAuth(`${API_URL}/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(userData)
            });
        } else {
            await fetchWithAuth(`${API_URL}/users`, {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        }
        
        closeUserModal();
        loadUsers();
    } catch (error) {
        console.error('Error saving user:', error);
        alert('Error saving user');
    }
});

async function loadBeats() {
    try {
        const response = await fetch(`${API_URL}/beats`);
        const beats = await response.json();
        
        const tbody = document.getElementById('beatsTableBody');
        tbody.innerHTML = beats.map(beat => `
            <tr>
                <td>${beat.title}</td>
                <td>${beat.genre}</td>
                <td>${beat.bpm}</td>
                <td>${beat.key}</td>
                <td>$${beat.price.toFixed(2)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" onclick="editBeat(${beat.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="deleteBeat(${beat.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading beats:', error);
    }
}

function openAddBeatModal() {
    currentEditBeatId = null;
    document.getElementById('beatModalTitle').textContent = 'Add Beat';
    document.getElementById('beatForm').reset();
    document.getElementById('beatId').value = '';
    document.getElementById('beatModal').classList.add('show');
}

function closeBeatModal() {
    document.getElementById('beatModal').classList.remove('show');
}

async function editBeat(beatId) {
    try {
        const response = await fetch(`${API_URL}/beats`);
        const beats = await response.json();
        const beat = beats.find(b => b.id === beatId);
        
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
            document.getElementById('beatModal').classList.add('show');
        }
    } catch (error) {
        console.error('Error loading beat:', error);
    }
}

async function deleteBeat(beatId) {
    if (!confirm('Are you sure you want to delete this beat?')) return;

    try {
        await fetchWithAuth(`${API_URL}/beats/${beatId}`, {
            method: 'DELETE'
        });
        loadBeats();
    } catch (error) {
        console.error('Error deleting beat:', error);
    }
}

document.getElementById('beatForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const beatId = document.getElementById('beatId').value;
    const formData = new FormData();
    
    formData.append('title', document.getElementById('beatTitle').value);
    formData.append('genre', document.getElementById('beatGenre').value);
    formData.append('category', document.getElementById('beatCategory').value);
    formData.append('bpm', document.getElementById('beatBpm').value);
    formData.append('key', document.getElementById('beatKey').value);
    formData.append('duration', document.getElementById('beatDuration').value);
    formData.append('price', document.getElementById('beatPrice').value);
    
    const audioFile = document.getElementById('beatAudioFile').files[0];
    if (audioFile) {
        formData.append('audioFile', audioFile);
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
                    <img src="${member.photoFile}" alt="${member.name}" onerror="this.parentElement.style.background='linear-gradient(135deg, #E83628, #c41e1e)'">
                    <div onclick="toggleTeamMemberVisibility(${member.id})" style="position: absolute; top: 8px; right: 8px; background: ${member.displayOnHome ? '#E83628' : 'rgba(0,0,0,0.5)'}; color: ${member.displayOnHome ? 'white' : '#999'}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer;" title="${member.displayOnHome ? 'Visible on Home Page' : 'Hidden from Home Page'}"><i class="fas fa-${member.displayOnHome ? 'eye' : 'eye-slash'}"></i></div>
                </div>
                <div class="team-member-info">
                    <div class="team-member-name">${member.name}</div>
                    <div class="team-member-role">${rolesHTML}</div>
                    <div class="team-member-credits">${creditsHTML}</div>
                </div>
                <div class="team-card-actions">
                    <button class="team-card-action-btn" onclick="editTeamMember(${member.id})">Edit</button>
                    <button class="team-card-action-btn" onclick="deleteTeamMember(${member.id})">Delete</button>
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
    document.getElementById('teamMemberModalTitle').textContent = 'Add Team Member';
    document.getElementById('teamMemberForm').reset();
    document.getElementById('teamMemberId').value = '';
    document.getElementById('teamMemberPhotoPath').value = '';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('dragZoneContent').style.display = 'block';
    document.getElementById('creditsList').innerHTML = '';
    document.getElementById('displayOnHome').checked = false;
    
    document.getElementById('roleArtist').checked = false;
    document.getElementById('roleProducer').checked = false;
    document.getElementById('roleEngineer').checked = false;
    document.getElementById('roleConsultant').checked = false;
    document.getElementById('roleLawyer').checked = false;
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
    const member = teamMembers.find(m => m.id === memberId);
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
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;
    
    currentEditTeamMemberId = memberId;
    currentTeamCredits = typeof member.credits === 'string' ? JSON.parse(member.credits) : (Array.isArray(member.credits) ? member.credits : []);
    
    document.getElementById('teamMemberModalTitle').textContent = 'Edit Team Member';
    document.getElementById('teamMemberId').value = member.id;
    document.getElementById('teamMemberPhotoPath').value = member.photoFile;
    document.getElementById('teamMemberName').value = member.name;
    
    document.getElementById('roleArtist').checked = false;
    document.getElementById('roleProducer').checked = false;
    document.getElementById('roleEngineer').checked = false;
    document.getElementById('roleConsultant').checked = false;
    document.getElementById('roleLawyer').checked = false;
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
        if (role === 'artist') document.getElementById('roleArtist').checked = true;
        else if (role === 'producer') document.getElementById('roleProducer').checked = true;
        else if (role === 'engineer') document.getElementById('roleEngineer').checked = true;
        else if (role === 'consultant') document.getElementById('roleConsultant').checked = true;
        else if (role === 'lawyer') document.getElementById('roleLawyer').checked = true;
        else {
            document.getElementById('roleOther').checked = true;
            document.getElementById('customRoleInput').value = role;
            document.getElementById('customRoleInput').style.display = 'block';
        }
    });
    
    document.getElementById('teamMemberBio').value = member.description || '';
    document.getElementById('displayOnHome').checked = member.displayOnHome || false;
    
    const photoPreview = document.getElementById('photoPreview');
    photoPreview.src = member.photoFile;
    photoPreview.style.display = 'block';
    document.getElementById('dragZoneContent').style.display = 'none';
    
    document.getElementById('creditsList').innerHTML = '';
    currentTeamCredits.forEach(credit => addCreditTag(credit));
    
    document.getElementById('teamMemberModal').classList.add('show');
    setupDragAndDrop();
}

async function deleteTeamMember(memberId) {
    if (!confirm('Are you sure you want to delete this team member?')) return;
    
    try {
        await fetchWithAuth(`${API_URL}/photos/${memberId}`, {
            method: 'DELETE'
        });
        loadTeamMembers();
    } catch (error) {
        console.error('Error deleting team member:', error);
    }
}

function setupDragAndDrop() {
    const dragZone = document.getElementById('dragZone');
    const photoInput = document.getElementById('teamMemberPhoto');
    
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
    const reader = new FileReader();
    reader.onload = (e) => {
        const photoPreview = document.getElementById('photoPreview');
        photoPreview.src = e.target.result;
        photoPreview.style.display = 'block';
        document.getElementById('dragZoneContent').style.display = 'none';
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

document.getElementById('teamMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const memberId = document.getElementById('teamMemberId').value;
    const formData = new FormData();
    
    formData.append('name', document.getElementById('teamMemberName').value);
    
    const selectedRoles = [];
    if (document.getElementById('roleArtist').checked) selectedRoles.push('artist');
    if (document.getElementById('roleProducer').checked) selectedRoles.push('producer');
    if (document.getElementById('roleEngineer').checked) selectedRoles.push('engineer');
    if (document.getElementById('roleConsultant').checked) selectedRoles.push('consultant');
    if (document.getElementById('roleLawyer').checked) selectedRoles.push('lawyer');
    if (document.getElementById('roleOther').checked) {
        const customRole = document.getElementById('customRoleInput').value;
        if (customRole) selectedRoles.push(customRole);
    }
    
    formData.append('role', JSON.stringify(selectedRoles));
    formData.append('category', 'team');
    formData.append('credits', JSON.stringify(currentTeamCredits));
    formData.append('description', document.getElementById('teamMemberBio').value);
    formData.append('displayOnHome', document.getElementById('displayOnHome').checked ? 'true' : 'false');
    
    const photoFile = document.getElementById('teamMemberPhoto').files[0];
    if (photoFile) {
        formData.append('photoFile', photoFile);
    }
    
    try {
        if (memberId) {
            await fetchWithAuth(`${API_URL}/photos/${memberId}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            await fetchWithAuth(`${API_URL}/photos`, {
                method: 'POST',
                body: formData
            });
        }
        
        closeTeamMemberModal();
        loadTeamMembers();
    } catch (error) {
        console.error('Error saving team member:', error);
        alert('Error saving team member');
    }
});

