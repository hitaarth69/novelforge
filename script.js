// ----- DOM Refs -----
const appContent = document.getElementById('app-content');
const navTabs = document.querySelectorAll('.nav-tab');
const modalContainer = document.getElementById('modal-container');
const themeToggle = document.getElementById('theme-toggle');
const wordCountDisplay = document.getElementById('word-count-display');

// ----- State -----
let currentProject = null;
let currentChapterIndex = 0;
let currentTab = 'dashboard';
let isDark = true;
let autoSaveTimer = null;

// ----- Simple DB (LocalStorage) -----
function getProjects() {
    try {
        return JSON.parse(localStorage.getItem('novelforge_projects')) || [];
    } catch { return []; }
}

function saveProject(project) {
    let projects = getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index > -1) {
        projects[index] = project;
    } else {
        projects.push(project);
    }
    localStorage.setItem('novelforge_projects', JSON.stringify(projects));
}

function deleteProject(id) {
    let projects = getProjects();
    projects = projects.filter(p => p.id !== id);
    localStorage.setItem('novelforge_projects', JSON.stringify(projects));
}

function getProject(id) {
    const projects = getProjects();
    return projects.find(p => p.id === id) || null;
}

// ----- Init -----
function init() {
    console.log('🚀 NovelForge initializing...');
    
    // Load theme
    const savedTheme = localStorage.getItem('novelforge_theme');
    if (savedTheme === 'light') {
        isDark = false;
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggle.textContent = '☀️';
    }

    // Load last project
    const lastId = localStorage.getItem('novelforge_last_project');
    if (lastId) {
        const project = getProject(lastId);
        if (project) currentProject = project;
    }

    // If no project, create default
    if (!currentProject) {
        currentProject = {
            id: Date.now().toString(36),
            title: 'My First Novel',
            chapters: [{ id: 'ch1', title: 'Chapter 1', content: '# Welcome to NovelForge\n\nStart writing your masterpiece here...' }],
            characters: [],
            locations: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        saveProject(currentProject);
        localStorage.setItem('novelforge_last_project', currentProject.id);
    }

    // Setup event listeners
    setupEventListeners();
    
    // Render default tab
    renderTab('dashboard');
    
    console.log('✅ NovelForge ready!');
}

// ----- Routing -----
function renderTab(tab) {
    currentTab = tab;
    navTabs.forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    
    switch(tab) {
        case 'dashboard': renderDashboard(); break;
        case 'editor': renderEditor(); break;
        case 'world': renderWorld(); break;
        case 'ai': renderAI(); break;
        case 'reader': renderReader(); break;
        default: renderDashboard();
    }
}

// ----- Dashboard -----
function renderDashboard() {
    const projects = getProjects();
    appContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h2>📚 Your Projects</h2>
            <button id="create-project-btn" class="tool-btn" style="background:var(--accent);color:#fff;border:none;padding:0.4rem 1.5rem;">+ New Project</button>
        </div>
        <div class="dashboard-grid">
            ${projects.map(p => `
                <div class="project-card" data-id="${p.id}">
                    <h3>${p.title}</h3>
                    <p>${p.chapters?.length || 0} chapters</p>
                    <div class="meta">
                        <span>📝 ${countWords(p)} words</span>
                        <span>🕐 ${new Date(p.updatedAt).toLocaleDateString()}</span>
                    </div>
                </div>
            `).join('')}
            <div class="project-card create-card" id="create-project-card">
                <span style="font-size:2rem;">+</span>
                <span>Create New Project</span>
            </div>
        </div>
    `;

    document.querySelectorAll('.project-card[data-id]').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.id;
            const project = getProject(id);
            if (project) {
                currentProject = project;
                localStorage.setItem('novelforge_last_project', id);
                renderTab('editor');
            }
        });
    });

    document.getElementById('create-project-card').addEventListener('click', showCreateProjectModal);
    document.getElementById('create-project-btn').addEventListener('click', showCreateProjectModal);
}

function countWords(project) {
    if (!project || !project.chapters) return 0;
    return project.chapters.reduce((sum, c) => {
        return sum + (c.content?.split(/\s+/).filter(w => w.length > 0).length || 0);
    }, 0);
}

function showCreateProjectModal() {
    modalContainer.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-box">
                <h2>📖 New Project</h2>
                <input type="text" id="new-project-title" placeholder="Project Title" value="My New Novel" />
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn-primary" id="confirm-create-project">Create</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('confirm-create-project').addEventListener('click', () => {
        const title = document.getElementById('new-project-title').value.trim() || 'Untitled';
        const project = {
            id: Date.now().toString(36),
            title,
            chapters: [{ id: 'ch1', title: 'Chapter 1', content: '# Start writing...' }],
            characters: [],
            locations: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        saveProject(project);
        closeModal();
        currentProject = project;
        localStorage.setItem('novelforge_last_project', project.id);
        renderTab('editor');
    });
}

window.closeModal = function() { modalContainer.innerHTML = ''; };

// ----- Editor -----
function renderEditor() {
    if (!currentProject) {
        appContent.innerHTML = '<p style="color:var(--text-muted);">No project selected. Go to Dashboard.</p>';
        return;
    }
    const chapter = currentProject.chapters[currentChapterIndex] || currentProject.chapters[0];
    
    appContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                <h2 style="font-size:1.2rem;">${currentProject.title}</h2>
                <select id="chapter-select" style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:40px; padding:0.3rem 1rem; color:var(--text-primary);">
                    ${currentProject.chapters.map((c, i) => `<option value="${i}" ${i === currentChapterIndex ? 'selected' : ''}>${c.title}</option>`).join('')}
                </select>
                <button id="add-chapter-btn" class="tool-btn" style="background:var(--accent);color:#fff;border:none;padding:0.2rem 1rem;">+ Chapter</button>
            </div>
            <div>
                <button id="save-project-btn" class="tool-btn" style="border-color:var(--success);color:var(--success);">💾 Save</button>
                <button id="export-md-btn" class="tool-btn">📤 Export .md</button>
            </div>
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
    `;

    const textarea = document.getElementById('editor-textarea');
    const preview = document.getElementById('preview-content');
    const wordCount = document.getElementById('editor-word-count');

    // Initial render
    if (preview && typeof marked !== 'undefined') {
        preview.innerHTML = marked.parse(textarea.value);
    } else if (preview) {
        preview.innerHTML = textarea.value;
    }

    // Auto-save on input
    textarea.addEventListener('input', () => {
        const content = textarea.value;
        const words = content.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount) wordCount.textContent = `${words} words`;
        if (preview && typeof marked !== 'undefined') {
            preview.innerHTML = marked.parse(content);
        } else if (preview) {
            preview.innerHTML = content;
        }
        updateWordCount();
        
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            const ch = currentProject.chapters[currentChapterIndex];
            if (ch) {
                ch.content = content;
                currentProject.updatedAt = new Date().toISOString();
                saveProject(currentProject);
            }
        }, 800);
    });

    // Chapter Select
    const select = document.getElementById('chapter-select');
    if (select) {
        select.addEventListener('change', (e) => {
            const ch = currentProject.chapters[currentChapterIndex];
            if (ch) ch.content = textarea.value;
            currentChapterIndex = parseInt(e.target.value);
            renderEditor();
        });
    }

    // Add Chapter
    const addBtn = document.getElementById('add-chapter-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const title = prompt('Chapter title:');
            if (title && title.trim()) {
                currentProject.chapters.push({ 
                    id: 'ch' + Date.now(), 
                    title: title.trim(), 
                    content: '# ' + title.trim() 
                });
                currentChapterIndex = currentProject.chapters.length - 1;
                saveProject(currentProject);
                renderEditor();
            }
        });
    }

    // Export MD
    const exportBtn = document.getElementById('export-md-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            let fullText = `# ${currentProject.title}\n\n`;
            currentProject.chapters.forEach(c => {
                fullText += `## ${c.title}\n\n${c.content}\n\n`;
            });
            const blob = new Blob([fullText], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentProject.title.replace(/\s+/g, '_')}.md`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // Save button
    const saveBtn = document.getElementById('save-project-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const ch = currentProject.chapters[currentChapterIndex];
            if (ch) ch.content = textarea.value;
            saveProject(currentProject);
            alert('✅ Project saved!');
        });
    }
}

function updateWordCount() {
    if (!currentProject || !wordCountDisplay) return;
    const total = countWords(currentProject);
    wordCountDisplay.textContent = `${total} words`;
}

// ----- World Builder -----
function renderWorld() {
    if (!currentProject) {
        appContent.innerHTML = '<p style="color:var(--text-muted);">No project selected.</p>';
        return;
    }
    const chars = currentProject.characters || [];

    appContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h2>🌍 World Builder</h2>
            <button id="add-character-btn" class="tool-btn" style="background:var(--accent);color:#fff;border:none;padding:0.4rem 1.5rem;">+ Add Character</button>
        </div>
        <div class="world-container">
            <div class="characters-list">
                <h3>👤 Characters</h3>
                ${chars.length === 0 ? '<p style="color:var(--text-muted);">No characters yet.</p>' : ''}
                ${chars.map((c, i) => `
                    <div class="character-item" data-index="${i}">
                        <div>
                            <strong>${c.name}</strong>
                            <span class="role">${c.role || 'Unknown'}</span>
                            <p style="font-size:0.75rem;color:var(--text-secondary);">${c.description || ''}</p>
                        </div>
                        <button class="delete-char-btn" data-index="${i}" style="background:transparent;border:none;color:var(--danger);cursor:pointer;">✕</button>
                    </div>
                `).join('')}
            </div>
            <div class="locations-list">
                <h3>📍 Locations</h3>
                <p style="color:var(--text-muted);">Location tracking coming soon.</p>
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
}

function showAddCharacterModal() {
    modalContainer.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-box">
                <h2>👤 New Character</h2>
                <input type="text" id="char-name" placeholder="Name" />
                <input type="text" id="char-role" placeholder="Role (e.g., Protagonist, Antagonist)" />
                <textarea id="char-desc" placeholder="Description, traits, backstory..." rows="3"></textarea>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn-primary" id="confirm-add-char">Add Character</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('confirm-add-char').addEventListener('click', () => {
        const name = document.getElementById('char-name').value.trim();
        if (!name) return alert('Name is required.');
        currentProject.characters.push({
            id: 'char' + Date.now(),
            name: name,
            role: document.getElementById('char-role').value.trim() || 'Unknown',
            description: document.getElementById('char-desc').value.trim(),
        });
        saveProject(currentProject);
        closeModal();
        renderWorld();
    });
}

// ----- AI Assistant -----
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
                    <div class="ai-message assistant">👋 Hello! I'm your writing assistant. Tell me what you need help with—brainstorming, rewriting a paragraph, or continuing a scene.</div>
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
                    <button class="tool-btn ai-quick" data-prompt="Continue this scene in a dramatic way">🎭 Continue</button>
                    <button class="tool-btn ai-quick" data-prompt="Rewrite this to be more suspenseful">⚡ Suspense</button>
                    <button class="tool-btn ai-quick" data-prompt="Describe the setting in vivid detail">🌅 Describe</button>
                </div>
                <p style="font-size:0.6rem;color:var(--text-muted);margin-top:0.5rem;">💡 Your key is stored locally. Never shared.</p>
            </div>
        </div>
    `;

    document.getElementById('ai-save-key').addEventListener('click', () => {
        const key = document.getElementById('ai-api-key').value.trim();
        if (key) {
            localStorage.setItem('openai_api_key', key);
            alert('✅ API Key saved locally!');
        }
    });

    document.querySelectorAll('.ai-quick').forEach(btn => {
        btn.addEventListener('click', () => {
            const textarea = document.getElementById('editor-textarea');
            let context = '';
            if (textarea) context = textarea.value.substring(0, 1500);
            const prompt = btn.dataset.prompt + (context ? `\n\nContext from my novel:\n${context}` : '');
            document.getElementById('ai-prompt').value = prompt;
            sendAIMessage();
        });
    });

    document.getElementById('ai-send-btn').addEventListener('click', sendAIMessage);
    document.getElementById('ai-prompt').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIMessage();
        }
    });
}

async function sendAIMessage() {
    const promptEl = document.getElementById('ai-prompt');
    const messagesEl = document.getElementById('ai-messages');
    const prompt = promptEl.value.trim();
    if (!prompt) return;
    
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
        alert('Please set your OpenAI API key in the settings panel.');
        return;
    }

    messagesEl.innerHTML += `<div class="ai-message user">${prompt}</div>`;
    promptEl.value = '';
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const loadingId = 'loading-' + Date.now();
    messagesEl.innerHTML += `<div class="ai-message assistant" id="${loadingId}">⏳ Thinking...</div>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful writing assistant for novelists. Help with brainstorming, rewriting, and continuing stories. Keep responses concise and useful.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 500,
            })
        });

        const data = await response.json();
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        if (data.error) {
            messagesEl.innerHTML += `<div class="ai-message assistant" style="border-color:var(--danger);color:var(--danger);">❌ Error: ${data.error.message}</div>`;
        } else {
            const reply = data.choices[0].message.content;
            messagesEl.innerHTML += `<div class="ai-message assistant">${reply}</div>`;
            messagesEl.innerHTML += `<div style="text-align:right;margin-top:-0.3rem;margin-bottom:0.8rem;">
                <button class="tool-btn insert-ai-btn" style="font-size:0.6rem;border-color:var(--accent);color:var(--accent);" data-text="${encodeURIComponent(reply)}">📥 Insert into Editor</button>
            </div>`;
            document.querySelectorAll('.insert-ai-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const text = decodeURIComponent(btn.dataset.text);
                    const textarea = document.getElementById('editor-textarea');
                    if (textarea) {
                        const cursor = textarea.selectionStart;
                        const current = textarea.value;
                        textarea.value = current.substring(0, cursor) + '\n\n' + text + '\n\n' + current.substring(cursor);
                        textarea.dispatchEvent(new Event('input'));
                        textarea.focus();
                    }
                });
            });
        }
    } catch (err) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        messagesEl.innerHTML += `<div class="ai-message assistant" style="border-color:var(--danger);color:var(--danger);">❌ Network error: ${err.message}</div>`;
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ----- Reader Mode -----
function renderReader() {
    if (!currentProject) {
        appContent.innerHTML = '<p style="color:var(--text-muted);">No project selected.</p>';
        return;
    }
    let fullText = `# ${currentProject.title}\n\n`;
    currentProject.chapters.forEach(c => {
        fullText += `## ${c.title}\n\n${c.content}\n\n`;
    });

    let renderedHtml = fullText;
    if (typeof marked !== 'undefined') {
        renderedHtml = marked.parse(fullText);
    }

    appContent.innerHTML = `
        <div class="reader-container">
            ${renderedHtml}
        </div>
    `;
}

// ----- Event Listeners -----
function setupEventListeners() {
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            renderTab(tab.dataset.tab);
        });
    });

    themeToggle.addEventListener('click', () => {
        isDark = !isDark;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        themeToggle.textContent = isDark ? '🌙' : '☀️';
        localStorage.setItem('novelforge_theme', isDark ? 'dark' : 'light');
    });
}

// ----- Start the App -----
document.addEventListener('DOMContentLoaded', init);
