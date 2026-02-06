from flask import Flask, render_template, jsonify, request
import json
import random
import os

app = Flask(__name__)

def load_stadiums():
    with open('data/stadiums.json', 'r') as f:
        return json.load(f)

def load_config():
    # First check environment variable (for production)
    mapbox_token = os.environ.get('MAPBOX_TOKEN', '')
    if mapbox_token:
        return {'mapbox_token': mapbox_token}

    # Fall back to config.json (for local development)
    config_path = 'config.json'
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

@app.route('/')
def index():
    config = load_config()
    mapbox_token = config.get('mapbox_token', '')
    if mapbox_token == 'YOUR_MAPBOX_TOKEN_HERE':
        mapbox_token = ''
    return render_template('index.html', mapbox_token=mapbox_token)

@app.route('/game')
def game():
    return render_template('game.html')

@app.route('/results')
def results():
    return render_template('results.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/api/stadiums')
def get_stadiums():
    data = load_stadiums()
    return jsonify(data)

@app.route('/api/stadium/random')
def get_random_stadium():
    data = load_stadiums()
    league = request.args.get('league', None)
    exclude_ids = request.args.getlist('exclude')

    stadiums = data['stadiums']

    if league and league != 'all':
        if league == 'MLB':
            stadiums = [s for s in stadiums if s['league'] == 'MLB']
        elif league == 'AAA':
            stadiums = [s for s in stadiums if 'Triple-A' in s['league'] or s['league'] == 'Arizona Fall League']
        elif league == 'AA':
            stadiums = [s for s in stadiums if 'Double-A' in s['league']]
        elif league == 'High-A':
            stadiums = [s for s in stadiums if 'High-A' in s['league']]
        elif league == 'Low-A':
            stadiums = [s for s in stadiums if 'Low-A' in s['league']]
        elif league == 'Spring':
            stadiums = [s for s in stadiums if s['league'] == 'Spring Training']
        elif league == 'other':
            stadiums = [s for s in stadiums if s['sport'] != 'baseball']

    if exclude_ids:
        stadiums = [s for s in stadiums if s['id'] not in exclude_ids]

    if not stadiums:
        return jsonify({'error': 'No stadiums available'}), 404

    stadium = random.choice(stadiums)

    response = {
        'id': stadium['id'],
        'team': stadium['team'],
        'sport': stadium['sport'],
        'league': stadium['league'],
        'coordinates': stadium['coordinates'],
        'hints': stadium['hints'],
        'name': stadium['name'],
        'radius': stadium.get('radius', 150)
    }

    return jsonify(response)

@app.route('/api/sports')
def get_sports():
    data = load_stadiums()
    sports = list(set(s['sport'] for s in data['stadiums']))
    return jsonify(sports)

if __name__ == '__main__':
    app.run(debug=True)
