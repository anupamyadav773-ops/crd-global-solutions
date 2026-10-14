const API_BASE = 'API_BASE_URL';
let allUsers = [];
let allRoles = [];
let systemPermissions = [];
let selectedUserId = null;

const elements = {
    totalUsers: document.getElementById('totalUsers'),
    activeUsers: document.getElementById('activeUsers'),
    inactiveUsers: document.getElementById('inactiveUsers'),
    adminUsers: document.getElementById('adminUsers'),
    userTableBody: document.getElementById('userTableBody'),
    searchInput: document.getElementById('searchInput'),
    roleFilter: document.getElementById('roleFilter'),
    statusFilter: document.getElementById('statusFilter'),
    applyBtn: document.getElementById('applyFilters'),
    resetBtn: document.getElementById('resetFilters'),
    passwordModal: document.getElementById('passwordModal'),
    resetPasswordForm: document.getElementById('resetPasswordForm'),
    closePasswordModal: document.getElementById('closePasswordModal'),
    cancelPasswordReset: document.getElementById('cancelPasswordReset'),
    // Role Management Modal
    manageRolesBtn: document.getElementById('manageRolesBtn'),
    roleModal: document.getElementById('roleModal'),
    closeRoleModal: document.getElementById('closeRoleModal'),
    closeRoleModalBtn: document.getElementById('closeRoleModalBtn'),
    showCreateRoleBtn: document.getElementById('showCreateRoleBtn'),
    roleFormContainer: document.getElementById('roleFormContainer'),
    cancelRoleForm: document.getElementById('cancelRoleForm'),
    cancelRoleFormBtn: document.getElementById('cancelRoleFormBtn'),
    roleFormTitle: document.getElementById('roleFormTitle'),
    roleForm: document.getElementById('roleForm'),
    editRoleId: document.getElementById('editRoleId'),
    roleNameInput: document.getElementById('roleNameInput'),
    roleDescInput: document.getElementById('roleDescInput'),
    permissionsGrid: document.getElementById('permissionsGrid'),
    selectAllPerms: document.getElementById('selectAllPerms'),
    clearAllPerms: document.getElementById('clearAllPerms'),
    rolesTableBody: document.getElementById('rolesTableBody')
};

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function renderSummary(users) {
    const total = users.length;
    const active = users.filter((user) => String(user.status || 'Active').toLowerCase() === 'active').length;
    const inactive = users.filter((user) => String(user.status || 'Active').toLowerCase() === 'inactive').length;
    const admins = users.filter((user) => String(user.role || 'Staff').toLowerCase() === 'admin').length;

    elements.totalUsers.textContent = total;
    elements.activeUsers.textContent = active;
    elements.inactiveUsers.textContent = inactive;
    elements.adminUsers.textContent = admins;
}

function renderUsers(users) {
    if (!users || users.length === 0) {
        elements.userTableBody.innerHTML = '<tr><td colspan="9" class="empty-message">No users found.</td></tr>';
        return;
    }

    elements.userTableBody.innerHTML = users.map((user) => {
        const status = String(user.status || 'Active');
        const role = String(user.role || 'Staff');
        const statusClass = status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
        const actionText = status.toLowerCase() === 'active' ? 'Deactivate' : 'Activate';

        return `
            <tr>
                <td>${user.id || '-'}</td>
                <td>${escapeHtml(user.username || '-')}</td>
                <td>${escapeHtml(user.full_name || '-')}</td>
                <td>${escapeHtml(user.mobile || '-')}</td>
                <td>${escapeHtml(user.email || '-')}</td>
                <td>
                    <span class="role-badge" style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; padding:4px 8px; border-radius:4px; font-weight:600;" onclick="openEditRoleByName('${escapeHtml(role)}')" title="Click to view & edit permissions for role '${escapeHtml(role)}'">
                        ${escapeHtml(role)} <span style="font-size:10px;">✏️</span>
                    </span>
                </td>
                <td><span class="status-chip ${statusClass}">${escapeHtml(status)}</span></td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    <div class="action-group">
                        <button class="action-btn edit-btn" type="button" onclick="editUser(${user.id})">Edit</button>
                        <button class="action-btn reset-btn" type="button" onclick="openResetPassword(${user.id})">Reset Password</button>
                        <button class="action-btn toggle-btn" type="button" onclick="toggleUserStatus(${user.id}, '${escapeHtml(status)}')">${actionText}</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadUsers() {
    const params = new URLSearchParams();
    const search = elements.searchInput.value.trim();
    const role = elements.roleFilter.value;
    const status = elements.statusFilter.value;

    if (search) params.set('search', search);
    if (role) params.set('role', role);
    if (status) params.set('status', status);

    try {
        const response = await fetch(`${API_BASE}/users?${params.toString()}`);
        const result = await response.json();

        if (!result.success) {
            elements.userTableBody.innerHTML = `<tr><td colspan="9" class="empty-message">${escapeHtml(result.message || 'Unable to load users')}</td></tr>`;
            return;
        }

        allUsers = result.users || [];
        renderSummary(allUsers);
        renderUsers(allUsers);
    } catch (error) {
        console.error('User load failed:', error);
        elements.userTableBody.innerHTML = '<tr><td colspan="9" class="empty-message">Unable to connect to backend.</td></tr>';
    }
}

function editUser(userId) {
    window.location.href = `user.html?id=${userId}`;
}

async function toggleUserStatus(userId, currentStatus) {
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const confirmed = confirm(`Are you sure you want to ${nextStatus === 'Active' ? 'activate' : 'deactivate'} this user?`);
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE}/users/${userId}/status`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: nextStatus })
        });
        const result = await response.json();

        if (!result.success) {
            alert(result.message || 'Failed to update user status.');
            return;
        }

        loadUsers();
    } catch (error) {
        console.error('Status update failed:', error);
        alert('Unable to connect to backend.');
    }
}

function openResetPassword(userId) {
    selectedUserId = userId;
    elements.resetPasswordForm.reset();
    elements.passwordModal.classList.remove('hidden');
}

function closeResetPassword() {
    selectedUserId = null;
    elements.resetPasswordForm.reset();
    elements.passwordModal.classList.add('hidden');
}

elements.closePasswordModal.addEventListener('click', closeResetPassword);
elements.cancelPasswordReset.addEventListener('click', closeResetPassword);
window.addEventListener('click', function (event) {
    if (event.target === elements.passwordModal) closeResetPassword();
    if (event.target === elements.roleModal) closeRoleModal();
});

elements.resetPasswordForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!selectedUserId) return;

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!newPassword || newPassword.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('Passwords do not match.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users/${selectedUserId}/password`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword })
        });

        const result = await response.json();
        if (!result.success) {
            alert(result.message || 'Unable to reset password.');
            return;
        }

        alert('Password reset successfully.');
        closeResetPassword();
    } catch (error) {
        console.error('Password reset failed:', error);
        alert('Unable to connect to backend.');
    }
});

function resetFilters() {
    elements.searchInput.value = '';
    elements.roleFilter.value = '';
    elements.statusFilter.value = '';
    loadUsers();
}

elements.applyBtn.addEventListener('click', loadUsers);
elements.resetBtn.addEventListener('click', resetFilters);
elements.searchInput.addEventListener('input', function () {
    if (this.value.trim() === '') {
        loadUsers();
    }
});

// ==========================================
// ROLES & PERMISSIONS MANAGEMENT LOGIC
// ==========================================

function togglePermCardVisual(checkbox) {
    const card = checkbox.closest('.perm-card');
    if (card) {
        if (checkbox.checked) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    }
}

async function loadPermissionsList() {
    if (systemPermissions.length > 0) {
        renderPermissionsGrid();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/permissions`);
        const result = await response.json();
        if (result.success && Array.isArray(result.permissions)) {
            systemPermissions = result.permissions;
            renderPermissionsGrid();
        }
    } catch (e) {
        console.error("Failed to load permissions:", e);
    }
}

function renderPermissionsGrid() {
    if (!elements.permissionsGrid) return;
    elements.permissionsGrid.innerHTML = systemPermissions.map(p => `
        <label class="perm-card" id="card_perm_${p.id}">
            <input type="checkbox" name="role_permission" value="${p.id}" onchange="togglePermCardVisual(this)">
            <div class="perm-info">
                <span class="perm-title">${escapeHtml(p.icon || '🔹')} ${escapeHtml(p.name)}</span>
                <span class="perm-desc">${escapeHtml(p.description || '')}</span>
            </div>
        </label>
    `).join('');
}

async function loadRoles() {
    try {
        const response = await fetch(`${API_BASE}/roles`);
        const result = await response.json();

        if (!result.success || !Array.isArray(result.roles)) {
            elements.rolesTableBody.innerHTML = '<tr><td colspan="6" class="empty-message">Unable to load roles.</td></tr>';
            return;
        }

        allRoles = result.roles;
        renderRolesTable(allRoles);
        updateRoleFilterOptions(allRoles);
    } catch (e) {
        console.error("Failed to load roles:", e);
        elements.rolesTableBody.innerHTML = '<tr><td colspan="6" class="empty-message">Error connecting to roles API.</td></tr>';
    }
}

function updateRoleFilterOptions(roles) {
    if (!elements.roleFilter) return;
    const currentVal = elements.roleFilter.value;
    elements.roleFilter.innerHTML = '<option value="">All Roles</option>';
    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.role_name;
        opt.textContent = r.role_name;
        elements.roleFilter.appendChild(opt);
    });
    elements.roleFilter.value = currentVal;
}

function renderRolesTable(roles) {
    if (!elements.rolesTableBody) return;
    if (roles.length === 0) {
        elements.rolesTableBody.innerHTML = '<tr><td colspan="6" class="empty-message">No roles found.</td></tr>';
        return;
    }

    elements.rolesTableBody.innerHTML = roles.map(role => {
        const typeChip = role.is_system
            ? '<span class="chip-system">System</span>'
            : '<span class="chip-custom">Custom</span>';

        const perms = Array.isArray(role.permissions) ? role.permissions : [];
        let permsHtml = '';
        if (perms.length === 0) {
            permsHtml = '<span style="color:#94a3b8;font-size:12px;">No permissions</span>';
        } else if (perms.length <= 5) {
            permsHtml = perms.map(p => `<span class="perm-tag">${escapeHtml(p)}</span>`).join('');
        } else {
            const firstFew = perms.slice(0, 4).map(p => `<span class="perm-tag">${escapeHtml(p)}</span>`).join('');
            const moreCount = perms.length - 4;
            permsHtml = `${firstFew}<span class="perm-tag more" title="${escapeHtml(perms.join(', '))}">+${moreCount} more</span>`;
        }

        const editBtn = `<button class="action-btn edit-btn" type="button" onclick="openEditRole(${role.id})" style="background:#2563eb; color:#fff; display:inline-flex; align-items:center; gap:4px; font-weight:600; padding:6px 14px; border-radius:5px; cursor:pointer;" title="Edit permissions and details for ${escapeHtml(role.role_name)}">✏️ Edit Role</button>`;
        const deleteBtn = role.is_system
            ? ''
            : `<button class="action-btn delete-btn" type="button" onclick="deleteRole(${role.id}, '${escapeHtml(role.role_name)}')" style="background:#ef4444; color:#fff; font-weight:600; padding:6px 14px; border-radius:5px; cursor:pointer;" title="Delete this custom role">🗑️ Delete</button>`;

        return `
            <tr>
                <td><strong>${escapeHtml(role.role_name)}</strong></td>
                <td>${typeChip}</td>
                <td><span style="font-size:13px;color:#475569;">${escapeHtml(role.description || '-')}</span></td>
                <td><span style="font-weight:bold;">${Number(role.user_count || 0)}</span> user(s)</td>
                <td>${permsHtml}</td>
                <td>
                    <div class="role-actions">
                        ${editBtn}
                        ${deleteBtn}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ------------------------------------------
// TAB SWITCHING: Users vs Roles
// ------------------------------------------

const tabUsersBtn = document.getElementById('tabUsersBtn');
const tabRolesBtn = document.getElementById('tabRolesBtn');
const usersSection = document.getElementById('usersSection');
const rolesSection = document.getElementById('rolesSection');

function switchTab(tabName) {
    const isRoles = (tabName === 'roles');
    if (usersSection) usersSection.style.display = isRoles ? 'none' : 'block';
    if (rolesSection) rolesSection.style.display = isRoles ? 'block' : 'none';

    if (tabUsersBtn) {
        tabUsersBtn.style.color = isRoles ? '#64748b' : '#ff6600';
        tabUsersBtn.style.borderBottomColor = isRoles ? 'transparent' : '#ff6600';
    }
    if (tabRolesBtn) {
        tabRolesBtn.style.color = isRoles ? '#ff6600' : '#64748b';
        tabRolesBtn.style.borderBottomColor = isRoles ? '#ff6600' : 'transparent';
    }

    if (isRoles) {
        loadPermissionsList();
        loadRoles();
    }
}

if (tabUsersBtn) {
    tabUsersBtn.addEventListener('click', () => switchTab('users'));
}
if (tabRolesBtn) {
    tabRolesBtn.addEventListener('click', () => switchTab('roles'));
}

if (elements.manageRolesBtn) {
    elements.manageRolesBtn.addEventListener('click', () => {
        switchTab('roles');
        if (rolesSection) rolesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function showCreateRoleForm() {
    switchTab('roles');
    elements.roleFormTitle.textContent = "Create New Custom Role";
    elements.editRoleId.value = "";
    elements.roleNameInput.value = "";
    elements.roleNameInput.disabled = false;
    elements.roleDescInput.value = "";

    // Clear all checkboxes
    document.querySelectorAll('input[name="role_permission"]').forEach(cb => {
        cb.checked = false;
        togglePermCardVisual(cb);
    });

    elements.roleFormContainer.classList.remove('hidden');
    elements.roleFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    elements.roleNameInput.focus();
}

function hideRoleForm() {
    elements.roleFormContainer.classList.add('hidden');
    elements.editRoleId.value = "";
}

if (elements.showCreateRoleBtn) {
    elements.showCreateRoleBtn.addEventListener('click', showCreateRoleForm);
}

if (elements.cancelRoleForm) {
    elements.cancelRoleForm.addEventListener('click', hideRoleForm);
}

if (elements.cancelRoleFormBtn) {
    elements.cancelRoleFormBtn.addEventListener('click', hideRoleForm);
}

if (elements.selectAllPerms) {
    elements.selectAllPerms.addEventListener('click', () => {
        document.querySelectorAll('input[name="role_permission"]').forEach(cb => {
            cb.checked = true;
            togglePermCardVisual(cb);
        });
    });
}

if (elements.clearAllPerms) {
    elements.clearAllPerms.addEventListener('click', () => {
        document.querySelectorAll('input[name="role_permission"]').forEach(cb => {
            cb.checked = false;
            togglePermCardVisual(cb);
        });
    });
}

function openEditRole(roleId) {
    switchTab('roles');
    const role = allRoles.find(r => String(r.id) === String(roleId));
    if (!role) {
        alert("Role not found.");
        return;
    }

    elements.roleFormTitle.textContent = `Edit Role: ${role.role_name} ${role.is_system ? '(System Role)' : '(Custom Role)'}`;
    elements.editRoleId.value = role.id;
    elements.roleNameInput.value = role.role_name;
    elements.roleNameInput.disabled = Boolean(role.is_system);
    elements.roleDescInput.value = role.description || "";

    const assignedPerms = Array.isArray(role.permissions) ? role.permissions : [];
    document.querySelectorAll('input[name="role_permission"]').forEach(cb => {
        cb.checked = assignedPerms.includes(cb.value);
        togglePermCardVisual(cb);
    });

    elements.roleFormContainer.classList.remove('hidden');
    elements.roleFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openEditRoleByName(roleName) {
    switchTab('roles');
    const targetName = String(roleName || '').trim().toLowerCase();
    const role = allRoles.find(r => String(r.role_name || '').toLowerCase() === targetName);
    if (role) {
        openEditRole(role.id);
    } else {
        alert(`Role "${roleName}" नहीं मिला।`);
    }
}

if (elements.roleForm) {
    elements.roleForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const roleId = elements.editRoleId.value;
        const roleName = elements.roleNameInput.value.trim();
        const description = elements.roleDescInput.value.trim();

        if (!roleName) {
            alert("Role name is required.");
            return;
        }

        const checkedPerms = [];
        document.querySelectorAll('input[name="role_permission"]:checked').forEach(cb => {
            checkedPerms.push(cb.value);
        });

        const isEdit = Boolean(roleId);
        const url = isEdit ? `${API_BASE}/roles/${roleId}` : `${API_BASE}/roles`;
        const method = isEdit ? 'PUT' : 'POST';
        const payload = isEdit
            ? { role_name: roleName, description, permissions: checkedPerms }
            : { role_name: roleName, description, permissions: checkedPerms };

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!result.success) {
                alert(result.message || "Failed to save role.");
                return;
            }

            alert(result.message || "Role saved successfully.");
            hideRoleForm();
            loadRoles();
            loadUsers();
        } catch (error) {
            console.error("Save role failed:", error);
            alert("Unable to connect to backend.");
        }
    });
}

async function deleteRole(roleId, roleName) {
    const confirmed = confirm(`क्या आप वाकई कस्टम रोल "${roleName}" को डिलीट करना चाहते हैं?\n\nयह क्रिया वापस नहीं ली जा सकती।`);
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE}/roles/${roleId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (!result.success) {
            alert(result.message || "Failed to delete role.");
            return;
        }

        alert(result.message || "Role deleted successfully.");
        loadRoles();
        loadUsers();
    } catch (error) {
        console.error("Delete role failed:", error);
        alert("Unable to connect to backend.");
    }
}

window.openEditRole = openEditRole;
window.openEditRoleByName = openEditRoleByName;
window.deleteRole = deleteRole;
window.switchTab = switchTab;
window.togglePermCardVisual = togglePermCardVisual;

window.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    loadRoles();
    loadPermissionsList();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'roles') {
        switchTab('roles');
    }
});