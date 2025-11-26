# Spotify Aggregator

A robust React application designed to aggregate, filter, sort, and export Spotify playlists. This tool allows users to fetch tracks from public user profiles, individual playlists, or merge multiple sources into a single, deduplicated dataset exportable to CSV.

![screenshot of app in use](public/Spotify_Aggregator.png)

## Features

* **Multi-Source Import:** Fetch tracks from a User Profile, a specific Playlist, or merge multiple playlists via URL.
* **Deep Filtering:** Real-time search across Track Name, Artist, and Album.
* **Duplicate Detection:** Instantly identify and filter duplicate tracks across massive libraries.
* **Data Export:** Export your entire curated list to `.csv` for use in Excel or other data tools.
* **Audio Previews:** Native audio playback for track previews directly in the table (when supported by Spotify).
* **Performance:** Optimized and memoized components to handle large datasets (1000+ songs) without UI lag.

## Tech Stack

* **Frontend:** React + Vite
* **Styling:** Tailwind CSS
* **Icons:** Lucide React
* **Language:** JavaScript

## Disclaimer

This project is a third-party tool and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Spotify.
