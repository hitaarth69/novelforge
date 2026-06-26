// ----- DOM Refs -----
const appContent = document.getElementById('app-content');
const navTabs = document.querySelectorAll('.nav-tab');
const modalContainer = document.getElementById('modal-container');
const themeToggle = document.getElementById('theme-toggle');
const wordCountDisplay = document.getElementById('word-count-display');
const streakDisplay = document.getElementById('streak-display');

// ----- State -----
let currentProject = null;
let currentChapterIndex = 0;
let currentReaderChapterIndex = 0;
let currentTab = 'dashboard';
let isDark = true;
let autoSaveTimer = null;
let wordGoal = parseInt(localStorage.getItem('novelforge_word_goal')) || 500;
let readerFontSize = parseInt(localStorage.getItem('novelforge_reader_font_size')) || 18;
let readerFontFamily = localStorage.getItem('novelforge_reader_font') || 'Georgia, serif';
let readerTheme = localStorage.getItem('novelforge_reader_theme') || 'light';
let isFocusMode = false;

// ----- Simple DB (LocalStorage) -----
function getProjects() {
    try { return JSON.parse(localStorage.getItem('novelforge_projects')) || []; } catch { return []; }
}
function saveProject(project) {
    let projects = getProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx > -1) projects[idx] = project;
    else projects.push(project);
    localStorage.setItem('novelforge_projects', JSON.stringify(projects));
    updateStreak(project);
}
function deleteProject(id) {
    let projects = getProjects().filter(p => p.id !== id);
    localStorage.setItem('novelforge_projects', JSON.stringify(projects));
}
function getProject(id) { return getProjects().find(p => p.id === id) || null; }

// ----- Streak Logic -----
function updateStreak(project) {
    const today = new Date().toDateString();
    const lastEdit = project.updatedAt ? new Date(project.updatedAt).toDateString() : null;
    let streak = parseInt(localStorage.getItem('novelforge_streak')) || 0;
    let lastActive = localStorage.getItem('novelforge_last_active');
    if (lastEdit === today) {
        if (lastActive !== today) {
            streak += 1;
            localStorage.setItem('novelforge_streak', streak);
            localStorage.setItem('novelforge_last_active', today);
        }
    } else {
        // Check if yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastActive !== yesterday.toDateString() && lastActive !== today) {
            streak = 0;
            localStorage.setItem('novelforge_streak', 0);
        }
    }
    if (streakDisplay) streakDisplay.textContent = `🔥 ${streak}`;
}

// ----- Word Count -----
function countWords(project) {
    if (!project || !project.chapters) return 0;
    return project.chapters.reduce((sum, c) => sum + (c.content?.split(/\s+/).filter(w => w.length > 0).length || 0), 0);
}
function getTodayWords(project) {
    // Simple: words in project if updated today
    const today = new Date().toDateString();
    if (new Date(project.updatedAt).toDateString() === today) {
        return countWords(project);
    }
    return 0;
}

// ----- Init -----
function init() {
    console.log('🚀 NovelForge Pro initializing...');
    const savedTheme = localStorage.getItem('novelforge_theme');
    if (savedTheme === 'light') { isDark = false; document.documentElement.setAttribute('data-theme', 'light'); themeToggle.textContent = '☀️'; }
    const lastId = localStorage.getItem('novelforge_last_project');
    if (lastId) { const p = getProject(lastId); if (p) currentProject = p; }
    if (!currentProject) {
        currentProject = {
            id: Date.now().toString(36),
            title: 'My First Novel',
            chapters: [{ id: 'ch1', title: 'Chapter 1', content: '# Welcome to NovelForge Pro\n\nStart writing your masterpiece here...' }],
            characters: [],
            locations: [],
            relationships: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        saveProject(currentProject);
        localStorage.setItem('novelforge_last_project', currentProject.id);
    }
    setupEventListeners();
    renderTab('dashboard');
    console.log('✅ NovelForge Pro ready!');
}

// ----- Routing -----
function renderTab(tab) {
    currentTab = tab;
    navTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (isFocusMode) { document.body.classList.remove('focus-mode'); isFocusMode = false; }
    switch(tab) {
        case 'dashboard': renderDashboard(); break;
        case 'editor': renderEditor(); break;
        case 'world': renderWorld(); break;
        case 'ai': renderAI(); break;
        case 'reader': renderReader(); break;
        default: renderDashboard();
    }
}

// ----- Dashboard (with Analytics) -----
function renderDashboard() {
    const projects = getProjects();
    const totalWords = projects.reduce((sum, p) => sum + countWords(p), 0);
    appContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.5rem;">
            <h2>📚 Your Projects</h2>
            <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
                <span style="font-size:0.8rem;color:var(--text-secondary);">📊 ${totalWords} total words</span>
                <button id="create-project-btn" class="tool-btn" style="background:var(--accent);color:#fff;border:none;padding:0.4rem 1.5rem;">+ New Project</button>
            </div>
        </div>
        <div class="dashboard-grid">
            ${projects.map(p => `
                <div class="project-card" data-id="${p.id}">
                    <h3>${p.title}</h3>
                    <p>${p.chapters?.length || 0} chapters</p>
                    <div class="meta">
                        <span>📝 ${countWords(p)} words</span>
                        <span>📖 ${Math.max(...(p.chapters?.map(c => c.content?.split(/\s+/).filter(w=>w.length>0).length || 0) || [0]))} max ch</span>
                        <span>🕐 ${new Date(p.updatedAt).toLocaleDateString()}</span>
                    </div>
                </div>
            `).join('')}
            <div class="project-card create-card" id="create-project-card"><span style="font-size:2rem;">+</span><span>Create New Project</span></div>
        </div>
    `;
    document.querySelectorAll('.project-card[data-id]').forEach(el => {
        el.addEventListener('click', () => {
            const p = getProject(el.dataset.id);
            if (p) { currentProject = p; localStorage.setItem('novelforge_last_project', p.id); renderTab('editor'); }
        });
    });
    document.getElementById('create-project-card').addEventListener('click', showCreateProjectModal);
    document.getElementById('create-project-btn').addEventListener('click', showCreateProjectModal);
}

function showCreateProjectModal() {
    modalContainer.innerHTML = `
        <div class="modal-overlay"><div class="modal-box">
            <h2>📖 New Project</h2>
            <input type="text" id="new-project-title" placeholder="Project Title" value="My New Novel" />
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" id="confirm-create-project">Create</button>
            </div>
        </div></div>
    `;
    document.getElementById('confirm-create-project').addEventListener('click', () => {
        const title = document.getElementById('new-project-title').value.trim() || 'Untitled';
        const project = {
            id: Date.now().toString(36), title, chapters: [{ id: 'ch1', title: 'Chapter 1', content: '# Start writing...' }],
            characters: [], locations: [], relationships: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        saveProject(project); closeModal(); currentProject = project; localStorage.setItem('novelforge_last_project', project.id); renderTab('editor');
    });
}
window.closeModal = function() { modalContainer.innerHTML = ''; };

// ----- Editor (All Features) -----
function renderEditor() {
    if (!currentProject) { appContent.innerHTML = '<p style="color:var(--text-muted);">No project selected.</p>'; return; }
    const chapter = currentProject.chapters[currentChapterIndex] || currentProject.chapters[0];
    const totalWords = countWords(currentProject);
    const todayWords = getTodayWords(currentProject);
    const goalProgress = Math.min(100, (todayWords / wordGoal) * 100);

    appContent.innerHTML = `
        <div class="editor-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                <h2 style="font-size:1.2rem;">${currentProject.title}</h2>
                <select id="chapter-select" style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:40px;padding:0.3rem 1rem;color:var(--text-primary);">
                    ${currentProject.chapters.map((c, i) => `<option value="${i}" ${i === currentChapterIndex ? 'selected' : ''}>${c.title}</option>`).join('')}
                </select>
                <button id="rename-chapter-btn" class="tool-btn" title="Rename Chapter">✏️</button>
                <button id="delete-chapter-btn" class="tool-btn" style="color:var(--danger);" title="Delete Chapter">🗑️</button>
                <button id="add-chapter-btn" class="tool-btn" style="background:var(--accent);color:#fff;border:none;padding:0.2rem 1rem;">+ Chapter</button>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button id="focus-mode-btn" class="tool-btn">🧘 Focus</button>
                <button id="save-project-btn" class="tool-btn" style="border-color:var(--success);color:var(--success);">💾 Save</button>
                <button id="export-md-btn" class="tool-btn">📤 .md</button>
                <button id="export-pdf-btn" class="tool-btn" style="border-color:var(--accent);color:var(--accent);">📄 PDF</button>
            </div>
        </div>
        <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap; margin-bottom:0.5rem;">
            <span style="font-size:0.8rem;color:var(--text-secondary);">🎯 Daily Goal: ${todayWords}/${wordGoal} words</span>
            <div class="word-goal-bar" style="flex:1;min-width:100px;"><div class="word-goal-fill" style="width:${goalProgress}%;"></div></div>
            <span style="font-size:0.7rem;color:var(--text-muted);">${goalProgress >= 100 ? '✅ Goal met!' : `${Math.round(goalProgress)}%`}</span>
        </div>
        <div class="editor-container">
            <div class="editor-pane">
                <div class="pane-header"><span>📝 Editor</span><span id="editor-word-count">0 words</span></div>
                <textarea id="editor-textarea">${chapter?.content || ''}</textarea>
            </div>
            <div class="preview-pane">
                <div class="pane-header">👁️ Live Preview</div>
                <div class="preview-content" id="preview-content"></div>
            </div>
        </div>
        <div id="find-replace-bar" style="display:none; background:var(--bg-input); padding:0.5rem 1rem; border-radius:var(--radius-sm); margin-top:0.5rem; gap:0.5rem; align-items:center; flex-wrap:wrap;">
            <input type="text" id="find-input" placeholder="Find..." style="background:var(--bg-card);border:1px solid var(--border-color);padding:0.3rem 0.8rem;border-radius:40px;color:var(--text-primary);">
            <input type="text" id="replace-input" placeholder="Replace..." style="background:var(--bg-card);border:1px solid var(--border-color);padding:0.3rem 0.8rem;border-radius:40px;color:var(--text-primary);">
            <button id="find-next-btn" class="tool-btn">Next</button>
            <button id="replace-btn" class="tool-btn" style="border-color:var(--accent);color:var(--accent);">Replace</button>
            <button id="find-close-btn" class="tool-btn" style="color:var(--danger);">✕</button>
        </div>
    `;

    const textarea = document.getElementById('editor-textarea');
    const preview = document.getElementById('preview-content');
    const wordCountEl = document.getElementById('editor-word-count');

    // Initial render
    if (preview && typeof marked !== 'undefined') preview.innerHTML = marked.parse(textarea.value);
    else if (preview) preview.innerHTML = textarea.value;

    // Input logic
    textarea.addEventListener('input', () => {
        const content = textarea.value;
        const words = content.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCountEl) wordCountEl.textContent = `${words} words`;
        if (preview && typeof marked !== 'undefined') preview.innerHTML = marked.parse(content);
        else if (preview) preview.innerHTML = content;
        updateWordCount();
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            const ch = currentProject.chapters[currentChapterIndex];
            if (ch) { ch.content = content; currentProject.updatedAt = new Date().toISOString(); saveProject(currentProject); }
        }, 800);
    });

    // Chapter Select
    document.getElementById('chapter-select').addEventListener('change', (e) => {
        const ch = currentProject.chapters[currentChapterIndex];
        if (ch) ch.content = textarea.value;
        currentChapterIndex = parseInt(e.target.value);
        renderEditor();
    });

    // Rename Chapter
    document.getElementById('rename-chapter-btn').addEventListener('click', () => {
        const ch = currentProject.chapters[currentChapterIndex];
        if (!ch) return;
        const newTitle = prompt('Enter new chapter title:', ch.title);
        if (newTitle && newTitle.trim()) { ch.title = newTitle.trim(); saveProject(currentProject); renderEditor(); }
    });
    // Double click on select to rename (bonus)
    document.getElementById('chapter-select').addEventListener('dblclick', () => {
        document.getElementById('rename-chapter-btn').click();
    });

    // Delete Chapter
    document.getElementById('delete-chapter-btn').addEventListener('click', () => {
        if (currentProject.chapters.length <= 1) { alert('Cannot delete the last chapter.'); return; }
        if (confirm(`Delete "${currentProject.chapters[currentChapterIndex].title}"?`)) {
            currentProject.chapters.splice(currentChapterIndex, 1);
            if (currentChapterIndex >= currentProject.chapters.length) currentChapterIndex = currentProject.chapters.length - 1;
            saveProject(currentProject);
            renderEditor();
        }
    });

    // Add Chapter
    document.getElementById('add-chapter-btn').addEventListener('click', () => {
        const title = prompt('Chapter title:');
        if (title && title.trim()) {
            currentProject.chapters.push({ id: 'ch' + Date.now(), title: title.trim(), content: '# ' + title.trim() });
            currentChapterIndex = currentProject.chapters.length - 1;
            saveProject(currentProject);
            renderEditor();
        }
    });

    // Focus Mode
    document.getElementById('focus-mode-btn').addEventListener('click', () => {
        isFocusMode = !isFocusMode;
        document.body.classList.toggle('focus-mode', isFocusMode);
        document.getElementById('focus-mode-btn').textContent = isFocusMode ? '🧘 Exit' : '🧘 Focus';
    });

    // Save
    document.getElementById('save-project-btn').addEventListener('click', () => {
        const ch = currentProject.chapters[currentChapterIndex];
        if (ch) ch.content = textarea.value;
        saveProject(currentProject);
        alert('✅ Project saved!');
    });

    // Export MD
    document.getElementById('export-md-btn').addEventListener('click', () => {
        let fullText = `# ${currentProject.title}\n\n`;
        currentProject.chapters.forEach(c => { fullText += `## ${c.title}\n\n${c.content}\n\n`; });
        const blob = new Blob([fullText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${currentProject.title.replace(/\s+/g, '_')}.md`; a.click(); URL.revokeObjectURL(url);
    });

    // Export PDF (using jsPDF)
    document.getElementById('export-pdf-btn').addEventListener('click', () => {
        if (typeof window.jspdf === 'undefined') { alert('PDF library loading... Please try again in a moment.'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 50;
        let y = 40;
        doc.setFontSize(24);
        doc.text(currentProject.title, margin, y); y += 40;
        currentProject.chapters.forEach((c, idx) => {
            if (y > 700) { doc.addPage(); y = 40; }
            doc.setFontSize(18);
            doc.text(c.title, margin, y); y += 30;
            doc.setFontSize(12);
            const lines = doc.splitTextToSize(c.content.replace(/#/g, ''), pageWidth - margin * 2);
            lines.forEach(line => {
                if (y > 750) { doc.addPage(); y = 40; }
                doc.text(line, margin, y);
                y += 18;
            });
            y += 20;
        });
        doc.save(`${currentProject.title.replace(/\s+/g, '_')}.pdf`);
    });

    // Find/Replace (Ctrl+F)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            const bar = document.getElementById('find-replace-bar');
            if (bar) bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
            if (bar && bar.style.display === 'flex') document.getElementById('find-input')?.focus();
        }
    });
    setTimeout(() => {
        const bar = document.getElementById('find-replace-bar');
        if (bar) {
            document.getElementById('find-close-btn')?.addEventListener('click', () => { bar.style.display = 'none'; });
            document.getElementById('find-next-btn')?.addEventListener('click', () => {
                const find = document.getElementById('find-input').value;
                if (!find || !textarea) return;
                const start = textarea.selectionStart;
                const idx = textarea.value.indexOf(find, start + 1);
                if (idx > -1) { textarea.selectionStart = idx; textarea.selectionEnd = idx + find.length; textarea.focus(); }
                else alert('No more matches.');
            });
            document.getElementById('replace-btn')?.addEventListener('click', () => {
                const find = document.getElementById('find-input').value;
                const replace = document.getElementById('replace-input').value;
                if (!find || !textarea) return;
                const start = textarea.selectionStart;
                const end = start + find.length;
                if (textarea.value.substring(start, end) === find) {
                    textarea.value = textarea.value.substring(0, start) + replace + textarea.value.substring(end);
                    textarea.dispatchEvent(new Event('input'));
                    textarea.focus();
                } else alert('No match at cursor position.');
            });
        }
    }, 100);
}

function updateWordCount() {
    if (!currentProject || !wordCountDisplay) return;
    wordCountDisplay.textContent = `${countWords(currentProject)} words`;
}

// ----- World Builder (with Relationship Graph) -----
function renderWorld() {
    if (!currentProject) { appContent.innerHTML = '<p style="color:var(--text-muted);">No project selected.</p>'; return; }
    const chars = currentProject.characters || [];
    appContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.5rem;">
            <h2>🌍 World Builder</h2>
            <button id="add-character-btn" class="tool-btn" style="background:var(--accent);color:#fff;border:none;padding:0.4rem 1.5rem;">+ Add Character</button>
        </div>
        <div class="world-container">
            <div class="characters-list">
                <h3>👤 Characters</h3>
                ${chars.length === 0 ? '<p style="color:var(--text-muted);">No characters yet.</p>' : ''}
                ${chars.map((c, i) => `
                    <div class="character-item" data-index="${i}">
                        <div><strong>${c.name}</strong> <span class="role">${c.role || 'Unknown'}</span>
                        <p style="font-size:0.75rem;color:var(--text-secondary);">${c.description || ''}</p></div>
                        <button class="delete-char-btn" data-index="${i}" style="background:transparent;border:none;color:var(--danger);cursor:pointer;">✕</button>
                    </div>
                `).join('')}
                <h3 style="margin-top:1.5rem;">🔗 Relationship Graph</h3>
                <canvas id="relationship-graph" class="relationship-graph"></canvas>
            </div>
            <div class="locations-list">
                <h3>📍 Locations</h3>
                <p style="color:var(--text-muted);">Location tracking coming soon.</p>
                <button class="tool-btn" style="margin-top:0.5rem;border-color:var(--accent);color:var(--accent);">+ Add Location</button>
            </div>
        </div>
    `;

    document.getElementById('add-character-btn').addEventListener('click', showAddCharacterModal);
    document.querySelectorAll('.delete-char-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            if (confirm(`Delete "${currentProject.characters[idx].name}"?`)) {
                currentProject.characters.splice(idx, 1);
                saveProject(currentProject);
                renderWorld();
            }
        });
    });

    // Draw Relationship Graph
    drawRelationshipGraph(chars);
}

function drawRelationshipGraph(characters) {
    const canvas = document.getElementById('relationship-graph');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 350;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (characters.length === 0) {
        ctx.fillStyle = '#a69480';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Add characters to see relationships', w/2, h/2);
        return;
    }

    const nodes = characters.map((c, i) => {
        const angle = (i / characters.length) * Math.PI * 2 - Math.PI/2;
        const radius = Math.min(w, h) * 0.35;
        return { ...c, x: w/2 + Math.cos(angle) * radius, y: h/2 + Math.sin(angle) * radius };
    });

    // Draw lines (simple circle connections)
    nodes.forEach((n, i) => {
        const next = nodes[(i + 1) % nodes.length];
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = 'rgba(180, 83, 9, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
    // Draw extra random connections
    if (nodes.length > 3) {
        for (let i = 0; i < nodes.length; i++) {
            const j = (i + 2) % nodes.length;
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = 'rgba(180, 83, 9, 0.08)'; ctx.lineWidth = 1; ctx.stroke();
        }
    }

    // Draw nodes
    nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 25, 0, Math.PI * 2);
        ctx.fillStyle = '#b45309';
        ctx.shadowColor = 'rgba(180, 83, 9, 0.2)'; ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.name.substring(0, 2), n.x, n.y);
        ctx.fillStyle = '#3c2e22';
        ctx.font = '10px Inter';
        ctx.fillText(n.name, n.x, n.y + 35);
    });
}

function showAddCharacterModal() {
    modalContainer.innerHTML = `
        <div class="modal-overlay"><div class="modal-box">
            <h2>👤 New Character</h2>
            <input type="text" id="char-name" placeholder="Name" />
            <input type="text" id="char-role" placeholder="Role (e.g., Protagonist)" />
            <textarea id="char-desc" placeholder="Description..." rows="3"></textarea>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" id="confirm-add-char">Add</button>
            </div>
        </div></div>
    `;
    document.getElementById('confirm-add-char').addEventListener('click', () => {
        const name = document.getElementById('char-name').value.trim();
        if (!name) return alert('Name is required.');
        currentProject.characters.push({ id: 'char' + Date.now(), name, role: document.getElementById('char-role').value.trim() || 'Unknown', description: document.getElementById('char-desc').value.trim() });
        saveProject(currentProject); closeModal(); renderWorld();
    });
}

// ----- AI Assistant (Remains the same, but I'll keep it for completeness) -----
function renderAI() {
    const apiKey = localStorage.getItem('openai_api_key') || '';
    appContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h2>🤖 AI Writing Assistant</h2>
            <span style="font-size:0.7rem;color:var(--text-muted);">Powered by OpenAI</span>
        </div>
        <div class="ai-container">
            <div class="ai-chat">
                <div class="pane-header" style="padding:0.5rem 1rem;">💬 Chat with AI</div>
                <div class="ai-messages" id="ai-messages">
                    <div class="ai-message assistant">👋 Hello! I'm your writing assistant. Tell me what you need help with—brainstorming, rewriting, or continuing a scene.</div>
                </div>
                <div class="ai-input-area">
                    <textarea id="ai-prompt" rows="2" placeholder="Ask me to write, rewrite, or brainstorm..."></textarea>
                    <button id="ai-send-btn">Send</button>
                </div>
            </div>
            <div class="ai-settings">
                <h3>🔑 API Settings</h3>
                <label style="font-size:0.7rem;color:var(--text-muted);">OpenAI API Key</label>
                <input type="password" id="ai-api-key" placeholder="sk-..." value="${apiKey}" />
                <button id="ai-save-key" class="tool-btn" style="margin-top:0.5rem;border-color:var(--success);color:var(--success);">Save Key</button>
                <hr style="border-color:var(--border-color);margin:1rem 0;" />
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <button class="tool-btn ai-quick" data-prompt="Continue this scene dramatically">🎭 Continue</button>
                    <button class="tool-btn ai-quick" data-prompt="Rewrite this to be more suspenseful">⚡ Suspense</button>
                    <button class="tool-btn ai-quick" data-prompt="Describe the setting vividly">🌅 Describe</button>
                </div>
                <p style="font-size:0.6rem;color:var(--text-muted);margin-top:0.5rem;">💡 Your key is stored locally.</p>
            </div>
        </div>
    `;
    document.getElementById('ai-save-key').addEventListener('click', () => {
        const key = document.getElementById('ai-api-key').value.trim();
        if (key) { localStorage.setItem('openai_api_key', key); alert('✅ API Key saved!'); }
    });
    document.querySelectorAll('.ai-quick').forEach(btn => {
        btn.addEventListener('click', () => {
            const textarea = document.getElementById('editor-textarea');
            let context = textarea ? textarea.value.substring(0, 1500) : '';
            document.getElementById('ai-prompt').value = btn.dataset.prompt + (context ? `\n\nContext:\n${context}` : '');
            sendAIMessage();
        });
    });
    document.getElementById('ai-send-btn').addEventListener('click', sendAIMessage);
    document.getElementById('ai-prompt').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); }
    });
}

async function sendAIMessage() {
    const promptEl = document.getElementById('ai-prompt');
    const messagesEl = document.getElementById('ai-messages');
    const prompt = promptEl.value.trim();
    if (!prompt) return;
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) { alert('Please set your OpenAI API key.'); return; }
    messagesEl.innerHTML += `<div class="ai-message user">${prompt}</div>`;
    promptEl.value = '';
    messagesEl.scrollTop = messagesEl.scrollHeight;
    const loadingId = 'loading-' + Date.now();
    messagesEl.innerHTML += `<div class="ai-message assistant" id="${loadingId}">⏳ Thinking...</div>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', messages: [{ role: 'system', content: 'You are a helpful writing assistant for novelists.' }, { role: 'user', content: prompt }],
                temperature: 0.7, max_tokens: 500,
            })
        });
        const data = await response.json();
        document.getElementById(loadingId)?.remove();
        if (data.error) messagesEl.innerHTML += `<div class="ai-message assistant" style="border-color:var(--danger);color:var(--danger);">❌ ${data.error.message}</div>`;
        else {
            const reply = data.choices[0].message.content;
            messagesEl.innerHTML += `<div class="ai-message assistant">${reply}</div>`;
            messagesEl.innerHTML += `<div style="text-align:right;margin-top:-0.3rem;margin-bottom:0.8rem;">
                <button class="tool-btn insert-ai-btn" style="font-size:0.6rem;border-color:var(--accent);color:var(--accent);" data-text="${encodeURIComponent(reply)}">📥 Insert</button>
            </div>`;
            document.querySelectorAll('.insert-ai-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const text = decodeURIComponent(btn.dataset.text);
                    const textarea = document.getElementById('editor-textarea');
                    if (textarea) {
                        const cursor = textarea.selectionStart;
                        textarea.value = textarea.value.substring(0, cursor) + '\n\n' + text + '\n\n' + textarea.value.substring(cursor);
                        textarea.dispatchEvent(new Event('input')); textarea.focus();
                    }
                });
            });
        }
    } catch (err) {
        document.getElementById(loadingId)?.remove();
        messagesEl.innerHTML += `<div class="ai-message assistant" style="border-color:var(--danger);color:var(--danger);">❌ ${err.message}</div>`;
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ----- READER (All Features: Project Selector, Single Chapter, Font controls, Bookmarks) -----
function renderReader() {
    const projects = getProjects();
    const currentProjectId = currentProject?.id || (projects.length > 0 ? projects[0].id : null);
    const project = projects.find(p => p.id === currentProjectId) || (projects.length > 0 ? projects[0] : null);

    if (!project) {
        appContent.innerHTML = '<p style="color:var(--text-muted);">No projects available. Go to Dashboard to create one.</p>';
        return;
    }

    if (currentReaderChapterIndex >= project.chapters.length) currentReaderChapterIndex = 0;
    const chapter = project.chapters[currentReaderChapterIndex] || project.chapters[0];
    const totalChapters = project.chapters.length;

    // Apply reader theme to container
    const readerBg = readerTheme === 'dark' ? '#1a1a2e' : readerTheme === 'sepia' ? '#fbf0d9' : '#fcf7f0';
    const readerText = readerTheme === 'dark' ? '#e8edf5' : readerTheme === 'sepia' ? '#5b4636' : '#3c2e22';

    appContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                <h2>📖 Reader</h2>
                <select id="reader-project-select" style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:40px;padding:0.3rem 1rem;color:var(--text-primary);">
                    ${projects.map(p => `<option value="${p.id}" ${p.id === project.id ? 'selected' : ''}>${p.title}</option>`).join('')}
                </select>
            </div>
            <div class="reader-settings">
                <span style="font-size:0.7rem;color:var(--text-muted);">${currentReaderChapterIndex + 1}/${totalChapters}</span>
                <button id="reader-font-dec" class="tool-btn">A-</button>
                <button id="reader-font-inc" class="tool-btn">A+</button>
                <select id="reader-font-select" style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:40px;padding:0.2rem 0.8rem;color:var(--text-primary);font-size:0.7rem;">
                    <option value="Georgia, serif" ${readerFontFamily.includes('Georgia') ? 'selected' : ''}>Serif</option>
                    <option value="Inter, sans-serif" ${readerFontFamily.includes('Inter') ? 'selected' : ''}>Sans</option>
                    <option value="Courier New, monospace" ${readerFontFamily.includes('Courier') ? 'selected' : ''}>Mono</option>
                </select>
                <select id="reader-theme-select" style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:40px;padding:0.2rem 0.8rem;color:var(--text-primary);font-size:0.7rem;">
                    <option value="light" ${readerTheme === 'light' ? 'selected' : ''}>☀️ Light</option>
                    <option value="sepia" ${readerTheme === 'sepia' ? 'selected' : ''}>📖 Sepia</option>
                    <option value="dark" ${readerTheme === 'dark' ? 'selected' : ''}>🌙 Dark</option>
                </select>
                <button id="reader-bookmark-btn" class="tool-btn" style="border-color:var(--warning);color:var(--warning);">🔖</button>
            </div>
        </div>
        <div class="reader-container" id="reader-container" style="background:${readerBg};color:${readerText};">
            <h1>${chapter.title}</h1>
            <div id="reader-content">${typeof marked !== 'undefined' ? marked.parse(chapter.content) : chapter.content}</div>
            <div class="reader-controls">
                <button id="reader-prev" class="tool-btn" ${currentReaderChapterIndex === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>◀ Prev</button>
                <select id="reader-chapter-select" style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:40px;padding:0.2rem 1rem;color:var(--text-primary);">
                    ${project.chapters.map((c, i) => `<option value="${i}" ${i === currentReaderChapterIndex ? 'selected' : ''}>${c.title}</option>`).join('')}
                </select>
                <button id="reader-next" class="tool-btn" ${currentReaderChapterIndex === totalChapters - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>Next ▶</button>
            </div>
        </div>
    `;

    // Event Listeners for Reader
    document.getElementById('reader-project-select').addEventListener('change', (e) => {
        const newProject = getProject(e.target.value);
        if (newProject) { currentProject = newProject; currentReaderChapterIndex = 0; renderReader(); }
    });

    document.getElementById('reader-chapter-select').addEventListener('change', (e) => {
        currentReaderChapterIndex = parseInt(e.target.value);
        renderReader();
    });

    document.getElementById('reader-prev').addEventListener('click', () => {
        if (currentReaderChapterIndex > 0) { currentReaderChapterIndex--; renderReader(); }
    });

    document.getElementById('reader-next').addEventListener('click', () => {
        if (currentReaderChapterIndex < totalChapters - 1) { currentReaderChapterIndex++; renderReader(); }
    });

    // Font Controls
    document.getElementById('reader-font-inc').addEventListener('click', () => {
        readerFontSize = Math.min(32, readerFontSize + 2);
        localStorage.setItem('novelforge_reader_font_size', readerFontSize);
        document.documentElement.style.setProperty('--reader-font-size', readerFontSize + 'px');
        renderReader();
    });
    document.getElementById('reader-font-dec').addEventListener('click', () => {
        readerFontSize = Math.max(12, readerFontSize - 2);
        localStorage.setItem('novelforge_reader_font_size', readerFontSize);
        document.documentElement.style.setProperty('--reader-font-size', readerFontSize + 'px');
        renderReader();
    });

    document.getElementById('reader-font-select').addEventListener('change', (e) => {
        readerFontFamily = e.target.value;
        localStorage.setItem('novelforge_reader_font', readerFontFamily);
        document.documentElement.style.setProperty('--reader-font-family', readerFontFamily);
        renderReader();
    });

    document.getElementById('reader-theme-select').addEventListener('change', (e) => {
        readerTheme = e.target.value;
        localStorage.setItem('novelforge_reader_theme', readerTheme);
        renderReader();
    });

    // Bookmark (save the current chapter index to localStorage)
    document.getElementById('reader-bookmark-btn').addEventListener('click', () => {
        localStorage.setItem(`novelforge_bookmark_${project.id}`, currentReaderChapterIndex);
        alert(`🔖 Bookmarked "${chapter.title}"`);
    });

    // Check if there's a bookmark for this project
    const bookmark = localStorage.getItem(`novelforge_bookmark_${project.id}`);
    if (bookmark && parseInt(bookmark) !== currentReaderChapterIndex) {
        // We could auto-jump, but we'll just let the user know via a subtle indicator.
        // For simplicity, we don't auto-jump unless requested. But we show a notice.
        // Actually let's just let them manually select.
    }
}

// ----- Event Listeners -----
function setupEventListeners() {
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => renderTab(tab.dataset.tab));
    });
    themeToggle.addEventListener('click', () => {
        isDark = !isDark;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        themeToggle.textContent = isDark ? '🌙' : '☀️';
        localStorage.setItem('novelforge_theme', isDark ? 'dark' : 'light');
    });

    // Global Escape to exit focus mode
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isFocusMode) {
            document.body.classList.remove('focus-mode');
            isFocusMode = false;
            const btn = document.getElementById('focus-mode-btn');
            if (btn) btn.textContent = '🧘 Focus';
        }
    });
}

// ----- Start the App -----
document.addEventListener('DOMContentLoaded', init);
