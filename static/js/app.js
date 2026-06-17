// App State
let allNotes = [];
let filteredNotes = [];
let selectedNote = null;
let currentFilter = 'all';
let currentSearchQuery = '';

// DOM Elements
const notesList = document.getElementById('notes-list');
const loadingSkeleton = document.getElementById('loading-skeleton');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');

const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const filterContainer = document.getElementById('filter-container');
const btnRefresh = document.getElementById('btn-refresh');
const btnRetry = document.getElementById('btn-retry');
const btnResetFilters = document.getElementById('btn-reset-filters');
const lastFetchedText = document.getElementById('last-fetched-text');
const statusDot = document.getElementById('status-dot');

// Detail Panel Elements
const detailPanel = document.getElementById('detail-panel');
const detailEmptyState = document.getElementById('detail-empty-state');
const detailContentState = document.getElementById('detail-content-state');
const detailDate = document.getElementById('detail-date');
const detailBadge = document.getElementById('detail-badge');
const detailHtml = document.getElementById('detail-html');

// Tweet Editor Elements
const tweetTextarea = document.getElementById('tweet-textarea');
const tweetCharCount = document.getElementById('tweet-char-count');
const tweetCharBadge = document.getElementById('tweet-char-badge');
const btnTweet = document.getElementById('btn-tweet');
const charLimitWarning = document.getElementById('char-limit-warning');
const tweetTemplateSelect = document.getElementById('tweet-template-select');
const btnExportCsv = document.getElementById('btn-export-csv');
const themeToggle = document.getElementById('theme-toggle');

// Standard BigQuery Documentation Link
const DOC_URL = "https://cloud.google.com/bigquery/docs/release-notes";

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh Release Notes
    btnRefresh.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Retry fetching on error
    btnRetry.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Export to CSV
    btnExportCsv.addEventListener('click', exportToCSV);

    // Theme Switch Toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Reset all filters and search
    btnResetFilters.addEventListener('click', resetFilters);

    // Search Input
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        btnClearSearch.style.display = currentSearchQuery ? 'block' : 'none';
        applyFilters();
    });

    // Clear Search Input
    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchQuery = '';
        btnClearSearch.style.display = 'none';
        applyFilters();
        searchInput.focus();
    });

    // Category Filter Pills
    filterContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;

        // Toggle active status in UI
        filterContainer.querySelectorAll('.pill').forEach(btn => btn.classList.remove('active'));
        pill.classList.add('active');

        // Apply filter
        currentFilter = pill.dataset.filter;
        applyFilters();
    });

    // Tweet template change
    tweetTemplateSelect.addEventListener('change', () => {
        if (selectedNote) {
            updateTweetDraft();
        }
    });

    // Tweet character count listener
    tweetTextarea.addEventListener('input', () => {
        updateCharCounter();
    });

    // Tweet posting intent
    btnTweet.addEventListener('click', () => {
        if (!selectedNote) return;
        const tweetText = tweetTextarea.value.trim();
        if (!tweetText) return;

        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    });
}

// Fetch Release Notes
async function fetchReleaseNotes(force = false) {
    showLoading(true);
    
    // UI Feedback for fetching state
    statusDot.className = 'pulse-indicator status-fetching';
    lastFetchedText.innerText = 'Syncing feed...';
    btnRefresh.disabled = true;
    
    try {
        const response = await fetch(`/api/release-notes${force ? '?force=true' : ''}`);
        const result = await response.json();

        if (result.status === 'success' || result.status === 'warning') {
            allNotes = result.data;
            
            // Render Last Fetched Time
            const fetchDate = new Date(result.last_fetched);
            lastFetchedText.innerText = `Synced at ${fetchDate.toLocaleTimeString()}`;
            statusDot.className = 'pulse-indicator status-synced';
            
            if (result.status === 'warning') {
                console.warn(result.message);
                lastFetchedText.innerText += ' (Offline/Cached)';
            }
            
            applyFilters();
        } else {
            showError(result.message || 'Server encountered an error while processing release notes.');
        }
    } catch (err) {
        showError('Network error: Unable to connect to the Flask server.');
        console.error('Error fetching release notes:', err);
    } finally {
        showLoading(false);
        btnRefresh.disabled = false;
    }
}

// Show Loading State
function showLoading(isLoading) {
    if (isLoading) {
        loadingSkeleton.style.display = 'block';
        notesList.style.display = 'none';
        emptyState.style.display = 'none';
        errorState.style.display = 'none';
    } else {
        loadingSkeleton.style.display = 'none';
    }
}

// Show Error State
function showError(message) {
    errorMessage.innerText = message;
    errorState.style.display = 'flex';
    notesList.style.display = 'none';
    emptyState.style.display = 'none';
    loadingSkeleton.style.display = 'none';
    statusDot.className = 'pulse-indicator status-error';
    lastFetchedText.innerText = 'Sync failed';
}

// Reset all Filters
function resetFilters() {
    searchInput.value = '';
    currentSearchQuery = '';
    btnClearSearch.style.display = 'none';
    
    filterContainer.querySelectorAll('.pill').forEach(btn => btn.classList.remove('active'));
    filterContainer.querySelector('[data-filter="all"]').classList.add('active');
    currentFilter = 'all';
    
    applyFilters();
}

// Filter release notes
function applyFilters() {
    filteredNotes = allNotes.filter(note => {
        // Apply Category Filter
        const noteType = note.type.toLowerCase();
        let matchesCategory = true;
        
        if (currentFilter !== 'all') {
            if (currentFilter === 'feature' && noteType !== 'feature') matchesCategory = false;
            else if (currentFilter === 'announcement' && noteType !== 'announcement') matchesCategory = false;
            else if (currentFilter === 'issue' && noteType !== 'issue') matchesCategory = false;
            else if (currentFilter === 'deprecated' && noteType !== 'deprecated') matchesCategory = false;
            else if (currentFilter === 'changed' && noteType !== 'changed') matchesCategory = false;
        }

        // Apply Search Filter
        let matchesSearch = true;
        if (currentSearchQuery) {
            const dateMatch = note.date.toLowerCase().includes(currentSearchQuery);
            const typeMatch = note.type.toLowerCase().includes(currentSearchQuery);
            const textMatch = note.text.toLowerCase().includes(currentSearchQuery);
            matchesSearch = dateMatch || typeMatch || textMatch;
        }

        return matchesCategory && matchesSearch;
    });

    renderFeedList();
}

// Render feed list
function renderFeedList() {
    notesList.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        notesList.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }

    notesList.style.display = 'flex';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';

    filteredNotes.forEach(note => {
        const card = document.createElement('article');
        card.className = `note-card ${selectedNote && selectedNote.id === note.id ? 'selected' : ''}`;
        
        // Define accent colors variables based on update type
        const accentColor = getAccentColorForType(note.type);
        card.style.setProperty('--card-accent-color', accentColor);
        
        const badgeClass = getBadgeClassForType(note.type);
        
        card.innerHTML = `
            <div class="card-header">
                <span class="card-date">${note.date}</span>
                <div class="card-actions">
                    <button class="btn-copy-card" title="Copy text to clipboard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                    <span class="badge ${badgeClass}">${note.type}</span>
                </div>
            </div>
            <div class="card-body">
                <p>${escapeHTML(note.text)}</p>
            </div>
        `;

        // Copy button action
        const copyBtn = card.querySelector('.btn-copy-card');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop click from bubbling up to selecting card
            copyTextToClipboard(note.text, copyBtn);
        });

        card.addEventListener('click', () => {
            selectNoteCard(note, card);
        });

        notesList.appendChild(card);
    });
}

// Select a Release Note Card
function selectNoteCard(note, cardElement) {
    // Manage selected state in UI
    document.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected'));
    cardElement.classList.add('selected');
    
    selectedNote = note;
    
    // Render Detail View
    detailEmptyState.style.display = 'none';
    detailContentState.style.display = 'flex';
    
    detailDate.innerText = note.date;
    
    // Set Detail Badge
    detailBadge.className = `badge ${getBadgeClassForType(note.type)}`;
    detailBadge.innerText = note.type;
    
    // Render official HTML
    detailHtml.innerHTML = note.html;
    
    // Generate draft tweet
    updateTweetDraft();
    
    // Scroll detail panel on mobile
    if (window.innerWidth <= 1024) {
        detailPanel.scrollIntoView({ behavior: 'smooth' });
    }
}

// Generate Tweet Text
function generateTweetText(note, style) {
    const date = note.date;
    const desc = note.text;
    
    // Compute sizes for template components to stay under 280 characters
    const tags = " #GoogleCloud #BigQuery";
    
    switch(style) {
        case 'professional': {
            const prefix = `💼 BigQuery update (${date}):\n\n`;
            const suffix = `\n\nDocs: ${DOC_URL}`;
            const limit = 280 - prefix.length - suffix.length;
            const text = desc.length > limit ? desc.substring(0, limit - 3) + "..." : desc;
            return prefix + text + suffix;
        }
        case 'minimalist': {
            const prefix = `⚡ BigQuery (${date}): `;
            const suffix = `\n${DOC_URL}`;
            const limit = 280 - prefix.length - suffix.length;
            const text = desc.length > limit ? desc.substring(0, limit - 3) + "..." : desc;
            return prefix + text + suffix;
        }
        case 'enthusiastic': {
            const prefix = `🚀 Awesome BigQuery update on ${date}!\n\n`;
            const suffix = `\n\n${tags}`;
            const limit = 280 - prefix.length - suffix.length;
            const text = desc.length > limit ? desc.substring(0, limit - 3) + "..." : desc;
            return prefix + text + suffix;
        }
        case 'default':
        default: {
            const prefix = `✨ BigQuery Update (${date}): `;
            const suffix = tags;
            const limit = 280 - prefix.length - suffix.length;
            const text = desc.length > limit ? desc.substring(0, limit - 3) + "..." : desc;
            return prefix + text + suffix;
        }
    }
}

// Update Tweet Draft Workspace
function updateTweetDraft() {
    const style = tweetTemplateSelect.value;
    const draftText = generateTweetText(selectedNote, style);
    tweetTextarea.value = draftText;
    updateCharCounter();
}

// Update character counter badge
function updateCharCounter() {
    const len = tweetTextarea.value.length;
    tweetCharCount.innerText = len;
    
    // Reset classes
    tweetCharBadge.className = 'character-count-badge';
    charLimitWarning.style.display = 'none';
    btnTweet.disabled = false;
    
    if (len > 280) {
        tweetCharBadge.classList.add('error');
        charLimitWarning.style.display = 'block';
        btnTweet.disabled = true;
    } else if (len >= 250) {
        tweetCharBadge.classList.add('warning');
    }
}

// Utility Badge Classes mapping
function getBadgeClassForType(type) {
    const t = type.toLowerCase();
    if (t.includes('feature')) return 'badge-feature';
    if (t.includes('announcement')) return 'badge-announcement';
    if (t.includes('issue')) return 'badge-issue';
    if (t.includes('deprecated')) return 'badge-deprecated';
    if (t.includes('changed') || t.includes('change')) return 'badge-changed';
    return 'badge-fallback';
}

// Utility Accent CSS Colors mapping
function getAccentColorForType(type) {
    const t = type.toLowerCase();
    if (t.includes('feature')) return 'var(--color-feature)';
    if (t.includes('announcement')) return 'var(--color-announcement)';
    if (t.includes('issue')) return 'var(--color-issue)';
    if (t.includes('deprecated')) return 'var(--color-deprecated)';
    if (t.includes('changed') || t.includes('change')) return 'var(--color-changed)';
    return 'var(--color-fallback)';
}

// Escape HTML utility
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Export currently filtered list to CSV
function exportToCSV() {
    if (filteredNotes.length === 0) {
        alert("No release notes available to export.");
        return;
    }
    
    const headers = ["Date", "Category", "Description"];
    
    const rows = filteredNotes.map(note => {
        const date = note.date.replace(/"/g, '""');
        const category = note.type.replace(/"/g, '""');
        const text = note.text.replace(/"/g, '""');
        
        return `"${date}","${category}","${text}"`;
    });
    
    const csvContent = [headers.join(","), ...rows].join("\r\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const dateTag = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_release_notes_${dateTag}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Clipboard copier with animation feedback
function copyTextToClipboard(text, btnElement) {
    if (!navigator.clipboard) {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
            showCopySuccess(btnElement);
        } catch (err) {
            console.error("Fallback copy failed", err);
        }
        document.body.removeChild(textarea);
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showCopySuccess(btnElement);
    }).catch(err => {
        console.error("Clipboard copy failed", err);
    });
}

function showCopySuccess(btnElement) {
    btnElement.classList.add('copied');
    const originalSvg = btnElement.innerHTML;
    
    btnElement.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    `;
    
    setTimeout(() => {
        btnElement.classList.remove('copied');
        btnElement.innerHTML = originalSvg;
    }, 1500);
}

// Theme Initializer
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
}

// Toggle Theme Handler
function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const activeTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    localStorage.setItem('theme', activeTheme);
}
