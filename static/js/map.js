class GameMap {
    constructor(containerId, token) {
        this.containerId = containerId;
        this.token = token;
        this.map = null;
        this.guessMarker = null;
        this.correctMarker = null;
        this.lineLayer = null;
        this.onGuessPlaced = null;
    }

    init(league = 'all') {
        mapboxgl.accessToken = this.token;

        // US-based leagues start zoomed to North America
        const leagueSettings = {
            'MLB': { center: [-98, 39], zoom: 3 },
            'AAA': { center: [-98, 39], zoom: 3 },
            'AA': { center: [-95, 35], zoom: 4 },
            'High-A': { center: [-95, 35], zoom: 4 },
            'Low-A': { center: [-95, 35], zoom: 4 },
            'Spring': { center: [-95, 30], zoom: 4 },
            'all': { center: [0, 20], zoom: 1 },
            'other': { center: [0, 20], zoom: 1 }
        };

        const settings = leagueSettings[league] || leagueSettings['all'];

        this.map = new mapboxgl.Map({
            container: this.containerId,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: settings.center,
            zoom: settings.zoom,
            projection: 'globe'
        });

        this.league = league;

        this.map.addControl(new mapboxgl.NavigationControl(), 'top-left');

        this.map.on('click', (e) => this.handleMapClick(e));

        return new Promise((resolve) => {
            this.map.on('load', () => {
                // Remove POI and other revealing labels, keep country/city names
                const layersToHide = [
                    'poi-label',
                    'transit-label',
                    'airport-label',
                    'road-label',
                    'road-number-shield',
                    'road-exit-shield',
                    'waterway-label',
                    'natural-line-label',
                    'natural-point-label',
                    'water-line-label',
                    'water-point-label',
                    'building-number-label'
                ];

                const style = this.map.getStyle();
                if (style && style.layers) {
                    style.layers.forEach(layer => {
                        // Hide specific label layers
                        if (layersToHide.includes(layer.id)) {
                            this.map.setLayoutProperty(layer.id, 'visibility', 'none');
                        }
                        // Also hide any layer with 'poi' in the name
                        if (layer.id.includes('poi')) {
                            this.map.setLayoutProperty(layer.id, 'visibility', 'none');
                        }
                    });
                }

                resolve();
            });
        });
    }

    handleMapClick(e) {
        const { lng, lat } = e.lngLat;

        if (this.guessMarker) {
            this.guessMarker.remove();
        }

        const el = document.createElement('div');
        el.className = 'guess-marker';

        this.guessMarker = new mapboxgl.Marker(el, { draggable: true })
            .setLngLat([lng, lat])
            .addTo(this.map);

        this.guessMarker.on('dragend', () => {
            if (this.onGuessPlaced) {
                const lngLat = this.guessMarker.getLngLat();
                this.onGuessPlaced(lngLat.lat, lngLat.lng);
            }
        });

        if (this.onGuessPlaced) {
            this.onGuessPlaced(lat, lng);
        }
    }

    getGuessPosition() {
        if (!this.guessMarker) return null;
        const lngLat = this.guessMarker.getLngLat();
        return { lat: lngLat.lat, lng: lngLat.lng };
    }

    showCorrectLocation(lat, lng) {
        const el = document.createElement('div');
        el.className = 'correct-marker';

        this.correctMarker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(this.map);

        if (this.guessMarker) {
            const guessPos = this.guessMarker.getLngLat();

            this.map.addSource('route', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [guessPos.lng, guessPos.lat],
                            [lng, lat]
                        ]
                    }
                }
            });

            this.map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#ef4444',
                    'line-width': 3,
                    'line-dasharray': [2, 2]
                }
            });

            const bounds = new mapboxgl.LngLatBounds()
                .extend([guessPos.lng, guessPos.lat])
                .extend([lng, lat]);

            this.map.fitBounds(bounds, {
                padding: 100,
                duration: 1000
            });
        } else {
            this.map.flyTo({
                center: [lng, lat],
                zoom: 15,
                duration: 1000
            });
        }
    }

    reset(league = 'all') {
        if (this.guessMarker) {
            this.guessMarker.remove();
            this.guessMarker = null;
        }

        if (this.correctMarker) {
            this.correctMarker.remove();
            this.correctMarker = null;
        }

        if (this.map.getLayer('route')) {
            this.map.removeLayer('route');
        }

        if (this.map.getSource('route')) {
            this.map.removeSource('route');
        }

        const leagueSettings = {
            'MLB': { center: [-98, 39], zoom: 3 },
            'AAA': { center: [-98, 39], zoom: 3 },
            'AA': { center: [-95, 35], zoom: 4 },
            'High-A': { center: [-95, 35], zoom: 4 },
            'Low-A': { center: [-95, 35], zoom: 4 },
            'Spring': { center: [-95, 30], zoom: 4 },
            'all': { center: [0, 20], zoom: 1 },
            'other': { center: [0, 20], zoom: 1 }
        };

        const settings = leagueSettings[league] || leagueSettings['all'];

        this.map.flyTo({
            center: settings.center,
            zoom: settings.zoom,
            duration: 500
        });
    }

    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameMap;
}
