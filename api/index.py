import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # This is critical to allow your frontend to talk to your backend

# Load Environment Variables from Vercel
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
REBRICKABLE_KEY = os.environ.get("REBRICKABLE_KEY")

# Safety Check: Initialize Supabase only if keys are present
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.route('/api/search', methods=['POST'])
def search_set():
    if not REBRICKABLE_KEY:
        return jsonify({"error": "REBRICKABLE_KEY is missing in Vercel settings"}), 500
    
    data = request.get_json()
    raw_num = str(data.get('set_num', '')).strip()
    
    if not raw_num:
        return jsonify({"error": "No set number provided"}), 400

    # Format set number for Rebrickable (e.g., 75192 -> 75192-1)
    set_num = f"{raw_num}-1" if '-' not in raw_num else raw_num

    url = f"https://rebrickable.com/api/v3/lego/sets/{set_num}/"
    headers = {"Authorization": f"key {REBRICKABLE_KEY}"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return jsonify(response.json())
        elif response.status_code == 404:
            return jsonify({"error": f"Set {set_num} not found on Rebrickable"}), 404
        else:
            return jsonify({"error": "Rebrickable API error", "status": response.status_code}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/add-set', methods=['POST'])
def add_set():
    if not supabase:
        return jsonify({"error": "Supabase not configured"}), 500
        
    data = request.get_json()
    
    # Map Rebrickable data to your Supabase table columns
    new_set = {
        "set_num": data.get("set_num"),
        "name": data.get("name"),
        "year": data.get("year"),
        "img_url": data.get("set_img_url")
    }

    try:
        result = supabase.table("lego_collection").insert(new_set).execute()
        return jsonify({"message": "Successfully added!", "data": result.data}), 201
    except Exception as e:
        # Likely a unique constraint error if the set is already added
        return jsonify({"error": "Could not add set. Is it a duplicate?"}), 400

@app.route('/api/my-sets', methods=['GET'])
def get_collection():
    if not supabase:
        return jsonify({"error": "Supabase not configured"}), 500
        
    try:
        # Fetch all sets from your table
        response = supabase.table("lego_collection").select("*").order("created_at", desc=True).execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Vercel requirements: The app object must be available at the top level
if __name__ == "__main__":
    app.run(debug=True)
