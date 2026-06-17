import os
import re
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime
from html.parser import HTMLParser
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Constants
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_TIMEOUT = 300  # 5 minutes in seconds

# Simple in-memory cache
_cache = {
    "data": None,
    "last_fetched": None
}

class HTMLTextExtractor(HTMLParser):
    """Simple parser to extract text from HTML, removing tags."""
    def __init__(self):
        super().__init__()
        self.text_parts = []
    
    def handle_data(self, data):
        self.text_parts.append(data)
    
    def get_text(self):
        return "".join(self.text_parts).strip()

def extract_text(html_content):
    """Strip HTML tags and return plain text."""
    if not html_content:
        return ""
    try:
        parser = HTMLTextExtractor()
        parser.feed(html_content)
        return parser.get_text()
    except Exception:
        # Fallback to simple regex if HTMLParser fails
        clean_text = re.sub(r'<[^>]+>', '', html_content)
        return clean_text.strip()

def parse_entry_content(date_str, content_html, entry_id):
    """
    Parse the HTML content of a feed entry into separate updates.
    The feed content uses <h3> tags to separate different updates in a single entry.
    """
    if not content_html:
        return []
        
    # Find all <h3>Heading</h3> and get content between them
    pattern = re.compile(r'<h3>(.*?)</h3>', re.IGNORECASE)
    matches = list(pattern.finditer(content_html))
    updates = []
    
    if not matches:
        # Fallback if no <h3> tags are found, treat the whole content as one update
        text_content = extract_text(content_html)
        cleaned_text = re.sub(r'\s+', ' ', text_content).strip()
        return [{
            'id': f"{entry_id}_0",
            'date': date_str,
            'type': 'Update',
            'html': content_html.strip(),
            'text': cleaned_text
        }]
    
    for i, match in enumerate(matches):
        update_type = match.group(1).strip()
        start_idx = match.end()
        end_idx = matches[i+1].start() if i+1 < len(matches) else len(content_html)
        
        item_html = content_html[start_idx:end_idx].strip()
        item_text = extract_text(item_html)
        
        # Clean up double newlines, spaces, etc.
        item_text = re.sub(r'\s+', ' ', item_text).strip()
        
        updates.append({
            'id': f"{entry_id}_{i}",
            'date': date_str,
            'type': update_type,
            'html': item_html,
            'text': item_text
        })
        
    return updates

def fetch_and_parse_feed():
    """Fetch the RSS/Atom feed and parse it into a list of updates."""
    try:
        req = urllib.request.Request(
            FEED_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BQReleaseNotesViewer/1.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        
        # XML Namespaces
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = root.findall('.//atom:entry', ns)
        if not entries:
            # Try without namespace in case XML parser behaves differently
            entries = root.findall('.//{http://www.w3.org/2005/Atom}entry')
            
        all_updates = []
        for entry in entries:
            title_el = entry.find('atom:title', ns) or entry.find('{http://www.w3.org/2005/Atom}title')
            updated_el = entry.find('atom:updated', ns) or entry.find('{http://www.w3.org/2005/Atom}updated')
            id_el = entry.find('atom:id', ns) or entry.find('{http://www.w3.org/2005/Atom}id')
            content_el = entry.find('atom:content', ns) or entry.find('{http://www.w3.org/2005/Atom}content')
            
            title = title_el.text if title_el is not None else "Unknown Date"
            entry_id = id_el.text if id_el is not None else "unknown_id"
            content_html = content_el.text if content_el is not None else ""
            
            # Extract date time for sorting/metadata
            updated_str = updated_el.text if updated_el is not None else ""
            
            # Generate updates from entry
            updates = parse_entry_content(title, content_html, entry_id)
            for update in updates:
                update['raw_updated'] = updated_str
            
            all_updates.extend(updates)
            
        return all_updates, None
        
    except urllib.error.URLError as e:
        return None, f"Network connection error: {str(e)}"
    except ET.ParseError as e:
        return None, f"Failed to parse release notes feed: {str(e)}"
    except Exception as e:
        return None, f"An unexpected error occurred: {str(e)}"

@app.route('/')
def index():
    """Serve the single-page application dashboard."""
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    """API endpoint to get parsed BigQuery release notes."""
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    now = datetime.now()
    
    # Check cache validity
    if (not force_refresh and 
        _cache["data"] is not None and 
        _cache["last_fetched"] is not None and 
        (now - _cache["last_fetched"]).total_seconds() < CACHE_TIMEOUT):
        
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_fetched": _cache["last_fetched"].isoformat(),
            "data": _cache["data"]
        })
        
    # Fetch new data
    data, error = fetch_and_parse_feed()
    
    if error:
        # If fetch fails but we have cached data, return the stale cache with a warning
        if _cache["data"] is not None:
            return jsonify({
                "status": "warning",
                "message": f"Using cached data because refresh failed: {error}",
                "source": "cache_fallback",
                "last_fetched": _cache["last_fetched"].isoformat(),
                "data": _cache["data"]
            })
        return jsonify({
            "status": "error",
            "message": error
        }), 500
        
    # Update cache
    _cache["data"] = data
    _cache["last_fetched"] = now
    
    return jsonify({
        "status": "success",
        "source": "network",
        "last_fetched": now.isoformat(),
        "data": data
    })

if __name__ == '__main__':
    # Default Flask port is 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
