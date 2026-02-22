// Function to show popup on load
window.addEventListener('load', () => {
    if (!sessionStorage.getItem('popupSeen')) {
        setTimeout(() => {
            const popup = document.getElementById('info-popup');
            if (popup) popup.classList.add('show');
        }, 500);
    }
});

// Function to close popup
function closePopup() {
    const popup = document.getElementById('info-popup');
    if (popup) {
        popup.classList.remove('show');
        sessionStorage.setItem('popupSeen', 'true');
    }
}

const player = document.getElementById('player');
const displayContainer = document.getElementById('display-container');
const prevLineDisplay = document.getElementById('previous-line');
const downloadBtn = document.getElementById('download-btn');
const tapBtn = document.getElementById('tap-button');
const progressBar = document.getElementById('progress-bar');
const audioInput = document.getElementById('audio-file');

// Shared Global Variables
let lyricsArray = [];
let lineIdx = 0;
let wordIdx = -1;
let mode = 'line';
let finalLrc = "";
let audioFileName = "synced_lyrics";

// --- FETCH SONG NAME LOGIC ---
// Capture filename when user selects a file
if (audioInput) {
    audioInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Removes the extension (e.g., "song.mp3" -> "song")
            audioFileName = file.name.replace(/\.[^/.]+$/, "");
        }
    });
}

// --- PAGE NAVIGATION LOGIC ---
function goToEditor() {
    const rawText = document.getElementById('lyrics-text').value.trim();
    const selectedMode = document.getElementById('sync-mode').value;
    if (!rawText) return alert("Please paste lyrics first.");
    // Save data to session to retrieve on editor.html
    sessionStorage.setItem('rawLyrics', rawText);
    sessionStorage.setItem('syncMode', selectedMode);
    window.location.href = 'editor.html';
}

// --- TOGGLE THEME LOGIC ---
function toggleTheme() {
    const root = document.documentElement;
    const checkbox = document.getElementById('theme-checkbox');
    if (checkbox.checked) {
        root.setAttribute('data-theme', 'liquid');
        localStorage.setItem('theme', 'liquid');
    } else {
        root.setAttribute('data-theme', 'material');
        localStorage.setItem('theme', 'material');
    }
}

// Keep theme consistent on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const checkbox = document.getElementById('theme-checkbox');
    if (savedTheme === 'liquid') {
        document.documentElement.setAttribute('data-theme', 'liquid');
        if (checkbox) checkbox.checked = true;
    }
});

// --- CORE LOGIC ---
function formatLrcTime(seconds) {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return `[${min}:${sec}.${ms}]`;
}

function initSync() {
    const rawText = sessionStorage.getItem('rawLyrics');
    const file = audioInput.files[0];
    mode = sessionStorage.getItem('syncMode') || 'line';

    if (!file) return alert("Please select an audio file.");
    if (!rawText) {
        alert("Lyrics missing. Returning to start.");
        window.location.href = 'index.html';
        return;
    }

    const lines = rawText.split('\n').filter(l => l.trim() !== "");
    let processedLyrics = [];

    lines.forEach(line => {
        // Create the standard line object
        const lineObj = {
            text: line.trim(),
            words: line.trim().split(/\s+/).map(w => ({ word: w, time: "" })),
            time: ""
        };
        processedLyrics.push(lineObj);

        // If in Adlib mode, inject a "." line immediately after
        if (mode === 'adlib') {
            processedLyrics.push({
                text: ".",
                words: [{ word: ".", time: "" }],
                time: ""
            });
        }
    });

    // Per your preference: Always start the [Music] on 00:00.00
    lyricsArray = [
        { text: "♪", words: [{ word: "♪", time: "[00:00.000]" }], time: "[00:00.000]" }, 
        ...processedLyrics
    ];

    lineIdx = 1;
    wordIdx = -1;

    player.src = URL.createObjectURL(file);

    document.getElementById('file-screen').classList.remove('active');
    document.getElementById('sync-screen').classList.add('active');

    // Adlib uses word-mode visualization for the tapping process
    displayContainer.className = (mode === 'line') ? 'line-mode' : 'word-mode';
    renderLyrics();
}

function handleTap() {
    if (player.paused && player.currentTime === 0) player.play();
    const ts = formatLrcTime(player.currentTime);

    if (mode === 'line') {
        if (lyricsArray[lineIdx]) {
            lyricsArray[lineIdx].time = ts;
            lineIdx++;
        }
    } else {
        wordIdx++;
        if (wordIdx === 0 && lyricsArray[lineIdx]) lyricsArray[lineIdx].time = ts;

        if (lyricsArray[lineIdx] && lyricsArray[lineIdx].words[wordIdx]) {
            lyricsArray[lineIdx].words[wordIdx].time = ts;
        }

        if (lyricsArray[lineIdx] && wordIdx >= lyricsArray[lineIdx].words.length - 1) {
            setTimeout(() => {
                wordIdx = -1;
                lineIdx++;
                renderLyrics();
            }, 0);
        }
    }
    updateProgress();
    renderLyrics();
}

function updateProgress() {
    // Re-select the element here to ensure it's captured once the screen is active
    const activeProgressBar = document.getElementById('progress-bar');
    if (!activeProgressBar) return;

    const total = lyricsArray.length - 1;
    const current = lineIdx;
    
    // Ensure we don't divide by zero and calculate percentage
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    activeProgressBar.style.width = `${percentage}%`;
    console.log(`Progress: ${percentage}%`); // Debugging line
}

function renderLyrics() {
    if (lineIdx >= lyricsArray.length) {
        prevLineDisplay.innerText = lyricsArray[lyricsArray.length - 1].text;
        displayContainer.className = "line-mode";
        displayContainer.innerHTML = "Sync Finished!";
        tapBtn.style.display = "none";
        downloadBtn.style.display = "block";
        finishSync();
        return;
    }

    const prevLine = lyricsArray[lineIdx - 1];
    const currentLine = lyricsArray[lineIdx];
    prevLineDisplay.innerText = prevLine ? prevLine.text : "---";

    if (mode === 'line') {
        displayContainer.innerText = currentLine.text;
    } else {
        displayContainer.innerHTML = currentLine.words.map((w, i) => {
            let status = (i === wordIdx) ? "active-word" : (i < wordIdx ? "passed-word" : "");
            return `<span class="word-unit ${status}">${w.word}</span>`;
        }).join('');
    }
}

function finishSync() {
    let output = "";
    const currentMode = sessionStorage.getItem('syncMode'); // Get mode from session

    lyricsArray.forEach((line, index) => {
        if (currentMode === 'line') {
            output += `${line.time}${line.text}\n`;
        } 
        else if (currentMode === 'word') {
            // Standard Word-by-Word logic
            let lineStr = `${line.time}`;
            line.words.forEach(w => {
                const tag = (w.time || line.time).replace('[', '<').replace(']', '>');
                lineStr += `${tag}${w.word} `;
            });
            output += appendClosingTag(lineStr, index) + "\n";
        } 
        else if (currentMode === 'adlib') {
            // NEW: Adlibs Word-to-Word logic
            // Format: [bg:<00:00.000>Word, <00:00.000>Word]
            let adlibParts = [];
            line.words.forEach(w => {
                const tag = (w.time || line.time).replace('[', '<').replace(']', '>');
                adlibParts.push(`${tag}${w.word}`);
            });
            
            let lineStr = `[bg:${adlibParts.join(' ')}`;
            
            // Add closing timestamp without the closing '>' to match your [bg:<...>word] format
            const nextLine = lyricsArray[index + 1];
            let closingTS = "";
            if (nextLine && nextLine.time) {
                closingTS = nextLine.time.replace('[', '<').replace(']', '>'); 
            } else {
                closingTS = formatLrcTime(player.duration || player.currentTime).replace('[', '<').replace(']', '>');
            }
            
            output += `${lineStr} ${closingTS}]\n`;
        }
    });
    finalLrc = output;
}

// Helper to keep code clean
function appendClosingTag(lineStr, index) {
    const nextLine = lyricsArray[index + 1];
    if (nextLine && nextLine.time) {
        const closingTag = nextLine.time.replace('[', '<').replace(']', '>');
        return lineStr.trim() + closingTag;
    } else {
        const finalTag = formatLrcTime(player.duration || player.currentTime).replace('[', '<').replace(']', '>');
        return lineStr.trim() + finalTag;
    }
}

function downloadLRC() {
    if (!finalLrc) finishSync();
    const blob = new Blob([finalLrc], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Set filename to match the audio file
    a.download = `${audioFileName}.lrc`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}