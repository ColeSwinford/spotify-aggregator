import React, { memo } from 'react';
import { Play, Pause, Ban, Music } from 'lucide-react';
import { formatDuration } from '../utils/formatting';
import Badge from './Badge'; // Assuming Badge is in the same folder

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
                loading="lazy"
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
  return (
    prevProps.isPlaying === nextProps.isPlaying && 
    prevProps.track === nextProps.track &&
    prevProps.index === nextProps.index
  );
});

export default TrackRow;