@app.route('/api/search', methods=['POST'])
def search_rebrickable():
    data = request.get_json()
    set_num = str(data.get('set_num', '')).strip() # Clean up whitespace
    
    if not set_num:
        return jsonify({"error": "No set number provided"}), 400

    # Ensure suffix is present (75192 becomes 75192-1)
    # But don't double it if the user already typed 75192-1
    if '-' not in set_num:
        query_num = f"{set_num}-1"
    else:
        query_num = set_num

    rb_url = f"https://rebrickable.com/api/v3/lego/sets/{query_num}/"
    headers = {'Authorization': f'key {REBRICKABLE_KEY}'}
    
    print(f"Querying Rebrickable for: {query_num}") # Check your Vercel logs for this!
    response = requests.get(rb_url, headers=headers)
    
    if response.status_code == 200:
        return jsonify(response.json())
    else:
        # Return more detail so you can debug
        return jsonify({
            "error": "Set not found", 
            "queried_as": query_num,
            "status_code": response.status_code
        }), 404
