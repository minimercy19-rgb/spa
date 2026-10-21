/**
 * Wordly Dictionary – Single Page Application
 * Uses the Free Dictionary API: https://api.dictionaryapi.dev/api/v2/entries/en/{word}
 */

const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";

// DOM references
const form = document.getElementById("search-form");
const wordInput = document.getElementById("word-input");
const searchBtn = document.getElementById("search-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const favoritesList = document.getElementById("favorites-list");
const favoritesEmpty = document.getElementById("favorites-empty");
const clearFavoritesBtn = document.getElementById("clear-favorites");
 
 

// Local storage key for favorites
const FAVORITES_KEY = "wordly-favorites";

 

// ----- Favorites -----
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveFavorites(list) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  renderFavorites();
}

function isFavorite(word) {
  return getFavorites().some((w) => w.toLowerCase() === word.toLowerCase());
}

function toggleFavorite(word) {
  const list = getFavorites();
  const idx = list.findIndex((w) => w.toLowerCase() === word.toLowerCase());
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift(word);
  }
  saveFavorites(list);
}

function renderFavorites() {
  const list = getFavorites();
  favoritesList.innerHTML = "";
  clearFavoritesBtn.hidden = list.length === 0;
  favoritesEmpty.hidden = list.length > 0;

  list.forEach((word) => {
    const li = document.createElement("li");
    li.className = "favorite-item";

    const wordBtn = document.createElement("button");
    wordBtn.className = "word-link";
    wordBtn.textContent = word;
    wordBtn.setAttribute("aria-label", `Look up ${word}`);
    wordBtn.addEventListener("click", () => {
      wordInput.value = word;
      lookupWord(word);
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-fav";
    removeBtn.innerHTML = "×";
    removeBtn.setAttribute("aria-label", `Remove ${word} from favorites`);
    removeBtn.addEventListener("click", () => toggleFavorite(word));

    li.append(wordBtn, removeBtn);
    favoritesList.appendChild(li);
  });
}

clearFavoritesBtn.addEventListener("click", () => {
  if (confirm("Clear all saved words?")) {
    saveFavorites([]);
  }
});

// ----- Status helpers -----
function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status" + (type ? ` ${type}` : "");
}

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "status";
}

// ----- API & Display -----
async function lookupWord(rawWord) {
  const word = rawWord.trim().toLowerCase();
  if (!word) {
    setStatus("Please enter a word to search.", "error");
    resultsEl.hidden = true;
    return;
  }

  // Basic validation – allow letters, hyphens, apostrophes
  if (!/^[a-zA-Z'-]+$/.test(word)) {
    setStatus("Please enter a valid English word (letters only).", "error");
    resultsEl.hidden = true;
    return;
  }

  setStatus("Looking up…", "loading");
  resultsEl.hidden = true;
  searchBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}${encodeURIComponent(word)}`);

    if (response.status === 404) {
      const errData = await response.json().catch(() => ({}));
      setStatus(
        errData.message || `No definitions found for “${word}”. Try another word.`,
        "error"
      );
      return;
    }

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      setStatus(`No definitions found for “${word}”.`, "error");
      return;
    }

    clearStatus();
    renderResults(data[0]);
  } catch (err) {
    console.error(err);
    setStatus(
      "Unable to reach the dictionary service. Please check your connection and try again.",
      "error"
    );
  } finally {
    searchBtn.disabled = false;
  }
}

function renderResults(entry) {
  const word = entry.word;
  const phonetic =
    entry.phonetic ||
    (entry.phonetics && entry.phonetics.find((p) => p.text)?.text) ||
    "";

  // Find first available audio URL
  let audioUrl = "";
  if (entry.phonetics) {
    const withAudio = entry.phonetics.find((p) => p.audio);
    if (withAudio) {
      audioUrl = withAudio.audio.startsWith("//")
        ? `https:${withAudio.audio}`
        : withAudio.audio;
    }
  }

  const saved = isFavorite(word);

  let html = `
    <div class="word-header">
      <h2 class="word-title">${escapeHtml(word)}</h2>
      ${phonetic ? `<span class="phonetic">${escapeHtml(phonetic)}</span>` : ""}
      <button
        class="audio-btn"
        id="play-audio"
        aria-label="Play pronunciation"
        ${audioUrl ? "" : "disabled"}
        title="${audioUrl ? "Play pronunciation" : "No audio available"}"
      >🔊</button>
      <button
        class="favorite-btn ${saved ? "saved" : ""}"
        id="toggle-favorite"
        aria-label="${saved ? "Remove from favorites" : "Save to favorites"}"
        data-word="${escapeHtml(word)}"
      >
        <span aria-hidden="true">${saved ? "♥" : "♡"}</span>
        ${saved ? "Saved" : "Save"}
      </button>
    </div>
  `;

  // Meanings
  if (entry.meanings && entry.meanings.length) {
    entry.meanings.forEach((meaning) => {
      html += `<div class="meaning-block">`;
      html += `<span class="part-of-speech">${escapeHtml(meaning.partOfSpeech)}</span>`;

      if (meaning.definitions && meaning.definitions.length) {
        meaning.definitions.forEach((def, i) => {
          html += `<div class="definition-item">`;
          html += `<p class="definition-text"><strong>${i + 1}.</strong> ${escapeHtml(def.definition)}</p>`;
          if (def.example) {
            html += `<p class="example">${escapeHtml(def.example)}</p>`;
          }
          if (def.synonyms && def.synonyms.length) {
            html += `<div class="synonyms"><strong>Synonyms: </strong>`;
            def.synonyms.slice(0, 8).forEach((s) => {
              html += `<button type="button" class="synonym-tag" data-word="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
            });
            html += `</div>`;
          }
          if (def.antonyms && def.antonyms.length) {
            html += `<div class="antonyms"><strong>Antonyms: </strong>`;
            def.antonyms.slice(0, 6).forEach((a) => {
              html += `<button type="button" class="antonym-tag" data-word="${escapeHtml(a)}">${escapeHtml(a)}</button>`;
            });
            html += `</div>`;
          }
          html += `</div>`;
        });
      }

      // Meaning-level synonyms/antonyms (fallback)
      if (meaning.synonyms && meaning.synonyms.length) {
        html += `<div class="synonyms" style="margin-top:0.75rem"><strong>Related synonyms: </strong>`;
        meaning.synonyms.slice(0, 8).forEach((s) => {
          html += `<button type="button" class="synonym-tag" data-word="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
        });
        html += `</div>`;
      }

      html += `</div>`;
    });
  }

  // Source / license
  if (entry.sourceUrls && entry.sourceUrls.length) {
    html += `<p class="source">Source: <a href="${escapeHtml(entry.sourceUrls[0])}" target="_blank" rel="noopener noreferrer">View on Wiktionary</a></p>`;
  } else if (entry.license) {
    html += `<p class="source">License: ${escapeHtml(entry.license.name || "Open")}</p>`;
  }

  resultsEl.innerHTML = html;
  resultsEl.hidden = false;

  // Audio playback
  const audioBtn = document.getElementById("play-audio");
  if (audioBtn && audioUrl) {
    audioBtn.addEventListener("click", () => {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {
        setStatus("Could not play audio.", "error");
      });
    });
  }

  // Favorite toggle
  const favBtn = document.getElementById("toggle-favorite");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      toggleFavorite(word);
      // Re-render just the button state
      const nowSaved = isFavorite(word);
      favBtn.classList.toggle("saved", nowSaved);
      favBtn.innerHTML = `<span aria-hidden="true">${nowSaved ? "♥" : "♡"}</span> ${nowSaved ? "Saved" : "Save"}`;
      favBtn.setAttribute("aria-label", nowSaved ? "Remove from favorites" : "Save to favorites");
    });
  }

  // Synonym / antonym click → search that word
  resultsEl.querySelectorAll(".synonym-tag, .antonym-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      const w = btn.dataset.word;
      wordInput.value = w;
      lookupWord(w);
      wordInput.focus();
    });
  });
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ----- Form handling -----
form.addEventListener("submit", (e) => {
  e.preventDefault();
  lookupWord(wordInput.value);
});

 
renderFavorites();

// Focus the input on load for better UX
wordInput.focus();