// Global variables
let structure = { folders: { Main: [] }, notes: {} };
let currentNote = '';
let isEditing = false;
let graph;
let searchTerm = '';
let filters = {
    tags: [],
    folders: [],
    dateRange: { start: null, end: null }
};

// DOM Elements
const folderStructure = document.getElementById('folderStructure');
const noteContent = document.getElementById('noteContent');
const noteEditor = document.getElementById('noteEditor');
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const newNoteBtn = document.getElementById('newNoteBtn');
const viewerTab = document.getElementById('viewerTab');
const graphTab = document.getElementById('graphTab');
const noteViewer = document.getElementById('noteViewer');
const graphView = document.getElementById('graphView');
const searchInput = document.getElementById('searchInput');
const filterControls = document.getElementById('filterControls');

let currentZoom = 1; // Adjust initial zoom level

// Initialize force graph
function initGraph() {
    const Graph = ForceGraph()
        (graphView)
        .nodeLabel(node => node.name)
        .nodeVal(node => node.type === 'folder' ? 20 : 10)
        .nodeColor(node => getNodeColor(node))
        .linkDirectionalArrowLength(3)
        .linkDirectionalArrowRelPos(1)
        .onNodeClick(handleNodeClick)
        .onNodeRightClick(handleNodeRightClick)
        .onNodeDragEnd(node => {
            node.fx = node.x;
            node.fy = node.y;
        })
        .onBackgroundClick(() => {
            graph.nodeColor(getNodeColor);
            graph.linkWidth(1);
        })
        .nodeCanvasObject((node, ctx, globalScale) => {
            const label = node.name;
            const fontSize = node.type === 'folder' ? 14 : 12;
            ctx.font = `${fontSize}px Sans-Serif`;

            // Draw node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
            ctx.fillStyle = getNodeColor(node);
            ctx.fill();

            // Draw label
            const textWidth = ctx.measureText(label).width;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#444';
            ctx.fillText(label, node.x, node.y);
        })
        .d3Force('charge', d3.forceManyBody().strength(node => node.type === 'folder' ? -500 : -100))
        .d3Force('collide', d3.forceCollide(node => node.val * 2))
        .d3Force('link', d3.forceLink().id(node => node.id).distance(100))
        .zoom(currentZoom)
        .onZoom(handleZoom);

    graph = Graph;
    updateGraph();
    
    // Center the graph on a node after a short delay to allow initial positioning
    setTimeout(() => {
        centerGraphOnNode();
    }, 1000);
}

function centerGraphOnNode() {
    const { nodes } = graph.graphData();
    let centerNode = nodes.find(node => node.id === 'Main');
    if (!centerNode) {
        centerNode = nodes.find(node => node.type === 'folder');
    }
    if (!centerNode) {
        centerNode = nodes[0];
    }

    if (centerNode) {
        const distance = 40;
        const distRatio = 1 + distance / Math.hypot(centerNode.x, centerNode.y);

        graph.centerAt(centerNode.x, centerNode.y, 1000);
        graph.zoom(1.5, 2000);
    }
}

function updateGraph() {
    if (!graph) return;

    const nodes = [];
    const links = [];

    Object.keys(structure.folders).forEach(folderName => {
        nodes.push({ id: folderName, name: folderName, val: 20, type: 'folder' });
    });

    Object.entries(structure.notes).forEach(([noteName, noteData]) => {
        const tags = (noteData.content.match(/#\w+/g) || []).map(tag => tag.slice(1));
        nodes.push({ id: noteName, name: noteName, val: 10, type: 'note', tags, parentFolder: noteData.folder });
        links.push({ source: noteData.folder, target: noteName });
    });

    graph.graphData({ nodes, links });
}

function getNodeColor(node) {
    if (node.id === currentNote) return '#ff0000'; // Keep currently selected note red
    if (node.type === 'folder') return '#4183C4'; // Folder color
    return '#C48641'; // Note color
}

function handleZoom(zoom) {
    currentZoom = zoom;
    updateZoomIndicator(zoom);
}

function updateZoomIndicator(zoom) {
    const zoomIndicator = document.getElementById('zoomIndicator');
    if (zoomIndicator) {
        zoomIndicator.textContent = `Zoom: ${zoom.toFixed(2)}x`;
    }
}

function handleNodeClick(node) {
    if (structure.notes[node.id]) {
        currentNote = node.id;
        renderNote();
        viewerTab.click();

        // Highlight connected nodes and links
        const connectedNodeIds = new Set();
        graph.graphData().links.forEach(link => {
            if (link.source.id === node.id) connectedNodeIds.add(link.target.id);
            if (link.target.id === node.id) connectedNodeIds.add(link.source.id);
        });

        graph.nodeColor(n => 
            n.id === node.id ? '#ff0000' :
            connectedNodeIds.has(n.id) ? '#ffa500' :
            getNodeColor(n)
        );

        graph.linkWidth(link => 
            link.source.id === node.id || link.target.id === node.id ? 3 : 1
        );
    }
}

function handleNodeRightClick(node, event) {
    event.preventDefault();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="menu-item" data-action="open">Open</div>
        <div class="menu-item" data-action="edit">Edit</div>
        <div class="menu-item" data-action="backlinks">Show Backlinks</div>
    `;
    menu.style.position = 'absolute';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    document.body.appendChild(menu);

    menu.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'open') {
            currentNote = node.id;
            renderNote();
            viewerTab.click();
        } else if (action === 'edit') {
            currentNote = node.id;
            renderNote();
            editBtn.click();
            viewerTab.click();
        } else if (action === 'backlinks') {
            showBacklinks(node.id);
        }
        document.body.removeChild(menu);
    });

    document.body.addEventListener('click', () => {
        if (document.body.contains(menu)) {
            document.body.removeChild(menu);
        }
    }, { once: true });
}

function showBacklinks(nodeId) {
    const backlinks = graph.graphData().links.filter(link => link.target.id === nodeId);
    alert(`Backlinks for ${nodeId}:\n${backlinks.map(link => link.source.id).join('\n')}`);
}

// Load notes from localStorage
function loadNotes() {
    const savedStructure = localStorage.getItem('structure');
    if (savedStructure) {
        try {
            structure = JSON.parse(savedStructure);
        } catch (e) {
            console.error('Failed to parse saved structure:', e);
            structure = { folders: { Main: [] }, notes: {} };
        }
    }
    renderFolderStructure();
    initGraph();
}

// Save notes to localStorage
function saveNotes() {
    localStorage.setItem('structure', JSON.stringify(structure));
}

// Render folder structure
function renderFolderStructure() {
    folderStructure.innerHTML = '';
    Object.entries(structure.folders).forEach(([folderName, notes]) => {
        const folderElement = document.createElement('div');
        folderElement.className = 'folder';
        folderElement.innerHTML = `
            <span class="folder-name">${folderName}</span>
            <ul class="note-list">
                ${notes.map(noteName => `<li class="note-item" data-note="${noteName}">${noteName}</li>`).join('')}
            </ul>
        `;
        folderStructure.appendChild(folderElement);
    });
}

// Render note content
function renderNote() {
    if (structure.notes[currentNote]) {
        noteContent.innerHTML = marked(structure.notes[currentNote].content);
        noteEditor.value = structure.notes[currentNote].content;
    } else {
        noteContent.innerHTML = '';
        noteEditor.value = '';
    }
}

// Filter graph based on search and filters
function filterGraph() {
    const { nodes, links } = graph.graphData();
    const filteredNodes = nodes.filter(node => {
        const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTags = filters.tags.length === 0 || (node.tags && node.tags.some(tag => filters.tags.includes(tag)));
        const matchesFolder = filters.folders.length === 0 || filters.folders.includes(node.type === 'folder' ? node.id : structure.notes[node.id].folder);
        const matchesDate = !filters.dateRange.start || !filters.dateRange.end || 
            (structure.notes[node.id] && new Date(structure.notes[node.id].lastModified) >= filters.dateRange.start && 
             new Date(structure.notes[node.id].lastModified) <= filters.dateRange.end);
        
        return matchesSearch && matchesTags && matchesFolder && matchesDate;
    });

    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    const filteredLinks = links.filter(link => 
        filteredNodeIds.has(link.source.id || link.source) && 
        filteredNodeIds.has(link.target.id || link.target)
    );

    graph.graphData({ nodes: filteredNodes, links: filteredLinks });
}

// Event Listeners

// Handle note selection
folderStructure.addEventListener('click', (e) => {
    if (e.target.classList.contains('note-item')) {
        currentNote = e.target.dataset.note;
        renderNote();
        viewerTab.click();
    }
});

// Toggle edit mode
editBtn.addEventListener('click', () => {
    isEditing = !isEditing;
    noteContent.style.display = isEditing ? 'none' : 'block';
    noteEditor.style.display = isEditing ? 'block' : 'none';
    editBtn.textContent = isEditing ? 'Cancel' : 'Edit';
    saveBtn.style.display = isEditing ? 'inline-block' : 'none';
});

// Save note
saveBtn.addEventListener('click', () => {
    if (currentNote && structure.notes[currentNote]) {
        structure.notes[currentNote].content = noteEditor.value;
        structure.notes[currentNote].lastModified = new Date().toISOString();
        saveNotes();
        renderNote();
        isEditing = false;
        noteContent.style.display = 'block';
        noteEditor.style.display = 'none';
        editBtn.textContent = 'Edit';
        saveBtn.style.display = 'none';
        updateGraph();
    }
});

// Create new folder
newFolderBtn.addEventListener('click', () => {
    const folderName = prompt("Enter folder name:");
    if (folderName && !structure.folders[folderName]) {
        structure.folders[folderName] = [];
        saveNotes();
        renderFolderStructure();
        updateGraph();
    } else if (structure.folders[folderName]) {
        alert("A folder with this name already exists.");
    }
});

// Create new note
newNoteBtn.addEventListener('click', () => {
    const noteName = prompt("Enter note name:");
    const folderName = prompt("Enter folder name (or leave blank for Main):");
    if (noteName) {
        const folder = folderName || 'Main';
        if (!structure.folders[folder]) {
            structure.folders[folder] = [];
        }
        if (!structure.notes[noteName]) {
            structure.folders[folder].push(noteName);
            structure.notes[noteName] = { content: '', folder, lastModified: new Date().toISOString() };
            saveNotes();
            renderFolderStructure();
            currentNote = noteName;
            renderNote();
            updateGraph();
        } else {
            alert("A note with this name already exists.");
        }
    }
});

// Switch between viewer and graph
viewerTab.addEventListener('click', () => {
    viewerTab.classList.add('active');
    graphTab.classList.remove('active');
    noteViewer.style.display = 'block';
    graphView.style.display = 'none';
});

graphTab.addEventListener('click', () => {
    graphTab.classList.add('active');
    viewerTab.classList.remove('active');
    noteViewer.style.display = 'none';
    graphView.style.display = 'block';
    updateGraph();
});

// Search functionality
searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    filterGraph();
});

// Filter controls
filterControls.addEventListener('change', (e) => {
    if (e.target.name === 'tag') {
        if (e.target.checked) {
            filters.tags.push(e.target.value);
        } else {
            filters.tags = filters.tags.filter(tag => tag !== e.target.value);
        }
    } else if (e.target.name === 'folder') {
        if (e.target.checked) {
            filters.folders.push(e.target.value);
        } else {
            filters.folders = filters.folders.filter(folder => folder !== e.target.value);
        }
    } else if (e.target.name === 'dateStart') {
        filters.dateRange.start = e.target.value ? new Date(e.target.value) : null;
    } else if (e.target.name === 'dateEnd') {
        filters.dateRange.end = e.target.value ? new Date(e.target.value) : null;
    }
    filterGraph();
});

// Initial load
document.addEventListener('DOMContentLoaded', (event) => {
    loadNotes();
});
