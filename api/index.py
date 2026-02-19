@app.route('/api/search', methods=['POST'])
def search_rebrickable():
    # 1. Check if the key even exists in the environment
    if not REBRICKABLE_KEY:
        return jsonify({"error": "Server configuration error: Missing API Key"}), 500

    data = request.get_json()
    set_num = str(data.get('set_num', '')).strip()
    
    # 2. Add the suffix if missing
    query_num = f"{set_num}-1" if '-' not in set_num else set_num

    rb_url = f"https://rebrickable.com/api/v3/lego/sets/{query_num}/"
    headers = {'Authorization': f'key {REBRICKABLE_KEY}'}
    
    # This print will show up in the Vercel 'Logs' tab
    print(f"DEBUG: Querying {rb_url} with key starting with {REBRICKABLE_KEY[:5]}...")

    response = requests.get(rb_url, headers=headers)
    
    if response.status_code == 200:
        return jsonify(response.json())
    else:
        # If it returns 401 here, your key is being passed but rejected
        # If it returns 404, the suffixing logic is still likely the issue
        return jsonify({"error": f"Rebrickable returned {response.status_code}"}), response.status_code
