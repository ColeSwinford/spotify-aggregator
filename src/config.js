// src/config.js
export const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID; 
// Automatically switch redirect URI based on environment
export const REDIRECT_URI = import.meta.env.MODE === 'production' 
  ? "https://coleswinford.github.io/spotify-aggregator/"
  : "http://127.0.0.1:5173/";
  
export const SCOPES = "user-read-private playlist-read-private";