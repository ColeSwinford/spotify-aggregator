import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { 
  Search, Download, Database, User, Music, Loader2, LogOut, 
  ListMusic, Copy, Layers, ChevronDown, ChevronsDown, Clock
} from 'lucide-react';

// --- IMPORTS ---
import { CLIENT_ID, REDIRECT_URI, SCOPES } from './config';
import { formatTotalTime } from './utils/formatting';
import { generateRandomString, generateCodeChallenge, extractSpotifyId } from './utils/spotify';

// --- COMPONENTS ---
import Button from './components/Button';
import Card from './components/Card';
import SortHeader from './components/SortHeader';
import TrackRow from './components/TrackRow';

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

  // NOTE: In a larger app, this fetch logic would move to a custom hook (e.g., useSpotifyImporter)
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
  }, [targetInput, importMode, token]);

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
  // The logic for the JSX return remains largely the same, but now uses the imported components.
  // ... [The rest of your JSX from the original file goes here] ...
  return (
    <div className="min-h-screen bg-black text-white font-sans p-4 sm:p-8">
      {/* ... Header ... */}
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
            {/* Only show this block if we are in Development mode */}
            {import.meta.env.DEV && (
              <div className="bg-[#242424] p-4 rounded-md text-left text-xs text-[#b3b3b3] font-mono break-all border border-yellow-500/30">
                <span className="block mb-2 text-white font-bold uppercase tracking-wider text-[10px] text-yellow-500">
                  Developer Setup (Dev Mode Only)
                </span>
                <span className="opacity-50 block mb-1">Add this to Spotify Dashboard:</span>
                {REDIRECT_URI}
              </div>
            )}
            <Button onClick={handleLogin} className="w-full py-4 text-base tracking-wide uppercase">Connect App</Button>
            </div>
          </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT SIDEBAR */}
          <div className="lg:col-span-3 space-y-6 flex flex-col h-auto lg:h-[800px] relative lg:sticky lg:top-8">
            <Card className="space-y-6 border border-[#282828] shrink-0">
               {/* ... Import Controls using Button and Icons ... */}
               <h3 className="font-bold text-lg">Import Sources</h3>
               {/* ... (Keep existing sidebar JSX) ... */}
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
                      placeholder={`https://open.spotify.com/playlist/...`}
                      className="w-full h-24 bg-[#242424] text-white rounded-md p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-white/20 resize-none placeholder-[#727272]"
                    />
                  ) : (
                    <input
                      type="text"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      placeholder={importMode === 'user' ? "https://open.spotify.com/user/..." : "https://open.spotify.com/playlist/..."}
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

          {/* RIGHT CONTENT */}
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
      <footer className="text-center text-xs text-[#727272] pt-8 mt-8 border-t border-[#282828] pb-8">
          <p>This is a third-party tool and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Spotify.</p>
          <p className="mt-2">All Spotify logos and trademarks are property of Spotify AB.</p>
          
          <p className="mt-6 text-[#b3b3b3]">
            Designed and built by{' '}
            <a 
              href="https://github.com/ColeSwinford/spotify-aggregator" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white hover:text-[#1ed760] hover:underline transition-colors font-medium"
            >
              Cole Swinford
            </a>
          </p>
        </footer>
    </div>
  );
}