// settings.js - Main JavaScript file for handling user settings functionality
// This file manages all user profile settings including profile picture, personal info, and password changes

// Wait for the DOM to be fully loaded before executing any JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Tab System Implementation
    // Get all tab buttons and their corresponding content sections
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Add click event listeners to each tab button
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active state from all buttons and content sections
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activate the clicked button
            button.classList.add('active');
            
            // Show the corresponding content section using data-tab attribute
            const tabId = `${button.dataset.tab}-tab`;
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Profile Picture Upload System
    // Get references to profile picture related elements
    const profileUpload = document.getElementById('profile-upload');
    const changePhotoBtn = document.getElementById('change-photo-btn');
    let profileImage = document.getElementById('profile-image'); // Using let for reassignment

    // Trigger file input when change photo button is clicked
    changePhotoBtn.addEventListener('click', () => {
        profileUpload.click();
    });

    // Handle profile picture file selection and upload
    profileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Add visual feedback during upload
        if (profileImage.tagName === 'IMG') {
            profileImage.classList.add('updating');
        }
        
        try {
            // Convert selected file to base64 string for storage
            const base64String = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    // Validate the base64 string format
                    if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
                        resolve(reader.result);
                    } else {
                        reject(new Error('Invalid file read result'));
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // Update the profile image preview in the UI
            if (profileImage.classList.contains('placeholder')) {
                // Handle case where no profile picture exists yet
                profileImage.classList.remove('placeholder');
                profileImage.innerHTML = '';
                profileImage.style.background = 'none';
                
                // Create and insert new image element
                const img = document.createElement('img');
                img.src = base64String;
                img.className = 'profile-picture';
                img.alt = 'Profile Picture';
                img.id = 'profile-image';
                profileImage.parentNode.replaceChild(img, profileImage);
                profileImage = img;
            } else if (profileImage.tagName === 'IMG') {
                // Update existing profile picture
                profileImage.src = base64String;
            }
            
            // Send the new profile picture to the server
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
            
            // Handle success/failure of profile picture update
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
            
    // Utility function to convert file to base64 string
    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
            
    // Profile Information Edit System
    // Define all editable fields and their associated UI elements
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
            
    // Set up event handlers for each editable field
    Object.entries(editButtons).forEach(([field, elements]) => {
        // Handle edit button click - show edit field
        elements.editBtn.addEventListener('click', () => {
            elements.value.style.display = 'none';
            elements.editField.style.display = 'flex';
            elements.input.focus();
        });
                
        // Handle save button click - update field value
        elements.saveBtn.addEventListener('click', async () => {
            const newValue = elements.input.value.trim();
                    
            // Validate input
            if (!newValue) {
                showAlert(`${field.replace('-', ' ')} cannot be empty`, 'error');
                return;
            }
                    
            try {
                // Prepare field name for API
                const fieldName = field.replace('-', '_');
                // Send update to server
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
                        
                // Handle successful update
                if (response.ok) {
                    // Update UI with new value
                    elements.value.textContent = newValue;
                    elements.value.style.display = 'block';
                    elements.editField.style.display = 'none';
                            
                    // Update header information if name or position changed
                    if (field === 'first-name' || field === 'last-name') {
                        document.getElementById('profile-name').textContent = 
                            `${editButtons['first-name'].value.textContent} ${editButtons['last-name'].value.textContent}`;
                    }
                            
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
                
        // Handle cancel button click - revert changes
        elements.cancelBtn.addEventListener('click', () => {
            elements.input.value = elements.value.textContent;
            elements.value.style.display = 'block';
            elements.editField.style.display = 'none';
        });
    });
            
    // Password Change System
    // Get references to password form elements
    const passwordForm = document.getElementById('password-form');
    const currentPassword = document.getElementById('current-password');
    const newPassword = document.getElementById('new-password');
    const confirmPassword = document.getElementById('confirm-password');
    const savePasswordBtn = document.getElementById('save-password-btn');
    const cancelPasswordBtn = document.getElementById('cancel-password-btn');
            
    // Handle password form submission
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
                
        // Validate password fields
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
                
        // Disable save button during update
        savePasswordBtn.disabled = true;
        savePasswordBtn.textContent = 'Updating...';
                
        try {
            // Send password change request to server
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
                    
            // Handle password change response
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
            // Re-enable save button
            savePasswordBtn.disabled = false;
            savePasswordBtn.textContent = 'Change Password';
        }
    });
            
    // Handle password form cancellation
    cancelPasswordBtn.addEventListener('click', () => {
        passwordForm.reset();
    });
            
    // Alert System
    // Function to display temporary alert messages
    function showAlert(message, type) {
        // Remove any existing alerts
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }
                
        // Create new alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            ${message}
        `;
                
        // Insert alert after tabs
        const tabs = document.querySelector('.settings-tabs');
        tabs.parentNode.insertBefore(alert, tabs.nextSibling);
                
        // Auto-dismiss alert after 5 seconds
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
});