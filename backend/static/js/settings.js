// settings.js
        document.addEventListener('DOMContentLoaded', function() {
            // Tab switching functionality
            const tabButtons = document.querySelectorAll('.tab-btn');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Remove active class from all buttons and contents
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));
                    
                    // Add active class to current button
                    button.classList.add('active');
                    
                    // Show corresponding content
                    const tabId = `${button.dataset.tab}-tab`;
                    document.getElementById(tabId).classList.add('active');
                });
            });
            
            // Profile picture upload
           // Profile picture upload
const profileUpload = document.getElementById('profile-upload');
const changePhotoBtn = document.getElementById('change-photo-btn');
let profileImage = document.getElementById('profile-image'); // Changed from const to let

changePhotoBtn.addEventListener('click', () => {
    profileUpload.click();
});

profileUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Add loading state
    if (profileImage.tagName === 'IMG') {
        profileImage.classList.add('updating');
    }
    
    try {
        // Read the file as base64 with proper formatting
        const base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Ensure the result is properly formatted
                if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
                    resolve(reader.result);
                } else {
                    reject(new Error('Invalid file read result'));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        
        // Update the profile image preview
        if (profileImage.classList.contains('placeholder')) {
            profileImage.classList.remove('placeholder');
            profileImage.innerHTML = '';
            profileImage.style.background = 'none';
            
            const img = document.createElement('img');
            img.src = base64String;
            img.className = 'profile-picture';
            img.alt = 'Profile Picture';
            img.id = 'profile-image';
            profileImage.parentNode.replaceChild(img, profileImage);
            profileImage = img;
        } else if (profileImage.tagName === 'IMG') {
            profileImage.src = base64String;
        }
        
        // Save to database
        const response = await fetch('/update_profile_picture', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                profile_pic: base64String
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Profile picture updated successfully!', 'success');
        } else {
            throw new Error(result.error || 'Failed to update profile picture');
        }
    } catch (error) {
        console.error('Error updating profile picture:', error);
        showAlert(error.message, 'error');
    }
});
            
            // Helper function to read file as base64
            function readFileAsBase64(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
            
            // Edit fields functionality
            const editButtons = {
                'email': {
                    editBtn: document.getElementById('edit-email-btn'),
                    value: document.getElementById('email-value'),
                    editField: document.getElementById('email-edit'),
                    input: document.getElementById('email-input'),
                    saveBtn: document.getElementById('save-email-btn'),
                    cancelBtn: document.getElementById('cancel-email-btn')
                },
                'first-name': {
                    editBtn: document.getElementById('edit-first-name-btn'),
                    value: document.getElementById('first-name-value'),
                    editField: document.getElementById('first-name-edit'),
                    input: document.getElementById('first-name-input'),
                    saveBtn: document.getElementById('save-first-name-btn'),
                    cancelBtn: document.getElementById('cancel-first-name-btn')
                },
                'last-name': {
                    editBtn: document.getElementById('edit-last-name-btn'),
                    value: document.getElementById('last-name-value'),
                    editField: document.getElementById('last-name-edit'),
                    input: document.getElementById('last-name-input'),
                    saveBtn: document.getElementById('save-last-name-btn'),
                    cancelBtn: document.getElementById('cancel-last-name-btn')
                },
                'position': {
                    editBtn: document.getElementById('edit-position-btn'),
                    value: document.getElementById('position-value'),
                    editField: document.getElementById('position-edit'),
                    input: document.getElementById('position-input'),
                    saveBtn: document.getElementById('save-position-btn'),
                    cancelBtn: document.getElementById('cancel-position-btn')
                }
            };
            
            // Set up edit/save/cancel handlers for each field
            Object.entries(editButtons).forEach(([field, elements]) => {
                // Show edit field
                elements.editBtn.addEventListener('click', () => {
                    elements.value.style.display = 'none';
                    elements.editField.style.display = 'flex';
                    elements.input.focus();
                });
                
                // Save changes
                elements.saveBtn.addEventListener('click', async () => {
                    const newValue = elements.input.value.trim();
                    
                    if (!newValue) {
                        showAlert(`${field.replace('-', ' ')} cannot be empty`, 'error');
                        return;
                    }
                    
                    try {
                        const fieldName = field.replace('-', '_');
                        const response = await fetch('/update_profile', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                [fieldName]: newValue
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (response.ok) {
                            elements.value.textContent = newValue;
                            elements.value.style.display = 'block';
                            elements.editField.style.display = 'none';
                            
                            // Update profile name in header if first or last name changed
                            if (field === 'first-name' || field === 'last-name') {
                                document.getElementById('profile-name').textContent = 
                                    `${editButtons['first-name'].value.textContent} ${editButtons['last-name'].value.textContent}`;
                            }
                            
                            // Update position in header if position changed
                            if (field === 'position') {
                                document.getElementById('profile-position').textContent = newValue;
                            }
                            
                            showAlert(`${field.replace('-', ' ')} updated successfully!`, 'success');
                        } else {
                            throw new Error(result.error || `Failed to update ${field.replace('-', ' ')}`);
                        }
                    } catch (error) {
                        console.error(`Error updating ${field}:`, error);
                        showAlert(error.message, 'error');
                    }
                });
                
                // Cancel editing
                elements.cancelBtn.addEventListener('click', () => {
                    elements.input.value = elements.value.textContent;
                    elements.value.style.display = 'block';
                    elements.editField.style.display = 'none';
                });
            });
            
            // Password change form
            const passwordForm = document.getElementById('password-form');
            const currentPassword = document.getElementById('current-password');
            const newPassword = document.getElementById('new-password');
            const confirmPassword = document.getElementById('confirm-password');
            const savePasswordBtn = document.getElementById('save-password-btn');
            const cancelPasswordBtn = document.getElementById('cancel-password-btn');
            
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
                    showAlert('Please fill in all password fields', 'error');
                    return;
                }
                
                if (newPassword.value.length < 8) {
                    showAlert('New password must be at least 8 characters long', 'error');
                    return;
                }
                
                if (newPassword.value !== confirmPassword.value) {
                    showAlert('New passwords do not match', 'error');
                    return;
                }
                
                savePasswordBtn.disabled = true;
                savePasswordBtn.textContent = 'Updating...';
                
                try {
                    const response = await fetch('/change_password', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            current_password: currentPassword.value,
                            new_password: newPassword.value
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        showAlert('Password changed successfully!', 'success');
                        passwordForm.reset();
                    } else {
                        throw new Error(result.error || 'Failed to change password');
                    }
                } catch (error) {
                    console.error('Error changing password:', error);
                    showAlert(error.message, 'error');
                } finally {
                    savePasswordBtn.disabled = false;
                    savePasswordBtn.textContent = 'Change Password';
                }
            });
            
            cancelPasswordBtn.addEventListener('click', () => {
                passwordForm.reset();
            });
            
            // Show alert message
            function showAlert(message, type) {
                // Remove any existing alerts
                const existingAlert = document.querySelector('.alert');
                if (existingAlert) {
                    existingAlert.remove();
                }
                
                const alert = document.createElement('div');
                alert.className = `alert alert-${type}`;
                alert.innerHTML = `
                    <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                    ${message}
                `;
                
                // Insert after the tabs
                const tabs = document.querySelector('.settings-tabs');
                tabs.parentNode.insertBefore(alert, tabs.nextSibling);
                
                // Auto-dismiss after 5 seconds
                setTimeout(() => {
                    alert.remove();
                }, 5000);
            }
        });