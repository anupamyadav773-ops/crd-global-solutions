const API_BASE = 'API_BASE_URL';
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('id');

const form = document.getElementById('userForm');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const saveButton = document.getElementById('saveButton');
const rolePermissionsSummary = document.getElementById('rolePermissionsSummary');

let availableRoles = [];

const fields = {
    username: document.getElementById('username'),
    full_name: document.getElementById('full_name'),
    mobile: document.getElementById('mobile'),
    email: document.getElementById('email'),
    role: document.getElementById('role'),
    status: document.getElementById('status'),
    password: document.getElementById('password'),
    confirm_password: document.getElementById('confirm_password')
};

async function loadRolesDropdown() {
    try {
        const response = await fetch(`${API_BASE}/roles`);
        const result = await response.json();

        if (result.success && Array.isArray(result.roles)) {
            availableRoles = result.roles;
            const currentSelected = fields.role.value;
            fields.role.innerHTML = '';

            availableRoles.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.role_name;
                opt.textContent = r.role_name;
                fields.role.appendChild(opt);
            });

            if (currentSelected && availableRoles.some(r => r.role_name === currentSelected)) {
                fields.role.value = currentSelected;
            } else if (availableRoles.some(r => r.role_name === 'Staff')) {
                fields.role.value = 'Staff';
            }
            updateRolePermissionsSummary();
        }
    } catch (e) {
        console.error('Failed to load roles dropdown:', e);
    }
}

function updateRolePermissionsSummary() {
    if (!rolePermissionsSummary || !fields.role) return;
    const selectedRoleName = fields.role.value;
    const role = availableRoles.find(r => r.role_name.toLowerCase() === selectedRoleName.toLowerCase());

    if (!role) {
        rolePermissionsSummary.textContent = '';
        return;
    }

    const perms = Array.isArray(role.permissions) ? role.permissions : [];
    if (perms.length === 0) {
        rolePermissionsSummary.textContent = '🛡️ Permissions: None';
    } else {
        rolePermissionsSummary.textContent = `🛡️ Permissions: ${perms.join(', ')}`;
    }
}

if (fields.role) {
    fields.role.addEventListener('change', updateRolePermissionsSummary);
}

function setEditMode(user) {
    pageTitle.textContent = 'Edit User';
    pageSubtitle.textContent = 'Update user details';
    saveButton.textContent = 'Update User';
    fields.username.disabled = true;
    fields.password.required = false;
    fields.confirm_password.required = false;
    document.getElementById('passwordGroup').style.display = 'none';
    document.getElementById('confirmPasswordGroup').style.display = 'none';

    if (user) {
        fields.username.value = user.username || '';
        fields.full_name.value = user.full_name || '';
        fields.mobile.value = user.mobile || '';
        fields.email.value = user.email || '';
        if (user.role) {
            fields.role.value = user.role;
        }
        fields.status.value = user.status || 'Active';
        updateRolePermissionsSummary();
    }
}

async function loadUserForEdit() {
    await loadRolesDropdown();

    if (!userId) {
        pageTitle.textContent = 'Add User';
        pageSubtitle.textContent = 'Create a new user account';
        updateRolePermissionsSummary();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users/${userId}`);
        const result = await response.json();

        if (!result.success) {
            alert(result.message || 'Unable to load user');
            window.location.href = 'user-list.html';
            return;
        }

        setEditMode(result.user);
    } catch (error) {
        console.error('Load user failed:', error);
        alert('Unable to connect to backend.');
    }
}

function validateEmail(email) {
    if (!email || email.trim() === '') return true;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
}

async function submitUser(event) {
    event.preventDefault();

    const username = fields.username.value.trim();
    const fullName = fields.full_name.value.trim();
    const mobile = fields.mobile.value.trim();
    const email = fields.email.value.trim();
    const role = fields.role.value;
    const status = fields.status.value;
    const password = fields.password.value;
    const confirmPassword = fields.confirm_password.value;

    if (!username) {
        alert('Username is required.');
        return;
    }

    if (!fullName) {
        alert('Full Name is required.');
        return;
    }

    if (!validateEmail(email)) {
        alert('Please enter a valid email address.');
        return;
    }

    if (!userId) {
        if (!password) {
            alert('Password is required for new users.');
            return;
        }

        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
    }

    const payload = {
        username,
        full_name: fullName,
        mobile,
        email,
        role,
        status
    };

    if (!userId) {
        payload.password = password;
    }

    const method = userId ? 'PUT' : 'POST';
    const url = userId ? `${API_BASE}/users/${userId}` : `${API_BASE}/users`;

    try {
        const response = await fetch(url, {
            method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!result.success) {
            alert(result.message || 'Unable to save user.');
            return;
        }

        alert(result.message || 'User saved successfully.');
        window.location.href = 'user-list.html';
    } catch (error) {
        console.error('Save user failed:', error);
        alert('Unable to connect to backend.');
    }
}

form.addEventListener('submit', submitUser);
window.addEventListener('DOMContentLoaded', loadUserForEdit);