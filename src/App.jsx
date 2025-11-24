// TODO: add attribution footer and tlink to github

import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue, memo } from 'react';
import { 
  Search, Download, Database, User, Music, Loader2, LogOut, ListMusic, 
  Copy, Layers, ChevronDown, ChevronsDown, Play, Pause, 
  Ban, Clock, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

// --- CONFIGURATION ---
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID; 
const REDIRECT_URI = "http://127.0.0.1:5173/";
const SCOPES = "user-read-private playlist-read-private";

// --- UTILS ---
const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const generateCodeChallenge = async (codeVerifier) => {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const extractSpotifyId = (input) => {
  let cleanId = input.trim();
  if (cleanId.includes('spotify.com')) {
    const parts = cleanId.split('/');
    const lastPart = parts[parts.length - 1];
    cleanId = lastPart.split('?')[0];
  }
  return cleanId;
};

const formatDuration = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
};

const formatTotalTime = (ms) => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours} hr ${minutes} min`;
  return `${minutes} min`;
};

// --- OPTIMIZED SUB-COMPONENTS ---

// Memoized Button prevents re-renders when parent state changes but button props don't
const Button = memo(({ children, onClick, variant = 'primary', disabled = false, icon: Icon, spinIcon = false, className = '' }) => {
  const baseStyle = "flex items-center justify-center px-6 py-2 rounded-full font-bold text-sm transition-transform duration-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  
  const variants = {
    primary: "bg-[#1ed760] hover:bg-[#1fdf64] text-black hover:scale-105", 
    secondary: "bg-white text-black hover:scale-105", 
    outline: "bg-transparent border border-[#727272] text-white hover:border-white hover:scale-105", 
    ghost: "bg-transparent text-[#b3b3b3] hover:text-white hover:bg-[#ffffff10] !px-4", 
    danger: "bg-transparent text-[#f15e6c] border border-[#f15e6c] hover:bg-[#f15e6c] hover:text-white"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={18} className={`mr-2 ${spinIcon ? 'animate-spin' : ''}`} />}
      {children}
    </button>
  );
});

const Badge = memo(({ children, onClick }) => {
  return (
    <span 
      onClick={onClick}
      className="px-2 py-1 rounded-sm text-[11px] font-medium transition-colors cursor-pointer bg-[#2a2a2a] text-white text-opacity-90 hover:bg-[#333]"
    >
      {children}
    </span>
  );
});

const SortHeader = memo(({ label, sortKey, currentSort, onSort, className = "" }) => {
  const isActive = currentSort.key === sortKey;
  return (
    <th 
      className={`p-4 cursor-pointer group transition-colors hover:text-white ${isActive ? 'text-[#1ed760]' : ''} ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-2">
        {label}
        {isActive && (
          currentSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        )}
        {!isActive && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50" />}
      </div>
    </th>
  );
});

// Heavily optimized Table Row. Only re-renders if THIS specific track's playing state changes
const TrackRow = memo(({ track, index, isPlaying, onTogglePreview }) => {
  return (
    <tr className="hover:bg-[#2a2a2a] group transition-colors cursor-default">
      <td className="p-4 text-center font-mono text-xs w-12 relative">
        <span className="group-hover:hidden">{index + 1}</span>
        <button 
          onClick={() => onTogglePreview(track.id, track.preview_url)}
          className={`absolute inset-0 m-auto w-full h-full items-center justify-center ${isPlaying ? 'flex' : 'hidden group-hover:flex'}`}
        >
          {track.preview_url ? (
            isPlaying ? <Pause size={16} className="text-[#1ed760]" fill="currentColor"/> : <Play size={16} className="text-white" fill="currentColor"/>
          ) : (
            <Ban size={14} className="text-[#535353]" />
          )}
        </button>
      </td>
      
      <td className="p-4 max-w-[250px]">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0">
            {track.album.images[2] ? (
              <img 
                src={track.album.images[2].url} 
                alt="" 
                loading="lazy" // Performance: Native lazy loading
                className="w-full h-full rounded shadow-sm" 
              />
            ) : (
              <div className="w-full h-full bg-[#282828] rounded flex items-center justify-center">
                <Music size={16} />
              </div>
            )}
          </div>
          <div className="flex flex-col overflow-hidden">
            <a 
              href={track.external_urls?.spotify || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              className={`font-medium text-sm truncate hover:underline decoration-[#1ed760] underline-offset-2 ${isPlaying ? 'text-[#1ed760]' : 'text-white'}`}
            >
              {track.name}
            </a>
            <span className="text-xs truncate group-hover:text-white transition-colors">
              {track.artists.map((artist, idx) => (
                <span key={idx}>
                  {idx > 0 && ", "}
                  <a href={artist.external_urls?.spotify} target="_blank" rel="noreferrer" className="hover:underline">{artist.name}</a>
                </span>
              ))}
            </span>
          </div>
        </div>
      </td>
      
      <td className="p-4 hidden sm:table-cell text-xs group-hover:text-white transition-colors truncate max-w-[200px]">
        <a href={track.album.external_urls?.spotify} target="_blank" rel="noreferrer" className="hover:underline">
          {track.album.name}
        </a>
      </td>
      
      <td className="p-4 hidden md:table-cell">
        <a 
          href={`https://open.spotify.com/playlist/${track.playlistId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <Badge>{track.playlistName}</Badge>
        </a>
      </td>

      <td className="p-4 text-right pr-8 font-mono text-xs">
        {formatDuration(track.duration_ms)}
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for performance: Only re-render if playing state changed for THIS track
  return (
    prevProps.isPlaying === nextProps.isPlaying && 
    prevProps.track === nextProps.track &&
    prevProps.index === nextProps.index
  );
});

const Card = ({ children, className = '' }) => (
  <div className={`bg-[#121212] rounded-lg p-6 ${className}`}>
    {children}
  </div>
);

// --- MAIN APP ---

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('sp_access_token') || null);
  
  // Input State
  const [targetInput, setTargetInput] = useState('');
  const [importMode, setImportMode] = useState('user'); 

  // Data State
  const [status, setStatus] = useState('idle'); 
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [allTracks, setAllTracks] = useState([]);
  
  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  // Performance: Defers filtering until after input renders, making typing feel instant
  const deferredSearchQuery = useDeferredValue(searchQuery);
  
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(500);
  const [sortConfig, setSortConfig] = useState({ key: 'playlistName', direction: 'asc' });
  const [playlistFilters, setPlaylistFilters] = useState(new Set()); 

  // Audio Player State
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const audioRef = useRef(new Audio());

  // --- AUTHENTICATION ---
  const handleLogin = useCallback(async () => {
    if (!CLIENT_ID || CLIENT_ID === "PASTE_YOUR_CLIENT_ID_HERE") {
      alert("Client ID missing! Check your .env file and restart the server.");
      return;
    }
    const verifier = generateRandomString(128);
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem("sp_verifier", verifier);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    localStorage.removeItem('sp_access_token');
    localStorage.removeItem('sp_refresh_token');
    setAllTracks([]);
    setStatus('idle');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && !token) {
      const exchangeToken = async () => {
        const verifier = localStorage.getItem("sp_verifier");
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: CLIENT_ID,
              grant_type: "authorization_code",
              code,
              redirect_uri: REDIRECT_URI,
              code_verifier: verifier,
            }),
          });
          const data = await response.json();
          if (data.access_token) {
            setToken(data.access_token);
            localStorage.setItem('sp_access_token', data.access_token);
          }
        } catch (e) {
          console.error(e);
        }
      };
      exchangeToken();
    }
  }, [token]);

  // --- AUDIO ---
  const togglePreview = useCallback((trackId, previewUrl) => {
    if (!previewUrl) return;
    if (playingTrackId === trackId) {
      audioRef.current.pause();
      setPlayingTrackId(null);
    } else {
      audioRef.current.src = previewUrl;
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.warn("Autoplay blocked"));
      setPlayingTrackId(trackId);
      audioRef.current.onended = () => setPlayingTrackId(null);
    }
  }, [playingTrackId]);

  useEffect(() => {
    return () => audioRef.current.pause();
  }, []);

  // --- IMPORT LOGIC ---
  const addLog = (msg, type = 'info') => {
    setLogs(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchWithBackoff = async (url, retries = 3) => {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        handleLogout();
        throw new Error("Session expired. Please log in again.");
      }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After')) || 5;
        addLog(`Rate limit hit. Waiting ${retryAfter}s...`, 'warning');
        await sleep((retryAfter + 1) * 1000);
        return fetchWithBackoff(url, retries);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (retries > 0 && !e.message.includes("Session expired")) {
        await sleep(1000);
        return fetchWithBackoff(url, retries - 1);
      }
      throw e;
    }
  };

  const startImport = useCallback(async () => {
    if (!targetInput) return;
    setAllTracks([]);
    setLogs([]);
    setProgress({ current: 0, total: 0 });
    setVisibleLimit(500);
    setPlaylistFilters(new Set()); 
    setStatus('fetching_metadata');
    
    addLog(`Starting ${importMode} import...`);

    try {
      let playlistsToProcess = [];
      let totalSongsToFetch = 0;

      const processPlaylistMetadata = (playlist) => {
        playlistsToProcess.push(playlist);
        const count = playlist.tracks?.total || 0;
        totalSongsToFetch += count;
        setProgress(prev => ({ ...prev, total: totalSongsToFetch }));
      };

      if (importMode === 'user') {
        const userId = extractSpotifyId(targetInput);
        let nextUrl = `https://api.spotify.com/v1/users/${userId}/playlists?limit=50`;
        while (nextUrl) {
          const data = await fetchWithBackoff(nextUrl);
          data.items.forEach(processPlaylistMetadata);
          addLog(`Found ${data.items.length} playlists in this batch...`);
          nextUrl = data.next;
        }
      } else if (importMode === 'playlist') {
        const pid = extractSpotifyId(targetInput);
        const playlistData = await fetchWithBackoff(`https://api.spotify.com/v1/playlists/${pid}`);
        processPlaylistMetadata(playlistData);
      } else if (importMode === 'multi') {
        const rawInputs = targetInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        for (const raw of rawInputs) {
          const pid = extractSpotifyId(raw);
          try {
            const data = await fetchWithBackoff(`https://api.spotify.com/v1/playlists/${pid}`);
            processPlaylistMetadata(data);
            addLog(`Resolved: ${data.name}`, 'success');
          } catch (e) {
            addLog(`Failed to find playlist: ${pid}`, 'error');
          }
        }
      }

      if (playlistsToProcess.length === 0) throw new Error("No valid playlists found.");

      const initialFilterSet = new Set(playlistsToProcess.map(p => p.id));
      setPlaylistFilters(initialFilterSet);

      setStatus('fetching_tracks');
      addLog(`Starting download of ${totalSongsToFetch} songs...`);

      const CHUNK_SIZE = 3; 
      for (let i = 0; i < playlistsToProcess.length; i += CHUNK_SIZE) {
        const chunk = playlistsToProcess.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (playlist) => {
          let trackUrl = `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=100&fields=next,items(track(name,id,uri,preview_url,duration_ms,popularity,external_urls,album(name,images,external_urls),artists(name,external_urls)))`;
          try {
            while (trackUrl) {
              const data = await fetchWithBackoff(trackUrl);
              const validTracks = data.items
                .filter(item => item.track)
                .map(item => ({
                  ...item.track,
                  playlistName: playlist.name,
                  playlistId: playlist.id
                }));
              
              if (validTracks.length > 0) {
                setAllTracks(prev => [...prev, ...validTracks]);
                setProgress(prev => ({ ...prev, current: prev.current + validTracks.length }));
              }
              trackUrl = data.next;
            }
          } catch (e) {
            addLog(`Error in ${playlist.name}`, 'error');
          }
        }));
      }
      setStatus('complete');
    } catch (e) {
      if (e.message !== "Session expired. Please log in again.") {
        addLog(`Fatal Error: ${e.message}`, 'error');
        setStatus('error');
      }
    }
  }, [targetInput, importMode, token]); // Added dependencies for callback

  // --- SORTING & FILTERING ---

  const handleSort = useCallback((key) => {
    setSortConfig(prev => {
      let direction = 'asc';
      if (prev.key === key && prev.direction === 'asc') {
        direction = 'desc';
      }
      return { key, direction };
    });
  }, []);

  // Logic simplified but functionality identical
  const uniquePlaylists = useMemo(() => {
    const map = new Map();
    allTracks.forEach(t => {
      if (!map.has(t.playlistId)) {
        map.set(t.playlistId, { id: t.playlistId, name: t.playlistName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTracks]);

  const filteredTracks = useMemo(() => {
    let data = [...allTracks];

    if (playlistFilters.size > 0) {
      if (uniquePlaylists.length > 0 && playlistFilters.size < uniquePlaylists.length) {
         data = data.filter(t => playlistFilters.has(t.playlistId));
      } else if (playlistFilters.size === 0 && uniquePlaylists.length > 0) {
         data = [];
      }
    }

    if (showDuplicates) {
      const idCounts = {};
      data.forEach(track => { idCounts[track.id] = (idCounts[track.id] || 0) + 1; });
      data = data.filter(track => idCounts[track.id] > 1);
    }

    // Use deferredSearchQuery here instead of raw searchQuery
    if (deferredSearchQuery) {
      const lowerQ = deferredSearchQuery.toLowerCase();
      data = data.filter(t => 
        t.name.toLowerCase().includes(lowerQ) ||
        t.artists.some(a => a.name.toLowerCase().includes(lowerQ)) ||
        t.album.name.toLowerCase().includes(lowerQ)
      );
    }

    data.sort((a, b) => {
      let valA, valB;

      switch (sortConfig.key) {
        case 'name': 
          valA = a.name.toLowerCase(); 
          valB = b.name.toLowerCase(); 
          break;
        case 'artist': 
          valA = a.artists[0].name.toLowerCase(); 
          valB = b.artists[0].name.toLowerCase(); 
          break;
        case 'album': 
          valA = a.album.name.toLowerCase(); 
          valB = b.album.name.toLowerCase(); 
          break;
        case 'duration': 
          valA = a.duration_ms; 
          valB = b.duration_ms; 
          break;
        case 'playlistName': 
          valA = a.playlistName.toLowerCase(); 
          valB = b.playlistName.toLowerCase(); 
          break;
        default: return 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [allTracks, deferredSearchQuery, showDuplicates, sortConfig, playlistFilters, uniquePlaylists]);

  const totalDuration = useMemo(() => {
    return filteredTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
  }, [filteredTracks]);

  const exportCSV = useCallback(() => {
    const headers = ["Track Name", "Artist", "Album", "Duration (ms)", "Playlist", "URI", "Link"];
    const rows = filteredTracks.map(t => [
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.artists.map(a => a.name).join(', ')}"`,
      `"${t.album.name.replace(/"/g, '""')}"`,
      t.duration_ms,
      `"${t.playlistName.replace(/"/g, '""')}"`,
      t.uri,
      t.external_urls?.spotify || ''
    ]);
    const csvContent = headers.join(",") + "\n" + rows.join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `spotify_aggregator_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredTracks]);

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-black text-white font-sans p-4 sm:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="bg-[#1ed760] p-3 rounded-full shadow-lg shadow-green-900/20">
              <Database className="text-black" size={32} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tighter text-white">
                Spotify Aggregator
              </h1>
              <p className="text-[#b3b3b3] text-sm mt-1">Your library, unfiltered and exportable.</p>
            </div>
          </div>
          {token && (
            <Button variant="ghost" onClick={handleLogout} icon={LogOut}>
              Log out
            </Button>
          )}
        </header>

        {!token ? (
          // LOGIN CARD
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-[#121212] p-10 rounded-lg max-w-md w-full text-center space-y-8 border border-[#282828]">
              <h2 className="text-2xl font-bold text-white">Log in to Spotify</h2>
              <div className="bg-[#242424] p-4 rounded-md text-left text-xs text-[#b3b3b3] font-mono break-all">
                <span className="block mb-2 text-white font-bold uppercase tracking-wider text-[10px]">Redirect URI Setup</span>
                {REDIRECT_URI}
              </div>
              <Button onClick={handleLogin} className="w-full py-4 text-base tracking-wide uppercase">Connect App</Button>
            </div>
          </div>
        ) : (
          // MAIN GRID
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT SIDEBAR */}
            <div className="lg:col-span-3 space-y-6 flex flex-col h-auto lg:h-[800px] relative lg:sticky lg:top-8">
              <Card className="space-y-6 border border-[#282828] shrink-0">
                <h3 className="font-bold text-lg">Import Sources</h3>
                <div className="grid grid-cols-3 bg-[#000000] rounded-lg p-1 gap-1">
                  {[{ id: 'user', label: 'Profile', icon: User }, { id: 'playlist', label: 'Playlist', icon: ListMusic }, { id: 'multi', label: 'Merge', icon: Layers }].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setImportMode(mode.id)}
                      className={`flex flex-col items-center justify-center py-3 rounded-md text-xs font-medium transition-all ${importMode === mode.id ? 'bg-[#242424] text-white shadow-sm' : 'text-[#b3b3b3] hover:text-white hover:bg-[#121212]'}`}
                    >
                      <mode.icon size={18} className="mb-1" /> {mode.label}
                    </button>
                  ))}
                </div>
                <div className="relative group">
                  {importMode === 'multi' ? (
                    <textarea
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      placeholder={`https://open.spotify.com/playlist/...\nhttps://open.spotify.com/playlist/...`}
                      className="w-full h-24 bg-[#242424] text-white rounded-md p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-white/20 resize-none placeholder-[#727272]"
                    />
                  ) : (
                    <input
                      type="text"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      placeholder={importMode === 'user' ? "e.g. spotify" : "https://open.spotify.com/playlist/..."}
                      className="w-full bg-[#242424] text-white rounded-full py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-[#727272]"
                    />
                  )}
                </div>
                <Button 
                  onClick={startImport} 
                  disabled={status.includes('fetching') || !targetInput}
                  className="w-full"
                  icon={status.includes('fetching') ? Loader2 : Database}
                  spinIcon={status.includes('fetching')}
                >
                  {status === 'idle' ? 'Fetch Data' : status === 'complete' ? 'Fetch New' : 'Fetching...'}
                </Button>

                {/* Status Indicator with Progress Bar */}
                {status !== 'idle' && (
                  <div className="bg-[#242424] rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-[#b3b3b3]">Status</span>
                      <span className={status === 'error' ? 'text-[#f15e6c]' : 'text-[#1ed760]'}>
                        {status.toUpperCase()}
                      </span>
                    </div>
                    
                    {status === 'fetching_tracks' && (
                      <>
                        <div className="h-1 bg-[#121212] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#1ed760] transition-all duration-300 ease-out"
                            style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-[#727272] font-mono mt-1">
                          <span>{progress.current} imported</span>
                          <span>{Math.round((progress.current / (progress.total || 1)) * 100)}%</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between text-xs border-t border-[#333] pt-3 mt-2">
                      <span className="text-[#b3b3b3]">Tracks Found</span>
                      <span className="text-white font-mono">
                        {status === 'fetching_tracks' ? progress.total : allTracks.length}
                      </span>
                    </div>
                  </div>
                )}

                {/* Logs Console */}
                <div className="bg-black rounded-md p-3 h-48 overflow-y-auto font-mono text-[10px] leading-relaxed border border-[#282828]">
                  {logs.length === 0 && <span className="text-[#535353]">System ready...</span>}
                  {logs.map((log, i) => (
                    <div key={i} className={`${log.type === 'error' ? 'text-[#f15e6c]' : log.type === 'warning' ? 'text-[#ffa42b]' : 'text-[#b3b3b3]'}`}>
                      <span className="opacity-30 mr-2">[{log.time}]</span>
                      {log.msg}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* RIGHT CONTENT (DATA TABLE) */}
            <div className="lg:col-span-9 flex flex-col h-[600px] lg:h-[800px]">
              <Card className="flex-1 flex flex-col overflow-hidden border border-[#282828] !p-0">
                
                {/* Toolbar */}
                <div className="p-4 border-b border-[#282828] flex flex-col gap-4 bg-[#121212] sticky top-0 z-20">
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-2.5 text-[#b3b3b3]" size={18} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tracks, artists, or albums..."
                        className="w-full bg-[#242424] text-white rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-[#727272]"
                      />
                    </div>
                    
                    <div className="flex gap-6 text-xs font-medium text-[#b3b3b3]">
                      <div className="flex flex-col items-end">
                        <span className="text-white text-sm font-bold">{filteredTracks.length}</span>
                        <span>Songs</span>
                      </div>
                      <div className="flex flex-col items-end hidden sm:flex">
                        <span className="text-white text-sm font-bold">{formatTotalTime(totalDuration)}</span>
                        <span>Total Time</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Button 
                        variant={showDuplicates ? 'primary' : 'outline'} 
                        onClick={() => setShowDuplicates(!showDuplicates)}
                        icon={Copy}
                        disabled={allTracks.length === 0}
                        className="!px-4 !py-1.5 text-xs whitespace-nowrap h-8"
                      >
                        {showDuplicates ? 'Duplicates Only' : 'Find Duplicates'}
                      </Button>
                    </div>
                    <Button 
                      variant="secondary" 
                      onClick={exportCSV} 
                      disabled={allTracks.length === 0} 
                      icon={Download}
                      className="!px-4 !py-1.5 text-xs h-8"
                    >
                      Export List
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-[#121212]">
                  <table className="w-full text-left text-sm text-[#b3b3b3] relative">
                    <thead className="bg-[#181818] text-[#b3b3b3] sticky top-0 z-10 text-xs uppercase tracking-wider font-medium border-b border-[#282828]">
                      <tr>
                        <th className="p-4 w-12 text-center">#</th>
                        <SortHeader label="Title" sortKey="name" currentSort={sortConfig} onSort={handleSort} />
                        <SortHeader label="Album" sortKey="album" currentSort={sortConfig} onSort={handleSort} className="hidden sm:table-cell" />
                        <SortHeader label="Playlist" sortKey="playlistName" currentSort={sortConfig} onSort={handleSort} className="hidden md:table-cell" />
                        <SortHeader label={<Clock size={16}/>} sortKey="duration" currentSort={sortConfig} onSort={handleSort} className="w-24 text-right pr-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#282828]">
                      {filteredTracks.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-20 text-center text-[#535353]">
                            <Music size={64} className="mx-auto mb-6 opacity-20" />
                            <p className="text-lg font-medium">{status === 'idle' ? 'Ready to import' : 'No matching tracks found'}</p>
                            {status === 'idle' && <p className="text-sm mt-2">Select a source on the left to begin.</p>}
                          </td>
                        </tr>
                      ) : (
                        filteredTracks.slice(0, visibleLimit).map((track, i) => (
                          <TrackRow 
                            key={`${track.id}-${i}`} 
                            track={track} 
                            index={i} 
                            isPlaying={playingTrackId === track.id} 
                            onTogglePreview={togglePreview} 
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                  
                  {filteredTracks.length > visibleLimit && (
                    <div className="p-8 border-t border-[#282828] flex flex-col items-center gap-4 bg-gradient-to-b from-[#121212] to-black">
                      <span className="text-xs text-[#727272]">
                        Showing {visibleLimit} of {filteredTracks.length} tracks
                      </span>
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setVisibleLimit(prev => prev + 500)} icon={ChevronDown}>
                          Show More
                        </Button>
                        <Button variant="ghost" onClick={() => setVisibleLimit(filteredTracks.length)} icon={ChevronsDown}>
                          Show All
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="text-center text-xs text-[#727272] pt-8 mt-8 border-t border-[#282828]">
          <p>This is a third-party tool and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Spotify.</p>
          <p className="mt-2">All Spotify logos and trademarks are property of Spotify AB.</p>
        </footer>

      </div>
    </div>
  );
}