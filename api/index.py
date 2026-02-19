from flask import Flask, request, jsonify
from supabase import create_client
import requests
import os

app = Flask(__name__)

# These will be set in Vercel's dashboard, not in the code!
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
rebrickable_key = os.environ.get("REBRICKABLE_KEY")
supabase = create_client(url, key)

@app.route('/api/search', methods=['POST'])
def add_set():
    data = request.json
    # Fetch data from Rebrickable first
    rb_url = f"https://rebrickable.com/api/v3/lego/sets/{data['set_num']}-1/"
    headers = {'Authorization': f'key {rebrickable_key}'}
    rb_resp = requests.get(rb_url, headers=headers).json()

    # Save to Supabase
    entry = {
        "set_num": rb_resp['set_num'],
        "name": rb_resp['name'],
        "year": rb_resp['year'],
        "img_url": rb_resp['set_img_url']
    }
    supabase.table("lego_collection").insert(entry).execute()
    return jsonify({"status": "success"})

@app.route('/api/my-sets', methods=['GET'])
def get_sets():
    response = supabase.table("lego_collection").select("*").execute()
    return jsonify(response.data)
