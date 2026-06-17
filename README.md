# BigQuery Release Notes Viewer & Tweet Poster

A modern, high-performance web dashboard built with Python Flask and a vanilla frontend stack. It aggregates official Google Cloud BigQuery release notes in real-time and enables users to quickly draft and share specific updates on X (Twitter).

---

## ✨ Features

- **Live Aggregation**: Real-time parsing of Google Cloud's official BigQuery release notes feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`).
- **Granular Update Splitting**: Automatically divides feed entries by update category (e.g. Features, Issues, Announcements) so you can tweet about a specific enhancement rather than an entire day's log.
- **Smart Tweet Composer**: 
  - Dynamic draft compilation using 4 templates: **Highlights**, **Professional**, **Minimalist**, and **Enthusiastic**.
  - Automatic character limits calculation (safely trims descriptions using `...` to ensure drafts are within Twitter's 280-character limit).
  - Interactive character counter and visual warnings.
- **Offline-Resilient Cache Layer**: Throttles outgoing requests using a 5-minute memory cache. Falls back gracefully to stale cache if the network fails.
- **Premium Glassmorphic UI**: High-fidelity dark mode with neon glow accent bounds, animated background fields, custom scrollbars, and fluid entrance micro-animations.

---

## 📁 Project Directory Structure

```text
agy-cli-projects/
├── app.py                  # Python Flask server (feed fetching, HTML parsing, cache)
├── README.md               # Project documentation
├── .gitignore              # Version control ignore lists
├── templates/
│   └── index.html          # Main HTML structure and layouts
└── static/
    ├── css/
    │   └── style.css       # Custom styles (Responsive glassmorphism, category color rules)
    └── js/
        └── app.js          # Client states (Search, pill filters, Tweet compiling, intents)
```

---

## 🚀 Getting Started

### 📋 Prerequisites
You need **Python 3.x** and **Flask** installed on your system.

To install Flask:
```bash
pip install Flask
```

### 💻 Running the Server
1. Clone or download this project workspace.
2. Open your shell in the project folder and run the server:
   ```bash
   python app.py
   ```
3. Open your browser and navigate to: **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🛠️ Tech Stack & Design Patterns

- **Backend**: Python 3.x / Flask
- **XML Parsing**: `xml.etree.ElementTree` (Standard library)
- **HTML Parsing**: `html.parser.HTMLParser` (Standard library)
- **Frontend**: Plain HTML5, Vanilla JavaScript (ES6+), Vanilla CSS
- **Design System**: Glassmorphism (translucency + blurred backdrop layer bounds) with HSL tailored color schemes for responsive cards.
- **Social Sharing**: Standard Twitter Web Intent mapping:
  `https://twitter.com/intent/tweet?text=<payload>`
