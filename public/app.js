const loginModal = document.getElementById('loginModal');
const adminLoginModal = document.getElementById('adminLoginModal');
const registerModal = document.getElementById('registerModal');
const authBackdrop = document.getElementById('authBackdrop');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const showAdminLoginBtn = document.getElementById('showAdminLoginBtn');
const adminUsername = document.getElementById('adminUsername');
const adminPassword = document.getElementById('adminPassword');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminBackToLoginBtn = document.getElementById('adminBackToLoginBtn');
const registerUsername = document.getElementById('registerUsername');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerBtn = document.getElementById('registerBtn');
const backToLoginBtn = document.getElementById('backToLoginBtn');
const loginError = document.getElementById('loginError');
const adminLoginError = document.getElementById('adminLoginError');
const registerError = document.getElementById('registerError');
const profileName = document.getElementById('profileName');
const logoutBtn = document.getElementById('logoutBtn');
const groupsList = document.getElementById('groupsList');
const contactsList = document.getElementById('contactsList');
const newGroupBtn = document.getElementById('newGroupBtn');
const addAllBtn = document.getElementById('addAllBtn');
const adminPanel = document.getElementById('adminPanel');
const adminStats = document.getElementById('adminStats');
const adminUsersList = document.getElementById('adminUsersList');
const contactSearch = document.getElementById('contactSearch');
const chatContactName = document.getElementById('chatContactName');
const chatHeaderStatus = document.getElementById('chatHeaderStatus');
const chatContactAvatar = document.getElementById('chatContactAvatar');
const chatContactEmail = document.getElementById('chatContactEmail');
const messagesView = document.getElementById('messagesView');
const emptyState = document.getElementById('emptyState');
const typingIndicator = document.getElementById('typingIndicator');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const changePasswordModal = document.getElementById('changePasswordModal');
const changePasswordSubmitBtn = document.getElementById('changePasswordSubmitBtn');
const changePasswordCancelBtn = document.getElementById('changePasswordCancelBtn');
const currentPassword = document.getElementById('currentPassword');
const newPassword = document.getElementById('newPassword');
const confirmPassword = document.getElementById('confirmPassword');
const changePasswordError = document.getElementById('changePasswordError');
const emojiBtn = document.getElementById('emojiBtn');
const attachMediaBtn = document.getElementById('attachMediaBtn');
const recordVoiceBtn = document.getElementById('recordVoiceBtn');
const messageMediaInput = document.getElementById('messageMediaInput');
const adminLoadConversationBtn = document.getElementById('adminLoadConversationBtn');
const adminUserA = document.getElementById('adminUserA');
const adminUserB = document.getElementById('adminUserB');
const adminConversationView = document.getElementById('adminConversationView');
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmYesBtn = document.getElementById('confirmYesBtn');
const confirmNoBtn = document.getElementById('confirmNoBtn');
const toastContainer = document.getElementById('toastContainer');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
// Assistant UI elements
const assistantBtn = document.getElementById('assistantBtn');
const assistantModal = document.getElementById('assistantModal');
const assistantChat = document.getElementById('assistantChat');
const assistantInput = document.getElementById('assistantInput');
const assistantSendBtn = document.getElementById('assistantSendBtn');
const assistantCloseBtn = document.getElementById('assistantCloseBtn');

let currentUser = null;
let currentContact = null;
let currentGroup = null;
let socket = null;
let contacts = [];
let groups = [];
let typingTimeout = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecordingVoice = false;

const emojiList = ['😀', '😂', '😍', '😎', '😢', '👍', '🎉', '❤️', '🔥', '🤖'];

// Hide Add All until contacts are loaded
if (addAllBtn) {
  addAllBtn.style.display = 'none';
}

function showModal(modal) {
  authBackdrop.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function hideModals() {
  authBackdrop.classList.add('hidden');
  loginModal.classList.add('hidden');
  adminLoginModal.classList.add('hidden');
  registerModal.classList.add('hidden');
  changePasswordModal.classList.add('hidden');
  loginError.textContent = '';
  adminLoginError.textContent = '';
  registerError.textContent = '';
  changePasswordError.textContent = '';
}

function showLogin() {
  hideModals();
  showModal(loginModal);
}

function showRegister() {
  hideModals();
  showModal(registerModal);
}

function showAdminLogin() {
  hideModals();
  showModal(adminLoginModal);
}

async function fetchProfile() {
  const response = await fetch('/api/profile');
  if (!response.ok) {
    showLogin();
    return null;
  }
  return response.json();
}

function renderProfile(user) {
  profileName.textContent = user.username + (user.isAdmin ? ' (Admin)' : '');
  document.getElementById('userActions').style.display = 'flex';
  // Admin dashboard UI is hidden by default for all users.
  if (adminPanel) adminPanel.classList.add('hidden');
}

function showChangePasswordModal() {
  hideModals();
  changePasswordError.textContent = '';
  showModal(changePasswordModal);
}

// Assistant controls
function showAssistant() {
  hideModals();
  if (assistantChat) assistantChat.innerHTML = '<div class="assistant-system">Hi — I can help with features, how-tos, and next steps.</div>';
  showModal(assistantModal);
  if (assistantInput) assistantInput.focus();
}

function hideAssistant() {
  if (assistantModal) assistantModal.classList.add('hidden');
  authBackdrop.classList.add('hidden');
}

async function sendAssistantMessage() {
  if (!assistantInput || !assistantInput.value.trim()) return;
  const text = assistantInput.value.trim();
  if (assistantChat) {
    const msg = document.createElement('div');
    msg.style.marginBottom = '8px';
    msg.innerHTML = `<strong>You:</strong> ${escapeHtml(text)}`;
    assistantChat.appendChild(msg);
    assistantChat.scrollTop = assistantChat.scrollHeight;
  }
  assistantInput.value = '';

  try {
    const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
    const data = await res.json();
    const reply = data && data.reply ? data.reply : 'Sorry, I could not generate a response.';
    if (assistantChat) {
      const bot = document.createElement('div');
      bot.style.marginBottom = '8px';
      bot.innerHTML = `<strong>Assistant:</strong> ${escapeHtml(reply)}`;
      assistantChat.appendChild(bot);
      assistantChat.scrollTop = assistantChat.scrollHeight;
    }
  } catch (err) {
    console.error('Assistant error', err);
    if (assistantChat) {
      const bot = document.createElement('div');
      bot.style.marginBottom = '8px';
      bot.innerHTML = `<strong>Assistant:</strong> Unable to reach assistant.`;
      assistantChat.appendChild(bot);
      assistantChat.scrollTop = assistantChat.scrollHeight;
    }
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

async function handleChangePassword() {
  changePasswordError.textContent = '';
  const currentValue = currentPassword.value;
  const nextValue = newPassword.value;
  const confirmValue = confirmPassword.value;

  if (!currentValue || !nextValue || !confirmValue) {
    changePasswordError.textContent = 'All fields are required.';
    return;
  }
  if (nextValue.length < 6) {
    changePasswordError.textContent = 'New password must be at least 6 characters.';
    return;
  }
  if (nextValue !== confirmValue) {
    changePasswordError.textContent = 'New password and confirmation do not match.';
    return;
  }

  try {
    const response = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentValue, newPassword: nextValue }),
    });
    const result = await response.json();
    if (!response.ok) {
      changePasswordError.textContent = result.error || 'Unable to change password.';
      return;
    }
    changePasswordError.textContent = 'Password changed successfully.';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    setTimeout(hideModals, 1200);
  } catch (error) {
    changePasswordError.textContent = 'Unable to reach server.';
    console.error(error);
  }
}

async function sendAssetFile(file) {
  if (!file || !socket || (!currentContact && !currentGroup)) return;

  try {
    const formData = new FormData();
    formData.append('media', file);
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('Upload failed:', result.error);
      return;
    }

    let messageType = 'file';
    if (file.type.startsWith('image/')) messageType = 'image';
    else if (file.type.startsWith('audio/')) messageType = 'audio';
    else if (file.type.startsWith('video/')) messageType = 'video';
    else if (file.type.startsWith('text/')) messageType = 'file';

    if (currentGroup) {
      socket.emit('group_message', {
        groupId: currentGroup.id,
        content: file.name,
        type: messageType,
        mediaUrl: result.mediaUrl,
      });
    } else {
      socket.emit('private_message', {
        receiverId: currentContact.id,
        content: file.name,
        type: messageType,
        mediaUrl: result.mediaUrl,
      });
    }
    messageMediaInput.value = '';
  } catch (error) {
    console.error('Media upload error:', error);
  }
}

function insertEmoji() {
  const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];
  const start = messageInput.selectionStart;
  const end = messageInput.selectionEnd;
  const value = messageInput.value;
  messageInput.value = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
  messageInput.focus();
  messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
}

async function toggleVoiceRecording() {
  if (isRecordingVoice) {
    mediaRecorder.stop();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Voice recording is not supported in this browser.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener('stop', async () => {
      stream.getTracks().forEach((track) => track.stop());
      isRecordingVoice = false;
      recordVoiceBtn.textContent = '🎙️';
      const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
      await sendAssetFile(file);
    });

    mediaRecorder.start();
    isRecordingVoice = true;
    recordVoiceBtn.textContent = '⏹️ Stop';
  } catch (error) {
    console.error('Voice recording error:', error);
    alert('Unable to access microphone.');
  }
}

async function handleAdminLoadConversation() {
  const userAValue = adminUserA.value.trim();
  const userBValue = adminUserB.value.trim();
  if (!userAValue || !userBValue || userAValue === userBValue) {
    adminConversationView.innerHTML = '<p class="empty-state">Enter two different user IDs.</p>';
    return;
  }

  try {
    const response = await fetch(`/api/admin/conversation?userA=${encodeURIComponent(userAValue)}&userB=${encodeURIComponent(userBValue)}`);
    if (!response.ok) {
      const result = await response.json();
      adminConversationView.innerHTML = `<p class="empty-state">${result.error || 'Unable to load conversation.'}</p>`;
      return;
    }
    const data = await response.json();
    renderAdminConversation(data.messages || []);
  } catch (error) {
    console.error('Admin conversation error:', error);
    adminConversationView.innerHTML = '<p class="empty-state">Unable to load conversation.</p>';
  }
}

function renderAdminConversation(messages) {
  if (!messages.length) {
    adminConversationView.innerHTML = '<p class="empty-state">No conversation found.</p>';
    return;
  }

  adminConversationView.innerHTML = messages
    .map((message) => {
      const timestamp = new Date(message.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
      const direction = message.sender_id === currentUser?.id ? 'sent' : 'received';
      let contentHtml = `<div>${message.content || ''}</div>`;

      if (message.type === 'image' && message.media_url) {
        contentHtml = `
          <div class="message-image-preview">
            <img src="${message.media_url}" alt="Image message" />
          </div>
          <div>${message.content || 'Image'}</div>
        `;
      } else if (message.type === 'audio' && message.media_url) {
        contentHtml = `
          <audio controls src="${message.media_url}"></audio>
          <div>${message.content || 'Voice note'}</div>
        `;
      } else if (message.type === 'video' && message.media_url) {
        contentHtml = `
          <video controls src="${message.media_url}" class="admin-message-video"></video>
          <div>${message.content || 'Video message'}</div>
        `;
      } else if (message.type === 'file' && message.media_url) {
        contentHtml = `<a href="${message.media_url}" target="_blank" rel="noopener noreferrer">${message.content || 'Download file'}</a>`;
      }

      return `
        <div class="admin-message-row ${direction}">
          <div class="admin-message-box">
            <div class="admin-message-meta">From ${message.sender_id} to ${message.receiver_id} · ${timestamp}</div>
            ${contentHtml}
          </div>
        </div>
      `;
    })
    .join('');
}

async function loadAdminStats() {
  if (!currentUser?.isAdmin) {
    return;
  }

  try {
    const response = await fetch('/api/admin/stats');
    if (!response.ok) {
      adminStats.textContent = 'Unable to load admin stats.';
      return;
    }

    const data = await response.json();
    adminStats.innerHTML = `
      <div class="stats-card">
        <strong>Users</strong>
        <span>${data.userCount}</span>
      </div>
      <div class="stats-card">
        <strong>Messages</strong>
        <span>${data.messageCount}</span>
      </div>
    `;

    adminUsersList.innerHTML = data.users
      .map(
        (user) => `
          <div class="admin-user-row">
            <span>${user.username}</span>
            <span>${user.email}</span>
            <strong>${user.role}</strong>
          </div>
        `
      )
      .join('');
  } catch (error) {
    adminStats.textContent = 'Unable to load admin stats.';
    console.error(error);
  }
}

function openChatPanel(contact) {
  currentContact = contact;
  currentGroup = null;
  chatContactName.textContent = contact.username;
  chatHeaderStatus.textContent = contact.online ? 'Online' : 'Offline';
  if (chatContactAvatar) chatContactAvatar.src = createAvatarDataUrl(contact.username);
  if (chatContactEmail) chatContactEmail.textContent = contact.email || '';
  typingIndicator.textContent = '';
  loadMessages(contact.id);
  document.querySelectorAll('.contact-card').forEach((card) => {
    card.classList.toggle('active', Number(card.dataset.id) === contact.id && card.dataset.type === 'user');
  });
  document.querySelectorAll('.contact-card').forEach((card) => {
    if (card.dataset.type === 'group') {
      card.classList.remove('active');
    }
  });
}

function openGroupPanel(group) {
  currentGroup = group;
  currentContact = null;
  chatContactName.textContent = group.name;
  chatHeaderStatus.textContent = `${group.member_count} members`;
  if (chatContactAvatar) chatContactAvatar.src = '/icons/icon-192.svg';
  if (chatContactEmail) chatContactEmail.textContent = '';
  typingIndicator.textContent = '';
  loadGroupMessages(group.id);
  document.querySelectorAll('.contact-card').forEach((card) => {
    card.classList.toggle('active', Number(card.dataset.id) === group.id && card.dataset.type === 'group');
  });
  document.querySelectorAll('.contact-card').forEach((card) => {
    if (card.dataset.type === 'user') {
      card.classList.remove('active');
    }
  });
}

function appendMessage(message) {
  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${message.sender_id === currentUser.id ? 'sent' : 'received'}`;

  if (message.type === 'image' && message.media_url) {
    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'message-media';

    const image = document.createElement('img');
    image.src = message.media_url;
    image.alt = message.content || 'Image message';
    image.className = 'message-image';
    mediaWrapper.appendChild(image);

    if (message.content) {
      const caption = document.createElement('p');
      caption.className = 'message-text';
      caption.textContent = message.content;
      mediaWrapper.appendChild(caption);
    }

    bubble.appendChild(mediaWrapper);
  } else if (message.type === 'audio' && message.media_url) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = message.media_url;
    audio.className = 'message-audio';
    bubble.appendChild(audio);

    if (message.content) {
      const caption = document.createElement('p');
      caption.className = 'message-text';
      caption.textContent = message.content;
      bubble.appendChild(caption);
    }
  } else if (message.type === 'video' && message.media_url) {
    const video = document.createElement('video');
    video.controls = true;
    video.src = message.media_url;
    video.className = 'message-video';
    bubble.appendChild(video);

    if (message.content) {
      const caption = document.createElement('p');
      caption.className = 'message-text';
      caption.textContent = message.content;
      bubble.appendChild(caption);
    }
  } else if (message.type === 'file' && message.media_url) {
    const link = document.createElement('a');
    link.href = message.media_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'message-file-link';
    link.textContent = message.content || 'Download file';
    bubble.appendChild(link);
  } else {
    const text = document.createElement('p');
    text.className = 'message-text';
    text.textContent = message.content;
    bubble.appendChild(text);
  }

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.textContent = time;

  bubble.appendChild(meta);
  messagesView.appendChild(bubble);
  messagesView.scrollTop = messagesView.scrollHeight;
}

function createAvatarDataUrl(name = '', size = 64, bg = '#1d4ed8', fg = '#ffffff') {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>` +
    `<rect width='100%' height='100%' rx='${Math.floor(size*0.18)}' fill='${bg}'/>` +
    `<text x='50%' y='50%' dy='0.36em' font-family='Inter, system-ui, -apple-system, sans-serif' font-size='${Math.floor(size*0.48)}' fill='${fg}' text-anchor='middle'>${initial}</text>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function clearMessages() {
  messagesView.innerHTML = '';
}

async function loadContacts() {
  try {
    const [contactsResponse, groupsResponse] = await Promise.all([
      fetch('/api/contacts'),
      fetch('/api/groups'),
    ]);

    const contactData = contactsResponse.ok ? await contactsResponse.json() : [];
    const groupData = groupsResponse.ok ? await groupsResponse.json() : [];

    contacts = Array.isArray(contactData) ? contactData : [];
    groups = Array.isArray(groupData) ? groupData : [];

    renderGroups(groups);
    renderContacts(contacts);
    updateAddAllButton();

    if (!currentContact && !currentGroup) {
      if (groups.length > 0) {
        openGroupPanel(groups[0]);
      } else if (contacts.length > 0) {
        openChatPanel(contacts[0]);
      }
    }
  } catch (error) {
    console.error('Unable to load contacts or groups', error);
  }
}

function updateAddAllButton() {
  if (!addAllBtn) return;
  // Show Add All to any authenticated user when there are other contacts
  const canShow = contacts.length > 1 && currentUser;
  addAllBtn.style.display = canShow ? 'inline-flex' : 'none';
}

function showConfirmModal(message, title = 'Confirm') {
  return new Promise((resolve) => {
    if (!confirmModal) {
      resolve(window.confirm(message));
      return;
    }

    confirmMessage.textContent = message;
    const onYes = () => {
      cleanup();
      hideModals();
      resolve(true);
    };
    const onNo = () => {
      cleanup();
      hideModals();
      resolve(false);
    };
    function cleanup() {
      confirmYesBtn.removeEventListener('click', onYes);
      confirmNoBtn.removeEventListener('click', onNo);
    }

    showModal(confirmModal);
    confirmYesBtn.addEventListener('click', onYes);
    confirmNoBtn.addEventListener('click', onNo);
  });
}

function showToastConfirm(message) {
  return new Promise((resolve) => {
    if (!toastContainer) {
      resolve(window.confirm(message));
      return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="toast-message">${message}</div>
      <div class="toast-actions">
        <button class="confirm">Yes</button>
        <button class="cancel">Cancel</button>
      </div>
    `;

    const yesBtn = toast.querySelector('.confirm');
    const noBtn = toast.querySelector('.cancel');

    let finished = false;
    function cleanup(result) {
      if (finished) return;
      finished = true;
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      resolve(result);
    }

    function onYes() {
      cleanup(true);
    }
    function onNo() {
      cleanup(false);
    }

    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);

    toastContainer.appendChild(toast);

    // auto-dismiss after 10s
    setTimeout(() => cleanup(false), 10000);
  });
}

function renderGroups(list) {
  groupsList.innerHTML = '';
  if (list.length === 0) {
    groupsList.innerHTML = '<p class="empty-state">No groups yet.</p>';
    return;
  }

  list.forEach((group) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'contact-card';
    card.dataset.id = group.id;
    card.dataset.type = 'group';
    card.innerHTML = `
      <div class="contact-top">
        <span class="contact-name">${group.name}</span>
        <span class="contact-status">${group.member_count} members</span>
      </div>
      <div class="contact-preview">${group.last_message || 'No messages yet.'}</div>
    `;

    card.addEventListener('click', () => openGroupPanel(group));
    groupsList.appendChild(card);
  });
}

function renderContacts(list) {
  contactsList.innerHTML = '';
  if (list.length === 0) {
    contactsList.innerHTML = '<p class="empty-state">No contacts yet. Once users register, they will appear here.</p>';
    return;
  }

  list.forEach((contact) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'contact-card';
    card.dataset.id = contact.id;
    card.innerHTML = `
      <div class="contact-top">
        <span class="contact-name">${contact.username}</span>
        <span class="contact-status"><span class="status-dot ${contact.online ? 'online' : ''}"></span>${contact.online ? 'Online' : 'Offline'}</span>
      </div>
      <div class="contact-preview">${contact.last_message || 'No messages yet.'}</div>
    `;

    card.addEventListener('click', () => openChatPanel(contact));
    contactsList.appendChild(card);
  });
}

async function loadMessages(contactId) {
  if (!contactId) return;
  clearMessages();
  emptyState.classList.add('hidden');

  try {
    const response = await fetch(`/api/messages/${contactId}`);
    if (!response.ok) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = '<p class="empty-state">Unable to load conversation.</p>';
      return;
    }

    const data = await response.json();
    currentContact = data.contact;
    currentGroup = null;
    chatContactName.textContent = currentContact.username;
    chatHeaderStatus.textContent = currentContact.online ? 'Online' : 'Offline';

    if (data.messages.length === 0) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = '<p class="empty-state">No messages yet. Say hello!</p>';
      return;
    }

    data.messages.forEach(appendMessage);
  } catch (error) {
    console.error('Load messages error:', error);
  }
}

async function loadGroupMessages(groupId) {
  if (!groupId) return;
  clearMessages();
  emptyState.classList.add('hidden');

  try {
    const response = await fetch(`/api/groups/${groupId}/messages`);
    if (!response.ok) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = '<p class="empty-state">Unable to load group conversation.</p>';
      return;
    }

    const data = await response.json();
    currentGroup = data.group;

    if (data.messages.length === 0) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = '<p class="empty-state">No messages yet. Start the group chat!</p>';
      return;
    }

    data.messages.forEach(appendMessage);
  } catch (error) {
    console.error('Load group messages error:', error);
  }
}

function updateContactStatus(userId, online) {
  const matching = contacts.find((contact) => contact.id === userId);
  if (matching) {
    matching.online = online;
    renderContacts(contacts);
    if (currentContact && currentContact.id === userId) {
      chatHeaderStatus.textContent = online ? 'Online' : 'Offline';
    }
  }
}

function updateContactPreview(contactId, previewText) {
  const matching = contacts.find((contact) => contact.id === contactId);
  if (matching) {
    matching.last_message = previewText;
    renderContacts(contacts);
  }
}

function updateGroupPreview(groupId, previewText) {
  const matching = groups.find((group) => group.id === groupId);
  if (matching) {
    matching.last_message = previewText;
    renderGroups(groups);
  }
}

async function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Connected to Socket.io');
  });

  socket.on('new_message', (message) => {
    if (!currentContact) return;
    if (message.sender_id === currentContact.id || message.receiver_id === currentContact.id) {
      appendMessage(message);
    }
    const preview = message.content.length > 40 ? `${message.content.slice(0, 40)}...` : message.content;
    const otherId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;
    updateContactPreview(otherId, preview);
  });

  socket.on('typing', (data) => {
    if (data.groupId && currentGroup && data.groupId === currentGroup.id && data.senderId !== currentUser.id) {
      const sender = contacts.find((contact) => contact.id === data.senderId);
      const senderName = sender ? sender.username : 'A member';
      typingIndicator.textContent = `${senderName} is typing...`;
    } else if (currentContact && data.senderId === currentContact.id) {
      typingIndicator.textContent = `${currentContact.username} is typing...`;
    } else {
      return;
    }

    window.clearTimeout(typingTimeout);
    typingTimeout = window.setTimeout(() => {
      typingIndicator.textContent = '';
    }, 1500);
  });

  socket.on('group_message', (message) => {
    if (!currentGroup || message.group_id !== currentGroup.id) return;
    appendMessage(message);
    const preview = message.content.length > 40 ? `${message.content.slice(0, 40)}...` : message.content;
    updateGroupPreview(message.group_id, preview);
  });

  socket.on('user_status', (payload) => {
    updateContactStatus(payload.userId, payload.online);
  });
}

async function authenticateUser(user) {
  currentUser = user;
  renderProfile(user);
  hideModals();
  await loadContacts();
  if (user.isAdmin) {
    await loadAdminStats();
  }
  if (!socket) {
    connectSocket();
  }
}

async function handleLogin() {
  loginError.textContent = '';
  const payload = {
    email: loginEmail.value.trim(),
    password: loginPassword.value,
  };
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      loginError.textContent = result.error || 'Login failed.';
      return;
    }

    await authenticateUser(result.user);
  } catch (error) {
    loginError.textContent = 'Unable to reach server.';
    console.error(error);
  }
}

async function handleAdminLogin() {
  adminLoginError.textContent = '';
  const payload = {
    username: adminUsername.value.trim(),
    password: adminPassword.value,
  };
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      adminLoginError.textContent = result.error || 'Admin login failed.';
      return;
    }

    if (!result.user.isAdmin) {
      adminLoginError.textContent = 'Admin access required.';
      return;
    }

    await authenticateUser(result.user);
  } catch (error) {
    adminLoginError.textContent = 'Unable to reach server.';
    console.error(error);
  }
}

async function handleRegister() {
  registerError.textContent = '';
  const payload = {
    username: registerUsername.value.trim(),
    email: registerEmail.value.trim(),
    password: registerPassword.value,
  };

  if (!payload.username || !payload.email || !payload.password) {
    registerError.textContent = 'All registration fields are required.';
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      registerError.textContent = result.error || 'Unable to register.';
      return;
    }
    await authenticateUser(result.user);
  } catch (error) {
    registerError.textContent = 'Unable to reach server.';
    console.error(error);
  }
}

async function handleLogout() {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  currentContact = null;
  contacts = [];
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  profileName.textContent = '';
  messagesView.innerHTML = '';
  emptyState.classList.remove('hidden');
  emptyState.innerHTML = '<h2>Logged out</h2><p>Please log in again to continue.</p>';
  showLogin();
}

function throttle(fn, delay) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

const sendTypingEvent = throttle(() => {
  if (!socket) return;
  if (currentGroup) {
    socket.emit('typing', { groupId: currentGroup.id });
  } else if (currentContact) {
    socket.emit('typing', { receiverId: currentContact.id });
  }
}, 800);

function bindEvents() {
  loginBtn.addEventListener('click', handleLogin);
  showRegisterBtn.addEventListener('click', showRegister);
  showAdminLoginBtn.addEventListener('click', showAdminLogin);
  adminLoginBtn.addEventListener('click', handleAdminLogin);
  adminBackToLoginBtn.addEventListener('click', showLogin);
  registerBtn.addEventListener('click', handleRegister);
  backToLoginBtn.addEventListener('click', showLogin);
  logoutBtn.addEventListener('click', handleLogout);
  sendMessageBtn.addEventListener('click', () => {
    if ((!currentContact && !currentGroup) || !messageInput.value.trim()) return;
    const content = messageInput.value.trim();
    const payload = {
      content,
      type: 'text',
    };
    if (currentGroup) {
      payload.groupId = currentGroup.id;
      socket.emit('group_message', payload);
    } else {
      payload.receiverId = currentContact.id;
      socket.emit('private_message', payload);
    }
    messageInput.value = '';
  });
  emojiBtn.addEventListener('click', insertEmoji);
  attachMediaBtn.addEventListener('click', () => {
    if (!currentContact && !currentGroup) return;
    messageMediaInput.click();
  });
  recordVoiceBtn.addEventListener('click', () => {
    if (!currentContact && !currentGroup) return;
    toggleVoiceRecording();
  });
  messageMediaInput.addEventListener('change', () => {
    if (messageMediaInput.files.length > 0) {
      sendAssetFile(messageMediaInput.files[0]);
    }
  });
  newGroupBtn.addEventListener('click', handleCreateGroup);
  addAllBtn.addEventListener('click', handleCreateGroupWithAll);
  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
  if (assistantBtn) assistantBtn.addEventListener('click', () => showAssistant());
  if (assistantSendBtn) assistantSendBtn.addEventListener('click', sendAssistantMessage);
  if (assistantInput) assistantInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAssistantMessage(); });
  if (assistantCloseBtn) assistantCloseBtn.addEventListener('click', hideAssistant);
  changePasswordBtn.addEventListener('click', showChangePasswordModal);
  changePasswordSubmitBtn.addEventListener('click', handleChangePassword);
  changePasswordCancelBtn.addEventListener('click', hideModals);
  adminLoadConversationBtn.addEventListener('click', handleAdminLoadConversation);
  messageInput.addEventListener('input', sendTypingEvent);
  contactSearch.addEventListener('input', () => {
    const query = contactSearch.value.trim().toLowerCase();
    renderContacts(
      contacts.filter((contact) => contact.username.toLowerCase().includes(query) || contact.last_message.toLowerCase().includes(query))
    );
    renderGroups(
      groups.filter((group) => group.name.toLowerCase().includes(query) || group.last_message.toLowerCase().includes(query))
    );
  });
}

async function handleCreateGroup() {
  const groupName = prompt('Enter a name for the new group:');
  if (!groupName || !groupName.trim()) return;

  const memberPrompt = prompt('Enter user IDs to add to the group, separated by commas. Type "all" to add every contact. Your own account is added automatically.');
  let memberIds = [];
  if (memberPrompt) {
    const normalized = memberPrompt.trim().toLowerCase();
    if (normalized === 'all') {
      memberIds = contacts
        .filter((contact) => contact.id !== currentUser.id)
        .map((contact) => contact.id);
    } else {
      memberIds = memberPrompt
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => id && id !== currentUser.id);
    }
  }

  try {
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName.trim(), memberIds }),
    });
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || 'Unable to create group.');
      return;
    }
    await loadContacts();
    const createdGroup = groups.find((g) => g.id === result.groupId);
    if (createdGroup) {
      openGroupPanel(createdGroup);
    }
  } catch (error) {
    console.error('Create group failed:', error);
    alert('Unable to create group.');
  }
}

async function handleCreateGroupWithAll() {
  if (!contacts.length || contacts.length === 1) {
    alert('There are no contacts available to add.');
    return;
  }

  const groupName = prompt('Enter a name for the new all-contacts group:');
  if (!groupName || !groupName.trim()) return;
  const confirmed = await showToastConfirm(`Create group "${groupName.trim()}" with ${contacts.length - 1} members?`);
  if (!confirmed) return;
  const memberIds = contacts
    .filter((contact) => contact.id !== currentUser.id)
    .map((contact) => contact.id);

  try {
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName.trim(), memberIds }),
    });
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || 'Unable to create group.');
      return;
    }
    await loadContacts();
    const createdGroup = groups.find((g) => g.id === result.groupId);
    if (createdGroup) {
      openGroupPanel(createdGroup);
    }
  } catch (error) {
    console.error('Create all group failed:', error);
    alert('Unable to create group.');
  }
}

async function init() {
  bindEvents();
  const user = await fetchProfile();
  if (user) {
    await authenticateUser(user);
  }
  // register service worker for PWA
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service worker registered');
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }
}

init();
