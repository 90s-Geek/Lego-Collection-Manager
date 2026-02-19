from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client
import requests
import os

app = Flask(__name__)
CORS(app) # Prevents cross-origin browser errors

# Environment Variables (Set these in Vercel Dashboard)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
REBRICKABLE_KEY = os.environ.get("REBRICKABLE_KEY")

# Initialize Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.route('/api/search', methods=['POST'])
def search_rebrickable():
    data = request.get_json()
    set_num = data.get('set_num')
    
    if not set_num:
        return jsonify({"error": "No set number provided"}), 400

    # Rebrickable usually requires the suffix (e.g., -1)
    if '-' not in set_num:
        set_num = f"{set_num}-1"

    rb_url = f"https://rebrickable.com/api/v3/lego/sets/{set_num}/"
    headers = {'Authorization': f'key {REBRICKABLE_KEY}'}
    
    response = requests.get(rb_url, headers=headers)
    
    if response.status_code == 200:
        return jsonify(response.json())
    else:
        return jsonify({"error": "Set not found on Rebrickable"}), 404

@app.route('/api/add-set', methods=['POST'])
def add_to_collection():
    data = request.get_json()
    
    # Structure data for Supabase
    entry = {
        "set_num": data.get('set_num'),
        "name": data.get('name'),
        "year": int(data.get('year')),
        "img_url": data.get('set_img_url')
    }

    try:
        result = supabase.table("lego_collection").insert(entry).execute()
        return jsonify({"status": "success", "data": result.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/my-sets', methods=['GET'])
def get_collection():
    try:
        # Fetch all sets from Supabase, ordered by newest first
        response = supabase.table("lego_collection").select("*").order("created_at", desc=True).execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Required for Vercel
def handler(event, context):
    return app(event, context)
