document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshIcon = document.getElementById('refreshIcon');

  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const expFilter = document.getElementById('expFilter');
  const viewTableBtn = document.getElementById('viewTableBtn');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const tableViewContainer = document.getElementById('tableViewContainer');
  const gridViewContainer = document.getElementById('gridViewContainer');
  const applicationsTableBody = document.getElementById('applicationsTableBody');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');

  // Stats elements
  const statTotal = document.getElementById('statTotal');
  const statToday = document.getElementById('statToday');
  const statPending = document.getElementById('statPending');
  const statReviewing = document.getElementById('statReviewing');
  const statShortlisted = document.getElementById('statShortlisted');
  const statHired = document.getElementById('statHired');

  // Details Modal elements
  const detailsModal = document.getElementById('detailsModal');
  const closeDetailsBtn = document.getElementById('closeDetailsBtn');
  const modalName = document.getElementById('modalName');
  const modalExpBadge = document.getElementById('modalExpBadge');
  const modalLocation = document.getElementById('modalLocation');
  const modalTaskLinkText = document.getElementById('modalTaskLinkText');
  const modalTaskLinkBtn = document.getElementById('modalTaskLinkBtn');
  const modalWhatsapp = document.getElementById('modalWhatsapp');
  const modalWhatsappBtn = document.getElementById('modalWhatsappBtn');
  const modalAltPhone = document.getElementById('modalAltPhone');
  const modalTelegram = document.getElementById('modalTelegram');
  const modalInstagram = document.getElementById('modalInstagram');
  const modalSkillsContainer = document.getElementById('modalSkillsContainer');
  const modalPastChannels = document.getElementById('modalPastChannels');
  const modalStatusSelect = document.getElementById('modalStatusSelect');
  const modalNotes = document.getElementById('modalNotes');
  const saveNotesBtn = document.getElementById('saveNotesBtn');

  // Delete Modal elements
  const deleteModal = document.getElementById('deleteModal');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  // State
  let currentPassword = localStorage.getItem('admin_pwd') || '';
  let activeApplications = [];
  let currentView = 'table'; // 'table' or 'grid'
  let activeDetailId = null;
  let deleteTargetId = null;
  let searchDebounceTimer = null;

  // Initialize Lucide icons
  const refreshIcons = () => {
    if (window.lucide) window.lucide.createIcons();
  };

  // Helper: Auth Headers
  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'x-admin-password': currentPassword
    };
  };

  // Status badge styling helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return '<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">Pending</span>';
      case 'Reviewing':
        return '<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">Reviewing</span>';
      case 'Shortlisted':
        return '<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">Shortlisted</span>';
      case 'Hired':
        return '<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Hired</span>';
      case 'Rejected':
        return '<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30">Rejected</span>';
      default:
        return `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-500/15 text-gray-300 border border-gray-500/30">${status}</span>`;
    }
  };

  // WhatsApp Link Generator
  const generateWhatsAppUrl = (phone, name) => {
    if (!phone) return '#';
    const cleanNumber = phone.replace(/[^\d]/g, '');
    const message = encodeURIComponent(`Hi ${name}, we reviewed your video editor application for CineCraft Studio! We would love to discuss next steps.`);
    return `https://wa.me/${cleanNumber}?text=${message}`;
  };

  // Format Date Helper
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Verify and Unlock Dashboard
  const verifyAndLogin = async (pwd) => {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        currentPassword = pwd;
        localStorage.setItem('admin_pwd', pwd);
        loginOverlay.classList.add('hidden');
        loginError.classList.add('hidden');
        loadAllData();
      } else {
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      loginError.textContent = 'Server connection error. Please try again.';
      loginError.classList.remove('hidden');
    }
  };

  // Login Form Submit
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pwd = adminPasswordInput.value.trim();
    if (pwd) verifyAndLogin(pwd);
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('admin_pwd');
    currentPassword = '';
    adminPasswordInput.value = '';
    loginOverlay.classList.remove('hidden');
  });

  // Check initial login state
  if (currentPassword) {
    verifyAndLogin(currentPassword);
  } else {
    loginOverlay.classList.remove('hidden');
  }

  // Fetch Stats
  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        loginOverlay.classList.remove('hidden');
        return;
      }
      const data = await res.json();
      if (data.success && data.stats) {
        const s = data.stats;
        statTotal.textContent = s.total;
        statToday.textContent = s.today;
        statPending.textContent = s.pending;
        statReviewing.textContent = s.reviewing;
        statShortlisted.textContent = s.shortlisted;
        statHired.textContent = s.hired;
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Fetch Applications
  const loadApplications = async () => {
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');

    const search = searchInput.value.trim();
    const status = statusFilter.value;
    const experience = expFilter.value;

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status !== 'all') params.append('status', status);
    if (experience !== 'all') params.append('experience', experience);

    try {
      const res = await fetch(`/api/admin/applications?${params.toString()}`, {
        headers: getAuthHeaders()
      });

      if (res.status === 401) {
        loginOverlay.classList.remove('hidden');
        return;
      }

      const data = await res.json();
      loadingState.classList.add('hidden');

      if (data.success) {
        activeApplications = data.applications || [];
        renderApplications();
      } else {
        emptyState.classList.remove('hidden');
      }
    } catch (err) {
      loadingState.classList.add('hidden');
      console.error('Failed to load applications:', err);
    }
  };

  // Combined data refresh
  const loadAllData = async () => {
    if (refreshIcon) refreshIcon.classList.add('animate-spin');
    await Promise.all([loadStats(), loadApplications()]);
    if (refreshIcon) setTimeout(() => refreshIcon.classList.remove('animate-spin'), 300);
  };

  refreshBtn.addEventListener('click', loadAllData);

  // Render Table & Cards
  const renderApplications = () => {
    if (activeApplications.length === 0) {
      tableViewContainer.classList.add('hidden');
      gridViewContainer.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    if (currentView === 'table') {
      tableViewContainer.classList.remove('hidden');
      gridViewContainer.classList.add('hidden');
      renderTable();
    } else {
      tableViewContainer.classList.add('hidden');
      gridViewContainer.classList.remove('hidden');
      renderGrid();
    }

    refreshIcons();
  };

  // Render Table View
  const renderTable = () => {
    applicationsTableBody.innerHTML = activeApplications.map(app => {
      const waUrl = generateWhatsAppUrl(app.whatsapp, app.full_name);
      return `
        <tr class="hover:bg-white/[0.02] transition-colors">
          <!-- Candidate -->
          <td class="py-3.5 px-4">
            <div class="font-bold text-white text-sm">${escapeHtml(app.full_name)}</div>
            <div class="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
              ${app.address_city ? `<i data-lucide="map-pin" class="w-3 h-3"></i> ${escapeHtml(app.address_city)}` : 'Remote'}
            </div>
          </td>

          <!-- Experience -->
          <td class="py-3.5 px-4 font-mono">
            <span class="text-xs px-2 py-0.5 rounded bg-dark-800 border border-white/10 text-cyan-300">
              ${escapeHtml(app.experience)}
            </span>
          </td>

          <!-- WhatsApp Chat -->
          <td class="py-3.5 px-4">
            <a href="${waUrl}" target="_blank" class="whatsapp-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-white font-semibold text-xs shadow-sm">
              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
              <span>${escapeHtml(app.whatsapp)}</span>
            </a>
          </td>

          <!-- Task Video Link -->
          <td class="py-3.5 px-4">
            <a href="${escapeHtml(app.task_link)}" target="_blank" class="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline font-mono text-xs max-w-[180px] truncate">
              <i data-lucide="play" class="w-3 h-3 shrink-0"></i>
              <span class="truncate">View Video Edit</span>
              <i data-lucide="external-link" class="w-3 h-3 shrink-0"></i>
            </a>
          </td>

          <!-- Status Dropdown -->
          <td class="py-3.5 px-4">
            <select
              data-id="${app.id}"
              class="status-select bg-dark-800 border border-white/10 rounded-lg px-2 py-1 text-xs font-semibold outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer ${getStatusSelectColor(app.status)}"
            >
              <option value="Pending" ${app.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Reviewing" ${app.status === 'Reviewing' ? 'selected' : ''}>Reviewing</option>
              <option value="Shortlisted" ${app.status === 'Shortlisted' ? 'selected' : ''}>Shortlisted</option>
              <option value="Hired" ${app.status === 'Hired' ? 'selected' : ''}>Hired</option>
              <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
            </select>
          </td>

          <!-- Applied Date -->
          <td class="py-3.5 px-4 text-gray-400 font-mono text-[11px] whitespace-nowrap">
            ${formatDate(app.created_at)}
          </td>

          <!-- Actions -->
          <td class="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
            <button
              data-id="${app.id}"
              class="view-detail-btn px-2.5 py-1 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-200 hover:text-white border border-white/10 text-xs transition-colors"
              title="View full profile"
            >
              Details
            </button>
            <button
              data-id="${app.id}"
              class="delete-app-btn p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs transition-colors inline-flex items-center"
              title="Delete candidate"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    attachRowListeners();
  };

  // Render Grid/Card View
  const renderGrid = () => {
    gridViewContainer.innerHTML = activeApplications.map(app => {
      const waUrl = generateWhatsAppUrl(app.whatsapp, app.full_name);
      return `
        <div class="glass-panel p-5 rounded-2xl border-white/10 space-y-4 hover:border-purple-500/30 transition-all">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-bold text-white text-base font-display">${escapeHtml(app.full_name)}</h3>
              <p class="text-xs text-gray-400">${app.address_city ? escapeHtml(app.address_city) : 'Remote'}</p>
            </div>
            ${getStatusBadge(app.status)}
          </div>

          <div class="flex items-center gap-2 text-xs">
            <span class="px-2 py-0.5 rounded bg-dark-800 border border-white/10 text-cyan-300 font-mono">
              ${escapeHtml(app.experience)}
            </span>
            <span class="text-gray-500 font-mono text-[11px]">${formatDate(app.created_at)}</span>
          </div>

          <!-- Video task preview link -->
          <div class="p-2.5 rounded-xl bg-dark-900 border border-white/5 flex items-center justify-between text-xs">
            <span class="text-gray-400 flex items-center gap-1.5">
              <i data-lucide="video" class="w-3.5 h-3.5 text-purple-400"></i>
              <span>Task Video:</span>
            </span>
            <a href="${escapeHtml(app.task_link)}" target="_blank" class="text-cyan-400 hover:text-cyan-300 font-mono font-medium flex items-center gap-1">
              <span>View Clip</span>
              <i data-lucide="external-link" class="w-3 h-3"></i>
            </a>
          </div>

          <!-- Actions -->
          <div class="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
            <a href="${waUrl}" target="_blank" class="whatsapp-btn flex-1 py-1.5 rounded-xl text-white font-semibold text-xs flex items-center justify-center gap-1.5">
              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
              <span>WhatsApp</span>
            </a>
            <button data-id="${app.id}" class="view-detail-btn px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 border border-white/10 text-xs font-medium text-gray-200">
              Details
            </button>
            <button data-id="${app.id}" class="delete-app-btn p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    attachRowListeners();
  };

  // Helper: Status select color
  const getStatusSelectColor = (status) => {
    switch(status) {
      case 'Pending': return 'text-amber-300';
      case 'Reviewing': return 'text-blue-300';
      case 'Shortlisted': return 'text-purple-300';
      case 'Hired': return 'text-emerald-300';
      case 'Rejected': return 'text-red-300';
      default: return 'text-gray-300';
    }
  };

  // Event Listeners for dynamic rows
  const attachRowListeners = () => {
    // Status change selects
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const newStatus = e.target.value;
        await updateApplicationStatus(id, newStatus);
      });
    });

    // View Details Buttons
    document.querySelectorAll('.view-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openDetailsModal(id);
      });
    });

    // Delete Buttons
    document.querySelectorAll('.delete-app-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteTargetId = btn.getAttribute('data-id');
        deleteModal.classList.remove('hidden');
        refreshIcons();
      });
    });
  };

  // Update Status API
  const updateApplicationStatus = async (id, status, notes = undefined) => {
    try {
      const payload = { status };
      if (notes !== undefined) payload.notes = notes;

      const res = await fetch(`/api/admin/applications/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        // Update local item
        const idx = activeApplications.findIndex(a => a.id == id);
        if (idx !== -1) {
          activeApplications[idx].status = status;
          if (notes !== undefined) activeApplications[idx].notes = notes;
        }
        loadStats();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Open Details Modal
  const openDetailsModal = (id) => {
    const app = activeApplications.find(a => a.id == id);
    if (!app) return;

    activeDetailId = id;
    modalName.textContent = app.full_name;
    modalExpBadge.textContent = app.experience;
    modalLocation.innerHTML = `<i data-lucide="map-pin" class="w-3.5 h-3.5 text-gray-500"></i> <span>${escapeHtml(app.address_city || 'Location not specified')}</span>`;

    modalTaskLinkText.textContent = app.task_link;
    modalTaskLinkBtn.href = app.task_link;

    modalWhatsapp.textContent = app.whatsapp;
    modalWhatsappBtn.href = generateWhatsAppUrl(app.whatsapp, app.full_name);

    modalAltPhone.textContent = app.alt_phone || '—';
    modalTelegram.textContent = app.telegram || '—';
    modalInstagram.textContent = app.instagram || '—';

    // Skills Badges
    const skillsList = app.skills ? app.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (skillsList.length > 0) {
      modalSkillsContainer.innerHTML = skillsList.map(skill => `
        <span class="px-2.5 py-1 rounded-lg bg-dark-800 border border-white/10 text-gray-200 text-xs">
          ${escapeHtml(skill)}
        </span>
      `).join('');
    } else {
      modalSkillsContainer.innerHTML = '<span class="text-gray-500 text-xs">No specific software highlighted</span>';
    }

    // Past Channels
    if (app.never_worked_before) {
      modalPastChannels.innerHTML = '<span class="text-purple-400 font-semibold">Fresh Talent:</span> Marked as no previous client experience. Eager to start.';
    } else {
      modalPastChannels.textContent = app.past_channels || 'None provided';
    }

    modalStatusSelect.value = app.status;
    modalNotes.value = app.notes || '';

    detailsModal.classList.remove('hidden');
    refreshIcons();
  };

  // Close Details Modal
  closeDetailsBtn.addEventListener('click', () => {
    detailsModal.classList.add('hidden');
    activeDetailId = null;
  });

  // Save Notes from Details Modal
  saveNotesBtn.addEventListener('click', async () => {
    if (!activeDetailId) return;
    const newStatus = modalStatusSelect.value;
    const newNotes = modalNotes.value.trim();

    saveNotesBtn.disabled = true;
    saveNotesBtn.textContent = 'Saving...';

    await updateApplicationStatus(activeDetailId, newStatus, newNotes);

    saveNotesBtn.disabled = false;
    saveNotesBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> <span>Saved!</span>';
    refreshIcons();

    setTimeout(() => {
      saveNotesBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> <span>Save Changes</span>';
      refreshIcons();
      detailsModal.classList.add('hidden');
      renderApplications();
    }, 500);
  });

  // Cancel Delete
  cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteTargetId = null;
  });

  // Confirm Delete
  confirmDeleteBtn.addEventListener('click', async () => {
    if (!deleteTargetId) return;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting...';

    try {
      const res = await fetch(`/api/admin/applications/${deleteTargetId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (data.success) {
        activeApplications = activeApplications.filter(a => a.id != deleteTargetId);
        renderApplications();
        loadStats();
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = 'Delete';
      deleteModal.classList.add('hidden');
      deleteTargetId = null;
    }
  });

  // Search input live filtering with debounce
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(loadApplications, 300);
  });

  // Status and Experience filters
  statusFilter.addEventListener('change', loadApplications);
  expFilter.addEventListener('change', loadApplications);

  // View switchers
  viewTableBtn.addEventListener('click', () => {
    currentView = 'table';
    viewTableBtn.classList.add('bg-purple-600', 'text-white');
    viewTableBtn.classList.remove('text-gray-400');
    viewGridBtn.classList.remove('bg-purple-600', 'text-white');
    viewGridBtn.classList.add('text-gray-400');
    renderApplications();
  });

  viewGridBtn.addEventListener('click', () => {
    currentView = 'grid';
    viewGridBtn.classList.add('bg-purple-600', 'text-white');
    viewGridBtn.classList.remove('text-gray-400');
    viewTableBtn.classList.remove('bg-purple-600', 'text-white');
    viewTableBtn.classList.add('text-gray-400');
    renderApplications();
  });

  // Utility: HTML Escaper to prevent XSS
  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
  }
});
